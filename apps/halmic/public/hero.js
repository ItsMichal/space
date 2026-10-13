// halmic hero reel: a slow-motion highlights loop (muted video) drawn behind the hero through a WebGL shader, as a living field of leaning capsules.
// Passes per frame: (1) video -> temporally smoothed colour buffer (alpha = luminance change, i.e. motion); (2) a 1 px stats pass (scene mean and
// spread, eased: the auto-exposure); (3) a cell pass, one texel per glyph, that turns the buffer into eased glyph state (size, warmth, lean, length);
// (4) a damped wave field at low resolution (touch and pointer drop energy into it); (5) the composite: a duotone underlay under the capsule screen,
// displaced by the field and an always-on slow flow, with a glitch (slice offsets, ink split, scale snap) around touches.
// Ink, violet-ink and cobalt carry the tones; pale cobalt and near-paper appear only at the peaks. The footage dissolves into the field by noise
// and by its own luminance, so no rectangle ever shows; the quiet zones (nav, status, topline, buttons) stay near pure ink.
// No dependencies. Starts after load and idle, only while the hero is on screen and the tab is visible; reduced motion, data saver,
// a missing WebGL or a refused autoplay show a still of the poster instead (styled in CSS). Quality adapts to the GPU in the first seconds.
// Test overrides: ?reelq=0..3 pins the quality tier, ?reelfx=0 turns off the field, the flow and all input, ?reelhf=0 forces the RGBA8 field path.
(() => {
  const hero = document.querySelector('.hero');
  const box = hero && hero.querySelector('[data-reel]');
  const video = box && box.querySelector('video');
  const canvas = box && box.querySelector('canvas');
  if (!video || !canvas) return;
  const root = document.documentElement;
  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  const conn = navigator.connection || {};
  const saveData = !!conn.saveData;
  const slowNet = /(^|-)(2g|3g)$/.test(conn.effectiveType || '');
  const LEAN = Math.tan(13 * Math.PI / 180);   // the logotype's lean, same as the .field bars
  const FPS = 30, MAX_W = 1920, MAX_DPR = 2;
  // tuning knobs
  const FLOW = 1.8;         // idle liquid flow, css px of glyph displacement (0 = still)
  const WAVE_K = 30;       // css px of glyph displacement per unit of field slope
  const SIM_HZ = 60;       // wave steps per second (time based, so slow GPUs keep the same speed)
  const WAVE_C2 = .42;     // wave speed squared (stable below .5)
  const WAVE_DAMP = .974;  // velocity damping per step: the field is quiet again after ~1.3 s
  const RIPPLE = 560;      // css px per second, the speed of the analytic ring
  const GLITCH = .26;      // seconds of slice offsets and ink split after a tap
  const PARALLAX = 7;      // css px the underlay drifts against the glyphs
  // adaptive quality: device-pixel scale, buffer width, sim width and steps, bloom, neighbour merge; stepped down when frames take too long
  const QUALITY = [
    { d: 1, b: 1, sim: 256, steps: 3, bloom: 1, nb: 1 },
    { d: .8, b: .75, sim: 192, steps: 2, bloom: 0, nb: 1 },
    { d: .62, b: .56, sim: 128, steps: 2, bloom: 0, nb: 0 },
    { d: .5, b: .44, sim: 96, steps: 1, bloom: 0, nb: 0 }
  ];
  const params = new URLSearchParams(location.search);
  const pinned = params.get('reelq');
  const fxOn = params.get('reelfx') !== '0';
  const forceQ8 = params.get('reelhf') === '0';

  // the poster as a real <img>, added after load so it can never be the page's LCP; CSS gives it the same duotone
  function still() {
    if (box.querySelector('.reel-still')) return;
    const portrait = wantPortrait();
    const img = new Image();
    img.className = 'reel-still'; img.alt = ''; img.width = portrait ? 540 : 1280; img.height = portrait ? 960 : 720; img.decoding = 'async';
    img.src = portrait ? '/hero/reel-poster-m.jpg' : video.dataset.poster;
    box.appendChild(img);
    box.classList.add('is-still');
  }
  // tall boxes (phones, tablets held upright) get the portrait cut
  function wantPortrait() {
    const r = box.getBoundingClientRect();
    return innerWidth <= 700 || r.height > r.width * 1.05;
  }

  const P = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  // shared GLSL: ink, hash, a cheap smooth noise, the organic footage mask
  const COMMON = `
varying vec2 v;
const vec3 INK=vec3(.0588,.0549,.0745);
uniform vec2 res,quiet;uniform float sc,sideW,hdrE,winH,time,ctr;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
float sn(vec2 q,float t){return .5+(sin(q.x*1.3+sin(q.y*.9+t*.21))+sin(q.y*1.7-q.x*.4+t*.16)+sin((q.x+q.y)*.71-t*.1))/6.;}
// 1 = show the footage, 0 = pure ink. Every edge is pushed around by noise (w) and by the image itself (L), so there is never a straight line.
float zone(vec2 p,float w,float L){
  vec2 s=p/res;
  float side=smoothstep(.0,sideW,min(s.x,1.-s.x)+w*.2+(L-.4)*.07);
  float top=smoothstep(22.+w*70.,hdrE+w*90.,p.y/sc);                   // up into the nav band
  float wb=1.-smoothstep(winH*.5,winH*.97,p.y+w*winH*.4+(L-.4)*winH*.1);   // the end of the footage window (phones)
  float fade=1.-smoothstep(quiet.x,quiet.y,s.y+w*.12);                  // behind the wordmark, down to ink above the topline and buttons
  return side*top*wb*fade;
}
// contrast around the scene mean: dark scenes are lifted, bright ones are not clipped
float tone(float L,vec2 ex){float sg=ex.g*.5;float t=(L-ex.r)/(sg*2.4+.06)*.62*ctr+.44;return smoothstep(.03,.97,t);}
float ez(float o,float t,float k){float d=t-o;float s=d*k;float m=1.5/255.;s=abs(s)<m?sign(d)*min(abs(d),m):s;return o+s;}
`;
  // pass 1: video -> colour in the working buffer, cover-fitted, slowly drifting (4 taps against aliasing), then eased toward the previous frame
  // (exponential blend with a per-frame step cap) so cuts and bright moments can never strobe. Alpha carries the luminance change.
  const FS1 = P + `varying vec2 v;uniform sampler2D vid,prev;uniform vec2 asp,px;uniform vec3 drift;uniform float k,cap,first;
vec3 T(vec2 u){return texture2D(vid,u).rgb;}
void main(){
  vec2 q=(v-.5)*asp/1.06+.5;               // cover fit, 6% overscan for the drift
  q+=drift.xy;
  q.y=1.-q.y;
  vec3 c=(T(q+px)+T(q-px)+T(q+vec2(px.x,-px.y))+T(q+vec2(-px.x,px.y)))*.25;
  vec3 o=texture2D(prev,v).rgb;
  vec3 t=first>.5?c:o+clamp((c-o)*k,-cap,cap);
  float dl=dot(t-o,vec3(.2126,.7152,.0722));
  gl_FragColor=vec4(t,clamp(.5+dl*3.,0.,1.));
}`;
  // stats: mean and spread of the footage's luminance, eased slowly (the auto-exposure). One pixel.
  const FSS = P + `varying vec2 v;uniform sampler2D img,prev;uniform float k,first;
float ez(float o,float t,float k){float d=t-o;float s=d*k;float m=1.5/255.;s=abs(s)<m?sign(d)*min(abs(d),m):s;return o+s;}
void main(){
  float s=0.,s2=0.;
  for(int j=0;j<8;j++)for(int i=0;i<8;i++){
    vec3 c=texture2D(img,vec2((float(i)+.5)/8.,.22+(float(j)+.5)/8.*.68)).rgb;
    float l=dot(c,vec3(.2126,.7152,.0722));s+=l;s2+=l*l;
  }
  float m=s/64.,sd=sqrt(max(s2/64.-m*m,0.));
  vec2 o=texture2D(prev,vec2(.5)).rg;
  vec2 t=vec2(m,min(sd*2.,1.));
  gl_FragColor=first>.5?vec4(t,0.,1.):vec4(ez(o.x,t.x,k),ez(o.y,t.y,k),0.,1.);
}`;
  // cells: one texel per glyph. Target size from the image (contrast around the scene mean), warmth, lean from edges and motion, length from edge
  // strength; then an asymmetric ease so glyphs swell and shrink instead of flickering. R size, G warmth, B lean, A length.
  const FSC = P + COMMON + `uniform sampler2D img,prev,stat;uniform vec2 cdim;uniform float cell,lean,k,first,idleOn;
vec4 S4(vec2 p){return texture2D(img,vec2(p.x/res.x,1.-p.y/winH));}
void main(){
  vec2 id=floor(gl_FragCoord.xy);
  vec2 cp=(id+.5)*cell; cp.x-=cp.y*lean;
  float a=cell*.36;
  vec4 s0=S4(cp);vec3 c1=S4(cp+vec2(a,0.)).rgb,c2=S4(cp-vec2(a,0.)).rgb,c3=S4(cp+vec2(0.,a)).rgb,c4=S4(cp-vec2(0.,a)).rgb;
  float l0=lum(s0.rgb),l1=lum(c1),l2=lum(c2),l3=lum(c3),l4=lum(c4);
  float Lm=(l0*2.+l1+l2+l3+l4)/6.;
  vec2 ex=texture2D(stat,vec2(.5)).rg;
  float th=tone(Lm,ex);
  float pk=tone(max(max(l0,l1),max(l2,l3)),ex);   // a touch of the local peak, so small highlights are not averaged away
  th=mix(th,max(th,pk),.3);
  vec3 cm=(s0.rgb*2.+c1+c2+c3+c4)/6.;
  float warm=smoothstep(.015,.14,(cm.r+cm.b)*.5-cm.g)*smoothstep(.12,.45,th);
  // lean along the edge (perpendicular to the gradient) and a little along the motion (normal flow from the luminance change)
  float gx=l1-l2,gy=l3-l4,gg=gx*gx+gy*gy;
  float es=smoothstep(.015,.16,sqrt(gg));
  float tx=-gy,ty=gx;float sg=ty<0.?-1.:1.;tx*=sg;ty=abs(ty);
  float ang=clamp(atan(tx,ty+1e-4)+.227,-.6,.6)*es*.55;
  float Lt=(s0.a-.5)/3.;
  float fl=-Lt*gx/(gg+.004);
  ang=clamp(ang+clamp(fl*2.2,-.3,.3),-.55,.55);
  float el=clamp(es*.7+min(abs(Lt)*16.,.5),0.,1.);
  // dissolve: noise, the image itself and a per-dot hash decide where the footage ends
  float nz=sn(cp/(sc*140.)+vec2(3.7,1.3),time*.7)-.5;
  float m=zone(cp,nz,Lm);
  float dis=smoothstep(.0,.34,m-hash(id)*.42);
  float idl=(.075+.11*sn(cp/(sc*85.)+vec2(9.,4.),time*1.1))*(.5+.5*smoothstep(.0,.3,m))*idleOn;
  float tgt=max(th*dis,idl);
  vec4 n=vec4(tgt,warm*dis,ang*.8+.5,el);
  vec4 o=texture2D(prev,(id+.5)/cdim);
  if(first<.5){float kk=tgt>o.r?k:k*.62;n=vec4(ez(o.r,n.r,kk),ez(o.g,n.g,.15),ez(o.b,n.b,.2),ez(o.a,n.a,.2));}
  gl_FragColor=n;
}`;
  // field: damped wave equation, height in R and velocity in G (biased into RGBA8 when float targets are missing); injections add gaussian bumps
  const FSW = P + `varying vec2 v;uniform sampler2D st;uniform vec2 px,dim;uniform vec4 inj[6];uniform float c2,damp;
vec2 dec(vec4 c){
#ifdef Q8
  return (c.rg-128./255.)*(255./127.);
#else
  return c.rg;
#endif
}
vec4 enc(vec2 x){
#ifdef Q8
  return vec4(128./255.+clamp(x,-1.,1.)*(127./255.),0.,1.);
#else
  return vec4(clamp(x,-2.,2.),0.,1.);
#endif
}
void main(){
  vec2 c=dec(texture2D(st,v));
  float hl=dec(texture2D(st,v-vec2(px.x,0.))).x,hr=dec(texture2D(st,v+vec2(px.x,0.))).x,hu=dec(texture2D(st,v+vec2(0.,px.y))).x,hd=dec(texture2D(st,v-vec2(0.,px.y))).x;
  float lap=hl+hr+hu+hd-4.*c.x;
  float edge=smoothstep(.0,.07,min(min(v.x,1.-v.x),min(v.y,1.-v.y)));   // the border soaks waves up
  float vel=(c.y+lap*c2)*damp*mix(.9,1.,edge);
  float h=(c.x+vel)*.9995;
  if(abs(vel)<.011)vel=0.;
  if(abs(h)<.0065)h=0.;
  for(int i=0;i<6;i++){vec4 q=inj[i];if(q.w!=0.){vec2 d=(v-q.xy)*dim;h+=q.w*exp(-dot(d,d)/(q.z*q.z));}}
  gl_FragColor=enc(vec2(h,vel));
}`;
  // composite: duotone underlay + the capsule screen, both displaced by the field, the idle flow and the touch glitch
  const FS2 = P + COMMON + `uniform sampler2D img,cells,sim,stat;uniform vec2 cdim,par;uniform float cell,live,lean,bt,amp,sgp,fx,bloom,nb,flowA,waveK,idleOn;uniform vec4 tp[6];
float gSnap,gCrest,gAng;
vec3 S(vec2 p){return texture2D(img,vec2(p.x/res.x,1.-p.y/winH)).rgb;}
float H(vec2 p){
  vec4 c=texture2D(sim,vec2(p.x/res.x,1.-p.y/res.y));
#ifdef Q8
  return (c.r-128./255.)*(255./127.);
#else
  return c.r;
#endif
}
// the glyph layer at a (displaced) position: colour and coverage. Own cell plus the cells above and below, so bright capsules merge into bars.
vec4 G(vec2 pw){
  vec2 g=vec2(pw.x+pw.y*lean,pw.y)/cell;
  vec2 id=floor(g),f=fract(g)-.5;
  float aa=.9/cell,best=0.;vec3 bc=vec3(0.);
  for(int j=-1;j<=1;j++){
    if(nb<.5&&j!=0)continue;
    vec2 ij=clamp(id+vec2(0.,float(j)),vec2(0.),cdim-1.);
    vec4 s=texture2D(cells,(ij+.5)/cdim);
    float th=clamp(s.r*(1.+gSnap)+gCrest*(.4+s.r),0.,1.2);
    if(th<.04)continue;
    float an=clamp((s.b-.5)/.8+gAng,-.75,.75);
    vec2 fl=f-vec2(0.,float(j));
    fl=vec2(fl.x+an*fl.y,fl.y-an*fl.x);
    float r=mix(.085,.37,th),hh=mix(.0,.33,th*th)*(.7+.8*s.a);
    float sd=length(vec2(fl.x,max(abs(fl.y)-hh,0.)))-r;
    float cov=1.-smoothstep(-aa,aa,sd);
    if(cov>best){
      best=cov;
      vec3 cob=mix(vec3(.085,.105,.26),vec3(.15,.265,.56),smoothstep(.05,.78,th));
      vec3 vio=mix(vec3(.11,.07,.25),vec3(.38,.17,.55),smoothstep(.05,.8,th));
      cob=mix(cob,vio,s.g*.85);
      cob=mix(cob,vec3(.42,.58,.97),smoothstep(.64,.9,th)*(1.-.45*s.g));   // third ink: pale cobalt
      cob=mix(cob,vec3(.94,.92,.87),smoothstep(.88,1.04,th)*.85);            // fourth: near-paper, the very peaks only
      cob=mix(cob,vec3(.27,.38,.68),live*.15)*(1.+.1*live);
      cob*=1.+.15*clamp(-fl.x/r,-1.,1.)*th;
      bc=cob;
    }
  }
  return vec4(bc,best);
}
void main(){
  vec2 px=vec2(v.x*res.x,(1.-v.y)*res.y);    // device pixels, origin top-left
  float tt=time;
  // ---- the field: slope of the wave height, the idle flow, and the touch glitch
  float h0=H(px);
  vec2 gh=vec2(H(px+vec2(sgp,0.))-h0,H(px+vec2(0.,sgp))-h0);
  vec2 q=px/sc;
  vec2 flow=vec2(sin(q.y*.021+tt*.31)+sin(q.y*.047-q.x*.012-tt*.23),sin(q.x*.019-tt*.27)+sin(q.x*.041+q.y*.015+tt*.19))*flowA*sc;
  float slice=0.,snap=0.,ring=0.,split=0.;
  for(int i=0;i<6;i++){
    vec4 t=tp[i];
    if(t.w>0.){
      vec2 d=(px-t.xy*res)/sc;float r=length(d);
      float fall=exp(-r*r/(2.*190.*190.))*t.w;
      float age=t.z;
      if(age<${GLITCH.toFixed(3)}){
        float ge=1.-age/${GLITCH.toFixed(3)};ge*=ge;
        float sy=floor(px.y/(sc*10.));float fr=floor(age*26.)+float(i)*5.;
        float on=step(.42,hash(vec2(sy*1.7,fr)));
        slice+=(hash(vec2(sy,fr))-.5)*2.*ge*fall*on*36.*sc;
        split+=ge*fall;
      }
      snap+=exp(-age*6.)*exp(-r*r/(2.*150.*150.))*t.w;
      float R=age*${RIPPLE.toFixed(1)};
      float w=18.+age*34.;
      ring+=exp(-(r-R)*(r-R)/(w*w))*exp(-age*2.1)*t.w*smoothstep(.0,.06,age);
    }
  }
  vec2 pw=px+vec2(slice,0.)+flow*fx+gh*waveK*sc*fx;
  float qz=1.-smoothstep(quiet.x,quiet.y,px.y/res.y);
  float crest=clamp(h0*4.,-.4,1.)*fx;
  gCrest=(crest+ring*.9)*(.4+.6*qz);
  gSnap=snap*.45*(.4+.6*qz);
  gAng=clamp((gh.x*5.+gh.y*0.)*fx,-.4,.4);
  // ---- underlay: continuous-tone duotone with mild unsharp masking, drifting a little against the glyph layer
  vec2 pu=px-par*sc+flow*fx*.6;
  vec2 ex=texture2D(stat,vec2(.5)).rg;
  vec3 c0=S(pu);float L0=lum(c0);
  float o=bt*1.5;
  float Lb=(lum(S(pu+vec2(o,o)))+lum(S(pu+vec2(-o,o)))+lum(S(pu+vec2(o,-o)))+lum(S(pu+vec2(-o,-o))))*.25;
  float Ls=L0+(L0-Lb)*2.2;
  float tu=tone(Ls,ex)*.85;
  float w0=sn(px/(sc*140.)+vec2(3.7,1.3),tt*.7)-.5;
  float m=zone(px,w0,L0);
  vec3 duo=mix(INK,vec3(.10,.17,.40),tu);
  float warmU=smoothstep(.02,.16,(c0.r+c0.b)*.5-c0.g)*tu;
  duo=mix(duo,vec3(.21,.10,.37),warmU*.55);
  duo=mix(duo,vec3(.30,.42,.78),smoothstep(.8,1.,tu)*.35);
  vec3 col=mix(INK,duo,amp*smoothstep(.0,.5,m));
  // ---- bloom: a soft glow from the brightest glyphs (cell texture, bilinear)
  if(bloom>.5){
    vec2 gu=vec2(pw.x+pw.y*lean,pw.y)/cell;float gl=0.;
    gl+=smoothstep(.6,1.,texture2D(cells,(gu+vec2(1.7,1.7))/cdim).r);gl+=smoothstep(.6,1.,texture2D(cells,(gu+vec2(-1.7,1.7))/cdim).r);
    gl+=smoothstep(.6,1.,texture2D(cells,(gu+vec2(1.7,-1.7))/cdim).r);gl+=smoothstep(.6,1.,texture2D(cells,(gu+vec2(-1.7,-1.7))/cdim).r);
    col+=vec3(.16,.27,.62)*gl*.07*(.3+.7*qz);
  }
  // ---- the capsule screen; during a glitch the layer splits into a violet ghost, a pale ghost and the main ink
  if(split>.03){
    float sp=min(split,1.);
    vec2 so=vec2(sp*5.*sc,0.);
    vec4 a=G(pw+so),b=G(pw-so),c=G(pw);
    col=mix(col,a.rgb*vec3(1.5,.65,1.9)+vec3(.05,.0,.08),a.a*.8*sp);
    col=mix(col,b.rgb*vec3(.9,1.5,1.8)+vec3(.0,.06,.1),b.a*.8*sp);
    col=mix(col,c.rgb,c.a);
  }else{
    vec4 gg=G(pw);
    col=mix(col,gg.rgb,gg.a);
  }
  col+=(hash(px+floor(tt*10.))-.5)*.014*smoothstep(.0,.4,m+.2);   // fine grain
  gl_FragColor=vec4(col,1.);
}`;

  let gl, progs = {}, vidTex, buf, W = 0, H = 0, BW = 0, BH = 0, running = false, raf = 0, last = 0, ready = false, started = false, fresh = true, liveV = 0, hasFrame = false, uploaded = -1, quietX = .4, quietY = .8, winCss = 0;
  let qi = 0, bufType, q8 = false, assetKey = '', cadence = [], lastRaf = 0, probing = true, cell0 = 6;
  const R = { buf: null, stat: null, cell: null, sim: null };   // ping-pong sets: { tex: [a, b], fbo: [a, b], cur, w, h }
  const loc = {};
  let cdimW = 0, cdimH = 0, simW = 0, simH = 0, cellFresh = true, statFresh = true, lastSim = 0, simAcc = 0, simUntil = 0, steps = 2;
  const touches = [];            // { u, v, t0, s } canvas-relative, v from the top
  const imps = [];               // pending wave impulses { x, y, r, a } in sim coordinates (y up)
  const ptrs = new Map();        // active pointers
  const par = [0, 0], parT = [0, 0];
  let lastMove = 0;

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(fs, names) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, (q8 ? '#define Q8 1\n' : '') + fs));
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; for (const n of names) u[n] = gl.getUniformLocation(p, n);
    u.prog = p;
    return u;
  }
  function tex(w, h, type, filter) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    const f = filter || gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null);
    return t;
  }
  // a ping-pong pair of render targets; cleared to clearV (the field's zero is mid-grey in the RGBA8 encoding)
  function alloc(set, w, h, clearV) {
    set.w = w; set.h = h; set.cur = 0;
    for (let i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, set.tex[i]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, bufType, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, set.fbo[i]); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, set.tex[i], 0);
      gl.clearColor(clearV, clearV, clearV, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }
  function makeSet() { const s = { tex: [], fbo: [], cur: 0, w: 0, h: 0 }; for (let i = 0; i < 2; i++) { s.tex[i] = tex(0); s.fbo[i] = gl.createFramebuffer(); } return s; }
  // can this GPU render to half-float textures (and filter them)? RGBA8 otherwise
  function probeFloat() {
    if (forceQ8) return gl.UNSIGNED_BYTE;
    const hf = gl.getExtension('OES_texture_half_float');
    if (!hf || !gl.getExtension('EXT_color_buffer_half_float') || !gl.getExtension('OES_texture_half_float_linear')) return gl.UNSIGNED_BYTE;
    const t = tex(4, 4, hf.HALF_FLOAT_OES), f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(f); gl.deleteTexture(t);
    return ok ? hf.HALF_FLOAT_OES : gl.UNSIGNED_BYTE;
  }

  function init() {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    if (!gl) return false;
    try {
      bufType = probeFloat(); q8 = bufType === gl.UNSIGNED_BYTE;
      const common = ['res', 'quiet', 'sc', 'sideW', 'hdrE', 'winH', 'time', 'ctr'];
      progs.p1 = program(FS1, ['vid', 'prev', 'asp', 'px', 'drift', 'k', 'cap', 'first']);
      progs.ps = program(FSS, ['img', 'prev', 'k', 'first']);
      progs.pc = program(FSC, [...common, 'img', 'prev', 'stat', 'cdim', 'cell', 'lean', 'k', 'first', 'idleOn']);
      progs.pw = program(FSW, ['st', 'px', 'dim', 'inj', 'c2', 'damp']);
      progs.p2 = program(FS2, [...common, 'img', 'cells', 'sim', 'stat', 'cdim', 'par', 'cell', 'live', 'lean', 'bt', 'amp', 'sgp', 'fx', 'bloom', 'nb', 'flowA', 'waveK', 'idleOn', 'tp']);
      buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      for (const k of Object.keys(R)) R[k] = makeSet();
      vidTex = tex(0);
      W = H = BW = BH = cdimW = cdimH = simW = simH = 0; fresh = cellFresh = statFresh = true; uploaded = -1; hasFrame = false; ready = false;
      // the 1 px stats target
      alloc(R.stat, 1, 1, 0);
    } catch (e) { console.warn('reel: shader setup failed', e && e.message); return false; }
    return true;
  }

  // which file: portrait cut for tall boxes; 1080 only for a big, hi-dpi canvas on a connection that is not 2g/3g/save-data; mp4 where VP9 is not trusted
  function pick(cssW) {
    const portrait = wantPortrait();
    const ua = navigator.userAgent;
    const apple = /iPhone|iPad|iPod/.test(ua) || (/Apple/.test(navigator.vendor || '') && !/Chrome|Chromium|Edg|Android/.test(ua));
    const vp9 = !apple && !!video.canPlayType('video/webm; codecs="vp9"');
    const big = !portrait && Math.min(cssW * (devicePixelRatio || 1), MAX_W) >= 1400 && !slowNet && !saveData;
    if (portrait) return vp9 ? '/hero/reel-m.webm' : '/hero/reel-m.mp4';
    if (vp9) return big ? '/hero/reel-1080.webm' : '/hero/reel-720.webm';
    return '/hero/reel-720.mp4';
  }
  function load(cssW) {
    const f = pick(cssW);
    if (f === assetKey) return;
    assetKey = f;
    video.src = f; video.muted = true; video.load();
    uploaded = -1;
    if (running) { const p = video.play(); if (p && p.catch) p.catch(() => { stop(); fallback(); }); }
  }

  function size() {
    const r = canvas.getBoundingClientRect();
    const cssW = Math.max(1, r.width), cssH = Math.max(1, r.height);
    const q = QUALITY[qi];
    const portrait = wantPortrait();
    const phone = portrait && innerWidth <= 900;
    const sc = Math.min(window.devicePixelRatio || 1, MAX_DPR, MAX_W / cssW) * q.d;
    const w = Math.round(cssW * sc), h = Math.round(cssH * sc);
    if (w !== W || h !== H) { W = w; H = h; canvas.width = w; canvas.height = h; }
    // the footage window: the whole canvas, or on phones the portrait picture's own height from the top (the rest is field only)
    winCss = phone ? Math.min(cssH, cssW * 16 / 9) : cssH;
    // working buffer (the window): 960..1280 wide on desktop (more when the canvas is big), 540 on phones, scaled by the quality tier
    const bw = Math.max(360, Math.round((phone ? 540 : (cssW * (window.devicePixelRatio || 1) >= 1500 ? 1280 : 960)) * q.b));
    const bh = Math.round(bw * winCss / cssW);
    if (bw !== BW || bh !== BH) { BW = bw; BH = bh; alloc(R.buf, bw, bh, 0); fresh = true; }
    cell0 = phone ? 5 : 6;
    const cell = cell0 * sc;
    const cw = Math.ceil((W + H * LEAN) / cell) + 3, ch = Math.ceil(H / cell) + 3;
    if (cw !== cdimW || ch !== cdimH) { cdimW = cw; cdimH = ch; alloc(R.cell, cw, ch, 0); cellFresh = true; }
    // the wave field: about 5 css px per texel on desktop, 3 on phones
    const sw = Math.max(64, Math.min(q.sim, Math.round(cssW / (phone ? 3 : 5.5)))), sh = Math.max(32, Math.round(sw * cssH / cssW));
    if (sw !== simW || sh !== simH) { simW = sw; simH = sh; alloc(R.sim, sw, sh, q8 ? 128 / 255 : 0); }
    steps = q.steps;
    // the fade to ink: from behind the wordmark to where .hero-foot starts (fractions of the canvas)
    const ft = hero.querySelector('.hero-foot'), wm = hero.querySelector('.wm');
    const end = ft ? Math.min(0.94, Math.max(0.4, (ft.getBoundingClientRect().top - r.top) / cssH)) : 0.8;
    const wb = wm ? wm.getBoundingClientRect() : null;
    const start = wb ? (wb.top + wb.height * (phone ? .8 : .45) - r.top) / cssH : end - .25;
    quietY = end; quietX = Math.max(0.2, Math.min(start, end - .06));
    load(cssW);
    return sc;
  }

  function setCommon(u, sc, t) {
    gl.uniform2f(u.res, W, H); gl.uniform2f(u.quiet, quietX, quietY); gl.uniform1f(u.sc, sc);
    const phone = cell0 < 6;
    gl.uniform1f(u.sideW, phone ? .24 : .22); gl.uniform1f(u.hdrE, phone ? 110 : 180); gl.uniform1f(u.winH, winCss * sc); gl.uniform1f(u.time, t); gl.uniform1f(u.ctr, phone ? 1.2 : 1.05);
  }
  function tex2(u, name, unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(u[name], unit); }
  function target(set, idx) { gl.bindFramebuffer(gl.FRAMEBUFFER, set.fbo[idx]); gl.viewport(0, 0, set.w, set.h); }
  const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3);

  function frame(now) {
    raf = 0;
    if (!running) return;
    raf = requestAnimationFrame(frame);
    // adaptive quality: rAF cadence over the first seconds; steps down when frames run long (> ~20 ms on average)
    if (probing && hasFrame) {
      if (lastRaf) cadence.push(now - lastRaf);
      lastRaf = now;
      if (cadence.length >= 40) {
        const avg = cadence.reduce((x, y) => x + y, 0) / cadence.length;
        cadence = [];
        if (avg > 20 && qi < QUALITY.length - 1 && pinned === null) qi++; else probing = false;
        if (qi >= QUALITY.length - 1) probing = false;
      }
    }
    if (now - last < 1000 / FPS - 2) return;
    last = now;
    const sc = size();
    const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
    // new video frame? (the footage is slowed to 24 fps, so some ticks reuse the last upload)
    const ct = video.currentTime;
    if (video.readyState >= 2 && ct !== uploaded) {
      gl.bindTexture(gl.TEXTURE_2D, vidTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); uploaded = ct; hasFrame = true; } catch { stop(); fallback(); return; }
    }
    if (!hasFrame) return;
    const t = now / 1000;
    liveV += ((root.dataset.live === '1' ? 1 : 0) - liveV) * 0.04;
    const q = QUALITY[qi];
    const bn = 1 - R.buf.cur;
    gl.disable(gl.BLEND);
    // pass 1: video -> buffer
    let u = progs.p1;
    gl.useProgram(u.prog); target(R.buf, bn);
    tex2(u, 'vid', 0, vidTex); tex2(u, 'prev', 1, R.buf.tex[R.buf.cur]);
    const ca = W / (winCss * sc), va = vw / vh;
    const ax = ca > va ? 1 : ca / va, ay = ca > va ? va / ca : 1;
    gl.uniform2f(u.asp, ax, ay);
    gl.uniform2f(u.px, .5 * ax / BW, .5 * ay / BH);
    gl.uniform3f(u.drift, Math.sin(t * .045) * .016 + Math.sin(t * .11) * .005, Math.cos(t * .037) * .012, 0);
    gl.uniform1f(u.k, .4); gl.uniform1f(u.cap, .06); gl.uniform1f(u.first, fresh ? 1 : 0);
    draw();
    fresh = false;
    R.buf.cur = bn;
    const imgTex = R.buf.tex[bn];
    // stats (auto-exposure)
    u = progs.ps; const sn_ = 1 - R.stat.cur;
    gl.useProgram(u.prog); target(R.stat, sn_);
    tex2(u, 'img', 0, imgTex); tex2(u, 'prev', 1, R.stat.tex[R.stat.cur]);
    gl.uniform1f(u.k, .05); gl.uniform1f(u.first, statFresh ? 1 : 0);
    draw(); statFresh = false; R.stat.cur = sn_;
    // cells
    u = progs.pc; const cn = 1 - R.cell.cur;
    gl.useProgram(u.prog); target(R.cell, cn); setCommon(u, sc, t);
    tex2(u, 'img', 0, imgTex); tex2(u, 'prev', 1, R.cell.tex[R.cell.cur]); tex2(u, 'stat', 2, R.stat.tex[R.stat.cur]);
    gl.uniform2f(u.cdim, cdimW, cdimH); gl.uniform1f(u.cell, cell0 * sc); gl.uniform1f(u.lean, LEAN);
    gl.uniform1f(u.k, .36); gl.uniform1f(u.first, cellFresh ? 1 : 0); gl.uniform1f(u.idleOn, fxOn ? 1 : 0);
    draw(); cellFresh = false; R.cell.cur = cn;
    // wave field
    const simOn = fxOn && (now < simUntil || imps.length);
    if (simOn) {
      simAcc += lastSim ? Math.min((now - lastSim) / 1000, .1) * SIM_HZ : 1; lastSim = now;
      let n = Math.min(Math.floor(simAcc), steps + 1); simAcc -= Math.floor(simAcc);
      if (n < 1 && imps.length) n = 1;
      u = progs.pw; gl.useProgram(u.prog);
      gl.uniform2f(u.px, 1 / simW, 1 / simH); gl.uniform2f(u.dim, simW, simH); gl.uniform1f(u.c2, WAVE_C2); gl.uniform1f(u.damp, WAVE_DAMP);
      for (let i = 0; i < n; i++) {
        const inj = new Float32Array(24);
        if (i === 0) for (let j = 0; j < 6 && imps.length; j++) { const m = imps.shift(); inj.set([m.x, m.y, m.r, m.a], j * 4); }
        gl.uniform4fv(u.inj, inj);
        const sn2 = 1 - R.sim.cur; target(R.sim, sn2); tex2(u, 'st', 0, R.sim.tex[R.sim.cur]); draw(); R.sim.cur = sn2;
      }
    } else lastSim = 0;
    // parallax target eases toward the pointer; scroll adds a little vertical drift
    par[0] += (parT[0] - par[0]) * .06; par[1] += (parT[1] + Math.max(-1, Math.min(1, (window.scrollY || 0) / 600)) * PARALLAX * .8 - par[1]) * .06;
    // composite
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    u = progs.p2; gl.useProgram(u.prog); setCommon(u, sc, t);
    tex2(u, 'img', 0, imgTex); tex2(u, 'cells', 1, R.cell.tex[R.cell.cur]); tex2(u, 'sim', 2, R.sim.tex[R.sim.cur]); tex2(u, 'stat', 3, R.stat.tex[R.stat.cur]);
    gl.uniform2f(u.cdim, cdimW, cdimH); gl.uniform2f(u.par, fxOn ? par[0] : 0, fxOn ? par[1] : 0);
    gl.uniform1f(u.cell, cell0 * sc); gl.uniform1f(u.bt, W / BW); gl.uniform1f(u.amp, .4); gl.uniform1f(u.live, liveV); gl.uniform1f(u.lean, LEAN);
    gl.uniform1f(u.sgp, W / simW); gl.uniform1f(u.fx, fxOn ? 1 : 0); gl.uniform1f(u.bloom, q.bloom); gl.uniform1f(u.nb, q.nb);
    gl.uniform1f(u.flowA, FLOW); gl.uniform1f(u.waveK, WAVE_K); gl.uniform1f(u.idleOn, fxOn ? 1 : 0);
    const tp = new Float32Array(24);
    for (let i = touches.length - 1; i >= 0; i--) if (now - touches[i].t0 > 1700) touches.splice(i, 1);
    for (let i = 0; i < Math.min(6, touches.length); i++) { const k = touches[touches.length - 1 - i]; tp.set([k.u, k.v, (now - k.t0) / 1000, k.s], i * 4); }
    gl.uniform4fv(u.tp, tp);
    draw();
    if (!ready) { ready = true; box.classList.add('is-on'); }
  }

  // ---- input: listened on the hero (the canvas sits behind its content), passive, never prevented, so scrolling and clicks work as ever
  function canvasUV(e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / Math.max(1, r.width), (e.clientY - r.top) / Math.max(1, r.height), r];
  }
  function ripple(u, v, s) {
    touches.push({ u, v, t0: performance.now(), s });
    if (touches.length > 6) touches.shift();
    imps.push({ x: u, y: 1 - v, r: 4.2, a: .9 * s });
    simUntil = performance.now() + 4200;
  }
  function wake(u, v, speed, touch) {
    imps.push({ x: u, y: 1 - v, r: touch ? 3.4 : 2.8, a: -Math.min(.2, .03 + speed * .0014) });
    if (imps.length > 12) imps.shift();
    simUntil = performance.now() + 3600;
  }
  function onDown(e) {
    if (!running || !fxOn) return;
    const [u, v] = canvasUV(e);
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), rt: performance.now() });
    ripple(u, v, 1);
  }
  function onMove(e) {
    if (!running || !fxOn) return;
    const [u, v, r] = canvasUV(e);
    const touch = e.pointerType !== 'mouse';
    parT[0] = Math.max(-1, Math.min(1, (u - .5) * 2)) * PARALLAX; parT[1] = Math.max(-1, Math.min(1, (v - .5) * 2)) * PARALLAX * .8;
    const p = ptrs.get(e.pointerId);
    if (touch && !p) return;                       // touch: only while the finger is down
    const now = performance.now();
    const px0 = p ? p.x : e.clientX, py0 = p ? p.y : e.clientY;
    const dist = Math.hypot(e.clientX - px0, e.clientY - py0);
    if (!p && now - lastMove < 16) return;
    if (!p) lastMove = now;
    const sp = dist / Math.max(8, now - (p ? p.t : now - 16)) * 16;
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1 && (dist > 1 || !p)) wake(u, v, sp, touch);
    if (p) {
      p.x = e.clientX; p.y = e.clientY; p.t = now;
      if (now - p.rt > 240) { p.rt = now; ripple(u, v, .38); }   // a dragging finger leaves small rings
    }
  }
  function onUp(e) { ptrs.delete(e.pointerId); }
  function bindInput() {
    if (!fxOn) return;
    const o = { passive: true };
    hero.addEventListener('pointerdown', onDown, o); hero.addEventListener('pointermove', onMove, o);
    hero.addEventListener('pointerup', onUp, o); hero.addEventListener('pointercancel', onUp, o); hero.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { parT[0] = parT[1] = 0; } }, o);
  }

  function go() {
    if (running || !started || document.hidden || !inView || rm.matches) return;
    running = true; last = 0; lastRaf = 0; lastSim = 0;
    const p = video.play(); if (p && p.catch) p.catch(() => { stop(); fallback(); });   // autoplay refused (data saver, low power mode): the poster stays
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf); raf = 0;
    if (!video.paused) video.pause();
    ptrs.clear();
  }
  function fallback() { started = false; box.classList.remove('is-on'); still(); }

  let inView = false;
  function boot() {
    started = true;
    if (pinned !== null && QUALITY[+pinned]) { qi = +pinned; probing = false; }
    if (!init()) { fallback(); return; }
    video.muted = true; video.defaultMuted = true;
    video.addEventListener('error', () => { stop(); fallback(); }, { once: true });
    // a lost GPU context: stop and show the poster; if the browser restores it, rebuild everything and carry on
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); fallback(); });
    canvas.addEventListener('webglcontextrestored', () => {
      const s = box.querySelector('.reel-still'); if (s) s.remove(); box.classList.remove('is-still');
      if (init()) { started = true; go(); } else fallback();
    });
    bindInput();
    load(canvas.getBoundingClientRect().width);   // the source must be set before the first play()
    go();
    // no decoded frame within a few seconds (blocked autoplay, stalled network): keep the poster
    setTimeout(() => { if (started && !hasFrame) { stop(); fallback(); } }, 8000);
  }

  const io = new IntersectionObserver((es) => { inView = es[es.length - 1].isIntersecting; if (inView) go(); else if (started) stop(); });
  io.observe(hero);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else go(); });
  rm.addEventListener('change', () => { if (rm.matches) { stop(); fallback(); } });

  // nothing starts before the page has loaded and gone idle, so the wordmark's paint and LCP are untouched
  function start() {
    if (rm.matches || saveData || !('IntersectionObserver' in window)) { still(); return; }
    boot();
  }
  const later = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 2000 }) : setTimeout(start, 400));
  if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
})();
