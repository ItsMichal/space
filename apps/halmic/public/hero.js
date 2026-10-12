// halmic hero reel: a slow-motion highlights loop (muted webm) drawn behind the hero through a WebGL shader.
// The shader maps luminance to the brand's ink/cobalt duotone and re-renders it as a field of leaning (13 degree) capsules,
// the logotype's own bar, so the footage dissolves into the bars and dots instead of reading as a video.
// No dependencies. Starts after load, only while the hero is on screen and the tab is visible; no video for reduced motion,
// data-saver or missing WebGL (a still of the poster is shown instead, styled in CSS).
(() => {
  const hero = document.querySelector('.hero');
  const box = hero && hero.querySelector('[data-reel]');
  const video = box && box.querySelector('video');
  const canvas = box && box.querySelector('canvas');
  if (!video || !canvas) return;
  const root = document.documentElement;
  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const LEAN = Math.tan(13 * Math.PI / 180);   // the logotype's lean, same as the .field bars
  const FPS = 30, MAX_W = 1280, MAX_DPR = 1.5;

  // the poster as a real <img>, added after load so it can never be the page's LCP; CSS gives it the same duotone
  function still() {
    if (box.querySelector('.reel-still')) return;
    const img = new Image();
    img.className = 'reel-still'; img.alt = ''; img.width = 1280; img.height = 720; img.decoding = 'async';
    img.src = video.dataset.poster;
    box.appendChild(img);
    box.classList.add('is-still');
  }

  const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  // pass 1: video -> luminance in a small buffer, cover-fitted, slowly drifting, then eased toward the previous frame
  // (exponential blend with a per-frame step cap) so cuts and bright moments can never strobe
  const FS1 = `precision mediump float;varying vec2 v;uniform sampler2D vid,prev;uniform vec2 asp;uniform vec3 drift;uniform float k,first;
float lum(vec2 u){vec3 c=texture2D(vid,u).rgb;return dot(c,vec3(.2126,.7152,.0722));}
void main(){
  vec2 q=(v-.5)*asp/1.06+.5;               // cover fit, 6% overscan for the drift
  q+=drift.xy;
  q.y=1.-q.y;
  vec2 e=vec2(.0035,.006);
  float c=(lum(q)*2.+lum(q+e)+lum(q-e)+lum(q+vec2(e.x,-e.y))+lum(q+vec2(-e.x,e.y)))/6.;
  float o=texture2D(prev,v).r;
  float t=first>.5?c:o+clamp((c-o)*k,-.03,.03);
  gl_FragColor=vec4(t,t,t,1.);
}`;
  // pass 2: the leaning capsule screen
  const FS2 = `precision mediump float;varying vec2 v;uniform sampler2D lumTex;uniform vec2 res;uniform float cell,live,lean,time;
const vec3 INK=vec3(.0588,.0549,.0745);
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec2 px=v*res; px.y=res.y-px.y;           // css-like pixels, origin top-left
  vec2 g=vec2(px.x+px.y*lean,px.y)/cell;    // sheared space: bars stand upright, the lean is applied by the grid itself
  vec2 id=floor(g), f=fract(g)-.5;
  vec2 cp=(id+.5)*cell; cp.x-=cp.y*lean;    // the cell centre back in screen space
  vec2 cuv=vec2(cp.x/res.x,1.-cp.y/res.y);
  float L=texture2D(lumTex,cuv).r;
  L+=(hash(id+floor(time*6.))-.5)*.02;      // a whisper of grain
  // tone: footage is pre-graded flat; stretch the middle, keep highlights in check
  float t=smoothstep(.10,.72,L);
  // quiet zones: soft vignette, header band, bottom fade; the lower third (topline + CTAs) stays near pure ink
  vec2 s=cuv; float vig=smoothstep(.0,.30,min(min(s.x,1.-s.x),min(s.y,1.-s.y)*1.6));
  float top=smoothstep(.0,.20,s.y);
  float bot=1.-smoothstep(.34,.86,s.y);
  float a=vig*top*bot;
  float cx=abs(cuv.x-.5)*2.; a*=1.-.35*smoothstep(.55,.0,cx)*smoothstep(.30,.62,s.y);   // a little calmer behind the wordmark and topline
  t*=a;
  float r=mix(.07,.30,t), hh=mix(.0,.30,t*t);
  vec2 d2=vec2(f.x,max(abs(f.y)-hh,0.));
  float d=length(d2)-r;
  float aa=.6/cell+.015;
  float cov=smoothstep(aa,-aa,d)*step(.025,t);
  vec3 mid=vec3(.092,.098,.215), hi=vec3(.150,.235,.470);
  vec3 liveHi=vec3(.250,.360,.640);
  hi=mix(hi,liveHi,live*.22); hi*=1.+.12*live;
  vec3 c=mix(mid,hi,smoothstep(.45,1.,t));
  c*=mix(.55,1.,t);
  gl_FragColor=vec4(mix(INK,c,cov),1.);
}`;

  let gl, prog1, prog2, vidTex, fbo = [], ftex = [], cur = 0, buf, W = 0, H = 0, running = false, raf = 0, last = 0, ready = false, started = false, fresh = true, liveV = 0, hasFrame = false, uploaded = -1;
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

  function init() {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    if (!gl) return false;
    try {
      prog1 = program(FS1); prog2 = program(FS2);
      buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      // the smoothed-luminance buffer ping-pongs between two textures; half-float where renderable (no stalling at 8 bits)
      let type = gl.UNSIGNED_BYTE;
      const hf = gl.getExtension('OES_texture_half_float');
      if (hf && gl.getExtension('EXT_color_buffer_half_float')) type = hf.HALF_FLOAT_OES;
      for (let i = 0; i < 2; i++) { ftex[i] = tex(320, 180, type); fbo[i] = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ftex[i], 0); }
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && type !== gl.UNSIGNED_BYTE) {
        type = gl.UNSIGNED_BYTE;
        for (let i = 0; i < 2; i++) { gl.bindTexture(gl.TEXTURE_2D, ftex[i]); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 320, 180, 0, gl.RGBA, type, null); }
      }
      vidTex = tex(0);
      for (const [p, names] of [[prog1, ['vid', 'prev', 'asp', 'drift', 'k', 'first']], [prog2, ['lumTex', 'res', 'cell', 'live', 'lean', 'time']]]) for (const n of names) loc[n] = gl.getUniformLocation(p, n);
    } catch { return false; }
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); fallback(); });
    return true;
  }

  function size() {
    const r = canvas.getBoundingClientRect();
    const cssW = Math.max(1, r.width), cssH = Math.max(1, r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const sc = Math.min(dpr, MAX_W / cssW);
    const w = Math.round(cssW * sc), h = Math.round(cssH * sc);
    if (w !== W || h !== H) { W = w; H = h; canvas.width = w; canvas.height = h; fresh = true; }
    return sc;
  }

  function frame(now) {
    raf = 0;
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / FPS - 2) return;
    last = now;
    const sc = size();
    const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
    // new video frame? (the footage is slowed, so most ticks reuse the last upload)
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
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[next]); gl.viewport(0, 0, 320, 180);
    gl.useProgram(prog1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, vidTex); gl.uniform1i(loc.vid, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ftex[cur]); gl.uniform1i(loc.prev, 1);
    const ca = W / H, va = vw / vh;
    gl.uniform2f(loc.asp, ca > va ? 1 : ca / va, ca > va ? va / ca : 1);
    gl.uniform3f(loc.drift, Math.sin(t * .045) * .018 + Math.sin(t * .11) * .006, Math.cos(t * .037) * .014, 0);
    gl.uniform1f(loc.k, .16); gl.uniform1f(loc.first, fresh ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    fresh = false;
    // pass 2
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    gl.useProgram(prog2);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ftex[next]); gl.uniform1i(loc.lumTex, 0);
    gl.uniform2f(loc.res, W, H);
    gl.uniform1f(loc.cell, (innerWidth < 700 ? 9 : 12) * sc);
    gl.uniform1f(loc.live, liveV); gl.uniform1f(loc.lean, LEAN); gl.uniform1f(loc.time, t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    cur = next;
    if (!ready) { ready = true; box.classList.add('is-on'); }
  }

  function go() {
    if (running || !started || document.hidden || !inView || rm.matches) return;
    running = true; last = 0;
    const p = video.play(); if (p && p.catch) p.catch(() => { stop(); fallback(); });
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
    if (!init()) { fallback(); return; }
    const small = matchMedia('(max-width: 700px)').matches;
    const webm = video.canPlayType('video/webm; codecs="vp9"');
    video.src = webm ? (small ? '/hero/reel-540.webm' : '/hero/reel-720.webm') : '/hero/reel-720.mp4';
    video.addEventListener('error', () => { stop(); fallback(); }, { once: true });
    go();
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
