// halmic hero reel: a slow-motion highlights loop (muted video) drawn behind the hero through a WebGL shader.
// Pass 1 turns the video into a temporally smoothed colour buffer (960 to 1280 px wide on desktop, 540 on phones).
// Pass 2 draws it twice: a continuous-tone duotone underlay (sharpened, so edges and shapes read) and, over it, a fine screen of
// leaning (13 degree) capsules, the logotype's own bar, whose size carries the tone and whose colour shifts from cobalt to violet where the footage is warm.
// The edges dissolve into the ink; the quiet zones (nav, status, topline, buttons) stay near pure ink.
// No dependencies. Starts after load and idle, only while the hero is on screen and the tab is visible; reduced motion, data saver,
// a missing WebGL or a refused autoplay show a still of the poster instead (styled in CSS). Quality adapts to the GPU in the first seconds.
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
  // adaptive quality: device-pixel scale and buffer width, stepped down when frames take too long
  const QUALITY = [{ d: 1, b: 1 }, { d: .8, b: .75 }, { d: .62, b: .56 }, { d: .5, b: .44 }];
  const pinned = new URLSearchParams(location.search).get('reelq');   // ?reelq=0..3 pins a quality level (testing)

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

  const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  // pass 1: video -> colour in the working buffer, cover-fitted, slowly drifting (4 taps against aliasing), then eased toward the previous frame
  // (exponential blend with a per-frame step cap) so cuts and bright moments can never strobe
  const FS1 = `precision mediump float;varying vec2 v;uniform sampler2D vid,prev;uniform vec2 asp,px;uniform vec3 drift;uniform float k,cap,first;
vec3 T(vec2 u){return texture2D(vid,u).rgb;}
void main(){
  vec2 q=(v-.5)*asp/1.06+.5;               // cover fit, 6% overscan for the drift
  q+=drift.xy;
  q.y=1.-q.y;
  vec3 c=(T(q+px)+T(q-px)+T(q+vec2(px.x,-px.y))+T(q+vec2(-px.x,px.y)))*.25;
  vec3 o=texture2D(prev,v).rgb;
  vec3 t=first>.5?c:o+clamp((c-o)*k,-cap,cap);
  gl_FragColor=vec4(t,1.);
}`;
  // pass 2: duotone underlay + the leaning capsule screen
  const FS2 = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v;uniform sampler2D img;uniform vec2 res,quiet;uniform float cell,live,lean,time,sc,bt,amp;
const vec3 INK=vec3(.0588,.0549,.0745);
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 S(vec2 p){return texture2D(img,vec2(p.x/res.x,1.-p.y/res.y)).rgb;}
float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
float zone(vec2 p){                          // 1 = show the footage, 0 = pure ink
  vec2 s=p/res;
  float vig=smoothstep(.0,.14,min(s.x,1.-s.x))*smoothstep(.0,.06,1.-s.y);
  float hdr=smoothstep(30.,110.,p.y/sc);     // the nav band
  float fade=1.-smoothstep(quiet.x,quiet.y,s.y);   // long fade to ink above the topline and buttons
  return vig*hdr*fade;
}
void main(){
  vec2 px=vec2(v.x*res.x,(1.-v.y)*res.y);    // device pixels, origin top-left
  // continuous-tone underlay with mild unsharp masking
  vec3 c0=S(px);
  float L0=lum(c0);
  float o=bt*1.5;
  float Lb=(lum(S(px+vec2(o,o)))+lum(S(px+vec2(-o,o)))+lum(S(px+vec2(o,-o)))+lum(S(px+vec2(-o,-o))))*.25;
  float Ls=L0+(L0-Lb)*1.5;
  float tu=smoothstep(.04,.60,Ls);
  float m=zone(px);
  vec3 duo=mix(INK,vec3(.105,.175,.40),tu);
  float warmU=smoothstep(.02,.16,(c0.r+c0.b)*.5-c0.g)*tu;
  duo=mix(duo,vec3(.21,.10,.37),warmU*.55);
  vec3 col=mix(INK,duo,amp*smoothstep(.0,.5,m));
  // the capsule screen, in a sheared grid so the lean is the grid's own
  vec2 g=vec2(px.x+px.y*lean,px.y)/cell;
  vec2 id=floor(g), f=fract(g)-.5;
  vec2 cp=(id+.5)*cell; cp.x-=cp.y*lean;     // the cell centre back in screen space
  float a=cell*.3;
  vec3 cc=(S(cp)*2.+S(cp+vec2(a,0.))+S(cp-vec2(a,0.))+S(cp+vec2(0.,a))+S(cp-vec2(0.,a)))/6.;
  float th=smoothstep(.05,.58,lum(cc));
  float mc=zone(cp);
  th*=smoothstep(.0,.3,mc-hash(id)*.4);      // dots dissolve one by one toward the edges and quiet zones
  float r=mix(.08,.41,th), hh=mix(.0,.2,th*th);
  vec2 d2=vec2(f.x,max(abs(f.y)-hh,0.));
  float aa=.7/cell+.02;
  float cov=smoothstep(aa,-aa,length(d2)-r)*step(.04,th);
  vec3 cob=mix(vec3(.115,.15,.34),vec3(.165,.28,.58),th);
  cob=mix(cob,vec3(.27,.38,.68),live*.15)*(1.+.1*live);
  float k=smoothstep(.015,.14,(cc.r+cc.b)*.5-cc.g)*smoothstep(.2,.6,th);   // warm footage -> the second ink
  vec3 dot_=mix(cob,vec3(.36,.16,.52),k*.85);
  col=mix(col,dot_,cov);
  col+=(hash(px+floor(time*10.))-.5)*.014*smoothstep(.0,.4,m);   // fine grain
  gl_FragColor=vec4(col,1.);
}`;

  let gl, prog1, prog2, vidTex, fbo = [], ftex = [], cur = 0, buf, W = 0, H = 0, BW = 0, BH = 0, running = false, raf = 0, last = 0, ready = false, started = false, fresh = true, liveV = 0, hasFrame = false, uploaded = -1, quietX = .4, quietY = .8;
  let qi = 0, bufType, assetKey = '', cadence = [], lastRaf = 0, probing = true, cell0 = 6;
  const loc = {};

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  function tex(w, h, type) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null);
    return t;
  }
  // (re)allocate the ping-pong colour buffer; half-float where renderable (an 8-bit buffer would stall the slow easing)
  function allocBuffers(w, h) {
    BW = w; BH = h;
    for (let i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, ftex[i]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, bufType, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ftex[i], 0);
    }
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && bufType !== gl.UNSIGNED_BYTE) { bufType = gl.UNSIGNED_BYTE; allocBuffers(w, h); return; }
    fresh = true;
  }

  function init() {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    if (!gl) return false;
    try {
      prog1 = program(FS1); prog2 = program(FS2);
      buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      bufType = gl.UNSIGNED_BYTE;
      const hf = gl.getExtension('OES_texture_half_float');
      if (hf && gl.getExtension('EXT_color_buffer_half_float') && gl.getExtension('OES_texture_half_float_linear')) bufType = hf.HALF_FLOAT_OES;
      for (let i = 0; i < 2; i++) { ftex[i] = tex(0); fbo[i] = gl.createFramebuffer(); }
      vidTex = tex(0);
      for (const [p, names] of [[prog1, ['vid', 'prev', 'asp', 'px', 'drift', 'k', 'cap', 'first']], [prog2, ['img', 'res', 'cell', 'live', 'lean', 'time', 'sc', 'quiet', 'bt', 'amp']]]) for (const n of names) loc[n] = gl.getUniformLocation(p, n);
    } catch { return false; }
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); fallback(); });
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
    const phone = wantPortrait() && innerWidth <= 900;
    const sc = Math.min(window.devicePixelRatio || 1, MAX_DPR, MAX_W / cssW) * q.d;
    const w = Math.round(cssW * sc), h = Math.round(cssH * sc);
    if (w !== W || h !== H) { W = w; H = h; canvas.width = w; canvas.height = h; }
    // working buffer: 960..1280 wide on desktop (more when the canvas is big), 540 on phones, scaled by the quality tier
    const bw = Math.max(360, Math.round((phone ? 540 : (cssW * (window.devicePixelRatio || 1) >= 1500 ? 1280 : 960)) * q.b));
    const bh = Math.round(bw * cssH / cssW);
    if (bw !== BW || bh !== BH) allocBuffers(bw, bh);
    cell0 = phone ? 5 : 6;
    // the topline and CTAs must sit on near-pure ink: the fade to ink ends where .hero-foot starts (as a fraction of the canvas)
    const ft = hero.querySelector('.hero-foot');
    const end = ft ? Math.min(0.94, Math.max(0.4, (ft.getBoundingClientRect().top - r.top) / cssH)) : 0.8;
    quietY = end; quietX = Math.max(0.2, end - (phone ? 0.2 : 0.3));
    load(cssW);
    return sc;
  }

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
    const next = 1 - cur;
    // pass 1
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[next]); gl.viewport(0, 0, BW, BH);
    gl.useProgram(prog1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, vidTex); gl.uniform1i(loc.vid, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ftex[cur]); gl.uniform1i(loc.prev, 1);
    const ca = W / H, va = vw / vh;
    const ax = ca > va ? 1 : ca / va, ay = ca > va ? va / ca : 1;
    gl.uniform2f(loc.asp, ax, ay);
    gl.uniform2f(loc.px, .5 * ax / BW, .5 * ay / BH);
    gl.uniform3f(loc.drift, Math.sin(t * .045) * .016 + Math.sin(t * .11) * .005, Math.cos(t * .037) * .012, 0);
    gl.uniform1f(loc.k, .4); gl.uniform1f(loc.cap, .06); gl.uniform1f(loc.first, fresh ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    fresh = false;
    // pass 2
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    gl.useProgram(prog2);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ftex[next]); gl.uniform1i(loc.img, 0);
    gl.uniform2f(loc.res, W, H);
    gl.uniform1f(loc.cell, cell0 * sc); gl.uniform1f(loc.bt, W / BW); gl.uniform1f(loc.amp, .5);
    gl.uniform2f(loc.quiet, quietX, quietY); gl.uniform1f(loc.sc, sc); gl.uniform1f(loc.live, liveV); gl.uniform1f(loc.lean, LEAN); gl.uniform1f(loc.time, t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    cur = next;
    if (!ready) { ready = true; box.classList.add('is-on'); }
  }

  function go() {
    if (running || !started || document.hidden || !inView || rm.matches) return;
    running = true; last = 0; lastRaf = 0;
    const p = video.play(); if (p && p.catch) p.catch(() => { stop(); fallback(); });   // autoplay refused (data saver, low power mode): the poster stays
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf); raf = 0;
    if (!video.paused) video.pause();
  }
  function fallback() { started = false; box.classList.remove('is-on'); still(); }

  let inView = false;
  function boot() {
    started = true;
    if (pinned !== null && QUALITY[+pinned]) { qi = +pinned; probing = false; }
    if (!init()) { fallback(); return; }
    video.muted = true; video.defaultMuted = true;
    video.addEventListener('error', () => { stop(); fallback(); }, { once: true });
    go();
    // no decoded frame within a few seconds (blocked autoplay, stalled network): keep the poster
    setTimeout(() => { if (started && !hasFrame) { stop(); fallback(); } }, 6000);
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
