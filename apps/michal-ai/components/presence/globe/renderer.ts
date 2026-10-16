// WebGL2 renderer for the hero background globe: a screen-space dot matrix over an analytically rendered sphere.
// One canvas, one fullscreen triangle, transparent. The sphere has no colour or texture of its own: each cell of a fixed pixel
// grid (snapped to whole device pixels, so it never shimmers) samples the sphere at the cell centre, turns land / lambert shading /
// limb falloff into a luminance, and draws one round dot whose radius follows it. The globe rotates underneath a stationary
// matrix. Dots are the hero's ink colour; the page behind shows through. No other colour.
import { toVec } from '@/lib/presence/geo'
import type { Ring } from './data'

export interface Palette {
  ink: [number, number, number]
}
export const LIGHT: Palette = { ink: [0.13, 0.13, 0.11] }

/** Axial tilt: the spin axis leans 23 degrees towards the upper right, so the planet reads as tilted, not as an upright map. */
export const AXIAL_TILT = (-23 * Math.PI) / 180

/** Column-major 3x3: world -> view. Centres (lat0, lon0): rotate about Y by -lon0, then about X by +lat0, then lean the axis by `tilt` about the view axis. */
export function rotation(lat0: number, lon0: number, tilt = AXIAL_TILT): Float32Array {
  const a = (-lon0 * Math.PI) / 180
  const b = (lat0 * Math.PI) / 180
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  const cb = Math.cos(b)
  const sb = Math.sin(b)
  const m0 = [
    [ca, 0, sa],
    [sb * sa, cb, -sb * ca],
    [-cb * sa, sb, cb * ca],
  ]
  const ct = Math.cos(tilt)
  const st = Math.sin(tilt)
  const m = [
    [ct * m0[0][0] - st * m0[1][0], ct * m0[0][1] - st * m0[1][1], ct * m0[0][2] - st * m0[1][2]],
    [st * m0[0][0] + ct * m0[1][0], st * m0[0][1] + ct * m0[1][1], st * m0[0][2] + ct * m0[1][2]],
    m0[2],
  ]
  return new Float32Array([m[0][0], m[1][0], m[2][0], m[0][1], m[1][1], m[2][1], m[0][2], m[1][2], m[2][2]])
}

/** Project lat/lon to view space (x right, y up, units of the globe radius; z > 0 faces the viewer). */
export function projectPoint(lat: number, lon: number, rot: Float32Array): { x: number; y: number; z: number } {
  const [x, y, z] = toVec(lat, lon)
  return {
    x: rot[0] * x + rot[3] * y + rot[6] * z,
    y: rot[1] * x + rot[4] * y + rot[7] * z,
    z: rot[2] * x + rot[5] * y + rot[8] * z,
  }
}

/** Fraction of the canvas half-size used by the sphere (the rest is margin, so dots fade out well inside the box). */
/** The canvas is this much larger than the old globe box, so the exaggerated satellite shell fits; the sphere keeps its old CSS size. */
export const SHELL_SCALE = 3.2 // the shell canvas is this many times the globe box (it is a separate, low-resolution canvas)
export const PING_CAP = 16
export const SPHERE_FRACTION = 0.94

// Shared by the land and satellite passes: the text halo and the pointer push.
// uMaskA / uMaskB: the hero text rendered from the real glyphs and blurred (HeroGlobe.tsx), canvas-sized at 1/4 scale, row 0 at the top;
// they cross-fade with uMaskMix when the phrase changes. 1 on and next to the letters, easing to 0 over about 12 CSS px.
const COMMON = `
uniform sampler2D uMaskA; uniform sampler2D uMaskB; uniform float uMaskMix; uniform float uMaskScale; uniform vec2 uRes;
float maskAt(vec2 c){
  vec2 uv = (vec2(c.x / uRes.x, 1. - c.y / uRes.y) - .5) * uMaskScale + .5;   // the mask is built in globe-box coordinates; the shell canvas is larger
  return mix(texture(uMaskA, uv).r, texture(uMaskB, uv).r, uMaskMix);
}
// how much of a dot's size and alpha stays at a point: 1 in the open, 0 under and hugging the letters, following their contour
float dimAt(vec2 c){ return 1. - smoothstep(.06, .6, maskAt(c)); }
uniform vec3 uPtr;    // pointer x, y (canvas px, origin bottom-left), strength 0..1 (0 = idle: the push code is skipped)
uniform vec2 uPush;   // radius px, maximum displacement px
uniform vec2 uWake;   // field velocity (px): the flow the pointer leaves behind it
// symbols part around the pointer: radial, gaussian falloff, no jump at the centre
vec2 pushAt(vec2 c){
  vec2 d = c - uPtr.xy;
  float l2 = dot(d, d);
  float r = uPush.x;
  float gs = exp(-l2 / (r * r));
  return (d * inversesqrt(l2 + .0225 * r * r) * uPush.y + uWake) * uPtr.z * gs;
}
`

const VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position = vec4(p*2.-1., 0., 1.); }`

const FS = `#version 300 es
precision highp float;
uniform float uR; uniform float uPitch; uniform mat3 uRot; uniform sampler2D uLand;
uniform vec3 uInk; uniform float uGlobeA;
${COMMON}
out vec4 o;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  // With the pointer active, find the symbol that was pushed onto this pixel (two fixed-point steps of the inverse), draw it displaced.
  vec2 src = gl_FragCoord.xy;
  if (uPtr.z > 0.) { src -= pushAt(src); src = gl_FragCoord.xy - pushAt(src); }
  vec2 cell = floor(src / uPitch);
  vec2 centre = (cell + .5) * uPitch;
  vec2 local = gl_FragCoord.xy - centre;
  if (uPtr.z > 0.) local -= pushAt(centre);
  vec2 q = (centre - .5*uRes) / uR;
  float r = length(q);
  vec4 col = vec4(0.);
  if (r < 1.) {
    float z = sqrt(1. - r*r);
    vec3 v = vec3(q, z);
    vec3 w = transpose(uRot) * v;
    float lat = asin(clamp(w.y, -1., 1.));
    float lon = atan(w.x, w.z);
    float land = texture(uLand, vec2(lon/6.2831853 + .5, .5 - lat/3.1415927)).r;
    // lambert from the upper left with a soft terminator; the dark side thins out rather than going black
    float lam = clamp(dot(v, normalize(vec3(-.45, .5, .74))), 0., 1.);
    float lit = mix(.38, 1., smoothstep(0., .55, lam));
    float limb = smoothstep(0., .62, z); limb *= limb;
    float lum = mix(0., 1., land) * lit;
    // dots shrink and fade under and around the letters (the text halo mask), following their contour, so text keeps its contrast
    float dimf = dimAt(centre);
    float rad = uPitch * (.06 + .30 * lum) * (.5 + .5 * dimf);
    float d = length(local);
    float a = (1. - smoothstep(rad - .55, rad + .55, d)) * limb;
    a *= .86 + .14 * h2(cell);                 // the faintest per-cell variation
    a *= dimf;
    vec3 c = uInk;
    a *= uGlobeA;
    col = vec4(c * a, a);
  }
  o = col;
}`


// Satellite passes: dots, trails and mesh pings, all propagated here (mirror of lib/starlink/orbit.mjs positionEcef). Positions and
// motion are the real elements; the DRAWN orbit radius is exaggerated (the true 1.05 to 1.10 globe radii are mapped onto uShell) so
// the constellation reads as a cloud around the globe. Depth: nearer to the viewer is a little bigger and stronger.
const SATLIB = `
const float MU = 398600.8; const float RE = 6378.135; const float J2 = .001082616; const float TAU = 6.2831853; const float OMEGA = 7.2921159e-5;
uniform float uT; uniform float uGmst; uniform mat3 uRot; uniform float uR; uniform float uPitch;
uniform vec2 uShell; uniform float uHalf; uniform float uAlpha;
// e = (inclination, RAAN at epoch, argument of latitude at epoch, rate), d = drag rate, tt = seconds since the reference epoch
vec3 satView(vec4 e, float d, float tt){
  float udot = e.w;
  float aKm = pow(MU / (udot * udot), 1. / 3.);
  float k = J2 * (RE / aKm) * (RE / aKm);
  float gm = uGmst + (tt - uT) * OMEGA;
  float raan = e.y - 1.5 * k * udot * cos(e.x) * tt - gm;
  float u = mod(e.z + udot * tt + .5 * d * tt * tt, TAU);
  float cu = cos(u), su = sin(u), cr = cos(raan), sr = sin(raan), ci = cos(e.x);
  vec3 dir = vec3(cr * cu - sr * su * ci, sr * cu + cr * su * ci, su * sin(e.x));
  float shell = mix(uShell.x, uShell.y, clamp((aKm / 6371. - 1.045) / .05, 0., 1.));
  return uRot * (shell * vec3(dir.y, dir.z, dir.x));   // globe frame: x = east at lon 90, y = north, z = lon 0
}
float depthOf(vec3 v){ return clamp(.5 + .5 * v.z / max(length(v), .001), 0., 1.); }
// hidden behind the Earth's disc, dimmer far away, fading out before the canvas edge
float visAt(vec3 v){
  float rho = length(v.xy);
  float vis = v.z < 0. ? smoothstep(.985, 1.03, rho) : 1.;
  vis *= mix(.4, 1., depthOf(v));
  vis *= 1. - smoothstep(uHalf * .94, uHalf * .99, rho);
  // the shell is a halo around the globe: it fades out well before the text column, and is denser near the limb than far out
  vis *= (1. - smoothstep(1.35, 1.85, rho)) * mix(1., .5, smoothstep(1.15, 1.6, rho));
  return vis;
}
`

const SAT_VS = `#version 300 es
precision highp float;
in vec4 aA;   // inclination, RAAN at epoch, argument of latitude at epoch, rate (rad/s)
in float aB;  // rate of the rate (drag), rad/s^2
uniform float uThin;
${COMMON}
${SATLIB}
out float vA; out float vDim; out vec2 vOff; out float vS;
void main(){
  vA = 0.; vDim = 1.; vS = 1.;
  gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 1.;
  if (uThin > 1. && mod(float(gl_VertexID), uThin) > .5) return;
  vec3 v = satView(aA, aB, uT);
  vec2 px = .5 * uRes + v.xy * uR;
  vDim = dimAt(px);
  if (uPtr.z > 0.) px += pushAt(px);
  // off the grid: the sprite sits on the nearest whole pixel, the dot is drawn at the exact sub-pixel position inside it
  vec2 c = floor(px) + .5;
  vOff = px - c;
  vS = mix(.7, 1.2, depthOf(v));
  vA = visAt(v) * uAlpha * vDim;
  gl_Position = vec4(c / uRes * 2. - 1., 0., 1.);
  gl_PointSize = ceil(uPitch * .6) * 2. + 2.;
}`

const SAT_FS = `#version 300 es
precision highp float;
uniform float uPitch; uniform vec3 uInk;
in float vA; in float vDim; in vec2 vOff; in float vS;
out vec4 o;
void main(){
  if (vA <= 0.) discard;
  vec2 p = (gl_PointCoord - .5) * (ceil(uPitch * .6) * 2. + 2.);
  p.y = -p.y;
  float d = length(p - vOff);
  // a '+': two thin strokes, crisp at any pixel ratio; size and strength come from depth
  vec2 q = abs(p - vOff);
  float L = max(1.5, uPitch * .17) * vS * (.5 + .5 * vDim);
  float a = (1. - smoothstep(.35, .95, min(q.x, q.y))) * (1. - smoothstep(L, L + .8, max(q.x, q.y))) * vA;
  o = vec4(uInk * a, a);
}`

// Trails: each satellite's path over the last uTrail seconds, TRAIL_N segments, drawn as 1 px lines (instanced, one instance per
// satellite; the two ends of each segment are the same elements evaluated at t - age). Fading towards the tail.
const TRAIL_N = 5
const TRAIL_VS = `#version 300 es
precision highp float;
in vec4 aA; in float aB;
uniform float uThin; uniform float uTrail;
${COMMON}
${SATLIB}
out float vA;
void main(){
  vA = 0.;
  gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 1.;
  // only a subset of the satellites leave a trail, a few specks behind them along their orbit (a short curved arc, not a line)
  if (mod(float(gl_InstanceID), uThin) > .5) return;
  float f = float(gl_VertexID + 1) / ${TRAIL_N}.;
  vec3 v = satView(aA, aB, uT - f * uTrail);
  vec2 px = .5 * uRes + v.xy * uR;
  float dim = dimAt(px);
  if (uPtr.z > 0.) px += pushAt(px);
  vA = visAt(v) * uAlpha * dim * (1. - f) * .9;
  gl_Position = vec4((floor(px) + .5) / uRes * 2. - 1., 0., 1.);
  gl_PointSize = max(2., uPitch * .24) * mix(1., .6, f);
}`
const LINE_FS = `#version 300 es
precision highp float;
uniform vec3 uInk;
in float vA;
out vec4 o;
void main(){ if (vA <= .002) discard; float d = length(gl_PointCoord - .5) * 2.; float a = vA * (1. - smoothstep(.55, 1., d)); o = vec4(uInk * a, a); }`

// Mesh pings: soft comets gliding from one satellite to the next (chosen on the CPU from a precomputed neighbour table; chains of 1 to 4
// hops). Both ends are evaluated here from their elements, so the comet stays attached as they move. No line is drawn: a bright soft head
// with a quickly fading tail (point sprites, sub-pixel positions), eased in and out, and a small bloom on the receiving satellite.
const PING_MAX = 16
const PING_SEG = 7
const PING_VS = `#version 300 es
precision highp float;
uniform vec4 uPA[${PING_MAX}]; uniform float uPAd[${PING_MAX}];
uniform vec4 uPB[${PING_MAX}]; uniform float uPBd[${PING_MAX}];
uniform vec2 uPT[${PING_MAX}];   // start, duration (seconds on the page clock)
uniform float uNowP; uniform float uHead;   // uHead 0: comet points, 1: bloom at the receiver
${COMMON}
${SATLIB}
out float vA;
void main(){
  vA = 0.;
  gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 1.;
  vec2 w = uPT[gl_InstanceID];
  float f = (uNowP - w.x) / max(w.y, .001);
  if (w.y <= 0. || f < 0. || f > 1.3) return;
  vec3 a = satView(uPA[gl_InstanceID], uPAd[gl_InstanceID], uT);
  vec3 b = satView(uPB[gl_InstanceID], uPBd[gl_InstanceID], uT);
  float tr = clamp(f, 0., 1.);
  float s = tr * tr * (3. - 2. * tr);
  float env = smoothstep(0., .2, f) * (1. - smoothstep(.78, 1., f));
  float base = max(3., uPitch * .38);
  vec3 v; float al; float sz;
  if (uHead < .5) {
    float j = float(gl_VertexID) / ${PING_SEG - 1}.;
    v = mix(a, b, max(s - .3 * (1. - j), 0.));
    al = pow(j, 3.2) * env * .55;
    sz = base * mix(.6, 1.3, j);
  } else {
    if (gl_VertexID != 0) return;
    v = b;
    al = .2 * smoothstep(.82, 1., f) * (1. - smoothstep(1., 1.3, f));
    sz = base * 1.6;
  }
  vec2 px = .5 * uRes + v.xy * uR;
  float dim = dimAt(px);
  if (uPtr.z > 0.) px += pushAt(px);
  vA = visAt(v) * uAlpha * dim * al;
  gl_Position = vec4(px / uRes * 2. - 1., 0., 1.);
  gl_PointSize = sz;
}`
const PING_FS = `#version 300 es
precision highp float;
uniform vec3 uInk;
in float vA;
out vec4 o;
void main(){
  if (vA <= .002) discard;
  float d = length(gl_PointCoord - .5) * 2.;
  float a = vA * exp(-d * d * 3.4) * (1. - smoothstep(.8, 1., d));
  o = vec4(uInk * a, a);
}`

// Programs a canvas never uses are compiled as empty stand-ins: shader compilation is the slow part of start-up on software GL.
const DUMMY_VS = `#version 300 es\nvoid main(){ gl_Position = vec4(2.); }`
const DUMMY_FS = `#version 300 es\nprecision lowp float; out vec4 o; void main(){ o = vec4(0.); }`

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
  return s
}

/** Land mask (1024x512, red channel) from the polygon rings. */
function landCanvas(rings: Ring[]): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, 1024, 512)
  g.fillStyle = '#fff'
  for (const r of rings) {
    g.beginPath()
    for (let i = 0; i < r.length; i += 2) {
      const x = ((r[i] + 180) / 360) * 1024
      const y = ((90 - r[i + 1]) / 180) * 512
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.closePath()
    g.fill()
  }
  return c
}

export interface PingSet {
  count: number
  /** per ping: 4 floats of elements A, B (inc, raan, u, udot), drag A, B, start and duration */
  a: Float32Array
  ad: Float32Array
  b: Float32Array
  bd: Float32Array
  t: Float32Array
  /** the page clock, seconds, same origin as `t` */
  now: number
}

export interface DrawExtra {
  /** Drawn orbit radius range in globe radii (exaggerated; see SATLIB). */
  shell?: [number, number]
  /** Trail length in seconds (0 = no trails). */
  trailSeconds?: number
  pings?: PingSet
  /** 0..1 cross-fade from the previous text mask to the current one. */
  maskMix?: number
  /** CSS opacity the globe is meant to have (the canvas itself is drawn at full opacity). */
  globeA?: number
  /** Seconds since the satellite reference epoch, and Greenwich sidereal angle (rad) now. */
  satT?: number
  gmst?: number
  /** 0..1 fade for the constellation. */
  satAlpha?: number
  /** Keep every n-th satellite (small canvases). */
  satThin?: number
  /** Pointer in canvas px (origin bottom-left) and strength 0..1; omitted or 0 = no push (and no shader cost). */
  ptr?: { x: number; y: number; k: number }
  /** Push radius and maximum displacement, canvas px. */
  push?: { radius: number; max: number }
  /** Velocity of the pointer field, canvas px (the wake). */
  wake?: [number, number]
}

export interface GlobeRenderer {
  resize(cssSize: number, dpr: number): void
  /** Satellite elements (5 floats each, see lib/starlink/orbit.mjs) or null to remove them. */
  setSatellites(data: Float32Array | null): void
  draw(lat0: number, lon0: number, extra?: DrawExtra): void
  /** Boxes (canvas px, origin bottom-left: x0, y0, x1, y1) behind which the dots thin out, with the factor that remains (0..1). */
  /** Text halo mask (single-channel in red, canvas px / 4). `fade` keeps the previous one for a cross-fade (draw `maskMix`). */
  setMask(mask: HTMLCanvasElement | null, fade: boolean): void
  destroy(): void
  /** Debug probe: whether the context is alive and the last GL error (0 = none). Used by scripts/hero-smoke.mjs through window.__hero. */
  probe(): { lost: boolean; error: number }
}

/** Returns null when WebGL2 is unavailable or setup fails (the caller shows the static image instead). */
/**
 * role 'globe': the dot-matrix sphere, on a canvas the size of the globe box at the device pixel ratio.
 * role 'shell': the satellite shell (dots, trails, pings) on a larger canvas at low resolution (HeroGlobe.tsx
 * sizes both). The two are aligned through the same rotation and a shared box centre.
 */
export function createRenderer(canvas: HTMLCanvasElement, rings: Ring[] | null, palette: Palette = LIGHT, role: 'globe' | 'shell' = 'globe'): GlobeRenderer | null {
  let gl: WebGL2RenderingContext | null = null
  try {
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: true })
  } catch {
    gl = null
  }
  if (!gl) return null
  try {
    const g = gl
    const prog = g.createProgram()!
    g.attachShader(prog, compile(g, g.VERTEX_SHADER, VS))
    g.attachShader(prog, compile(g, g.FRAGMENT_SHADER, role === 'globe' ? FS : DUMMY_FS))
    g.linkProgram(prog)
    if (!g.getProgramParameter(prog, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(prog) ?? 'link')

    const sprog = g.createProgram()!
    g.attachShader(sprog, compile(g, g.VERTEX_SHADER, role === 'shell' ? SAT_VS : DUMMY_VS))
    g.attachShader(sprog, compile(g, g.FRAGMENT_SHADER, role === 'shell' ? SAT_FS : DUMMY_FS))
    g.bindAttribLocation(sprog, 0, 'aA')
    g.bindAttribLocation(sprog, 1, 'aB')
    g.linkProgram(sprog)
    if (!g.getProgramParameter(sprog, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(sprog) ?? 'link')
    const mk = (vs: string, fs: string, attribs: boolean) => {
      const pr = g.createProgram()!
      g.attachShader(pr, compile(g, g.VERTEX_SHADER, vs))
      g.attachShader(pr, compile(g, g.FRAGMENT_SHADER, fs))
      if (attribs) {
        g.bindAttribLocation(pr, 0, 'aA')
        g.bindAttribLocation(pr, 1, 'aB')
      }
      g.linkProgram(pr)
      if (!g.getProgramParameter(pr, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(pr) ?? 'link')
      return pr
    }
    const COMMON_U = ['uT', 'uGmst', 'uRot', 'uRes', 'uR', 'uPitch', 'uShell', 'uHalf', 'uAlpha', 'uInk', 'uMaskA', 'uMaskB', 'uMaskMix', 'uMaskScale', 'uPtr', 'uPush', 'uWake']
    const uloc = (pr: WebGLProgram, more: string[]) => {
      const o: Record<string, WebGLUniformLocation | null> = {}
      for (const n of [...COMMON_U, ...more]) o[n] = g.getUniformLocation(pr, n)
      return o
    }
    const sl = uloc(sprog, ['uThin'])
    const tprog = role === 'shell' ? mk(TRAIL_VS, LINE_FS, true) : mk(DUMMY_VS, DUMMY_FS, true)
    const tl = uloc(tprog, ['uThin', 'uTrail'])
    const qprog = role === 'shell' ? mk(PING_VS, PING_FS, false) : mk(DUMMY_VS, DUMMY_FS, false)
    const ql = uloc(qprog, ['uPA[0]', 'uPAd[0]', 'uPB[0]', 'uPBd[0]', 'uPT[0]', 'uNowP', 'uHead'])
    const makeTex = (src: TexImageSource, wrapS: number, mips = false) => {
      const t = g.createTexture()!
      g.bindTexture(g.TEXTURE_2D, t)
      g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src)
      if (mips) g.generateMipmap(g.TEXTURE_2D)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, mips ? g.LINEAR_MIPMAP_LINEAR : g.LINEAR)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, wrapS)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
      return t
    }
    const svao = g.createVertexArray()!
    const tvao = g.createVertexArray()!
    const sbuf = g.createBuffer()!
    let satCount = 0

    const maskScale = role === 'shell' ? SHELL_SCALE : 1
    const tex = g.createTexture()!
    g.bindTexture(g.TEXTURE_2D, tex)
    if (rings) g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, landCanvas(rings))
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.REPEAT)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
    const vao = g.createVertexArray()!

    const U = (n: string) => g.getUniformLocation(prog, n)
    const u = { res: U('uRes'), r: U('uR'), pitch: U('uPitch'), rot: U('uRot'), land: U('uLand'), ink: U('uInk'), globeA: U('uGlobeA'), maskA: U('uMaskA'), maskB: U('uMaskB'), maskMix: U('uMaskMix'), maskScale: U('uMaskScale'), ptr: U('uPtr'), push: U('uPush'), wake: U('uWake') }
    const blank = g.createTexture()!
    g.bindTexture(g.TEXTURE_2D, blank)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 1, 1, 0, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
    let maskPrev: WebGLTexture = blank
    let maskCur: WebGLTexture = blank
    const freeMask = (t: WebGLTexture) => {
      if (t !== blank && t !== maskPrev && t !== maskCur) g.deleteTexture(t)
    }
    const bindMasks = (loc: { a: WebGLUniformLocation | null; b: WebGLUniformLocation | null; mix: WebGLUniformLocation | null; s: WebGLUniformLocation | null }, mix: number) => {
      g.uniform1f(loc.s, maskScale)
      g.uniform1i(loc.a, 3)
      g.uniform1i(loc.b, 4)
      g.uniform1f(loc.mix, mix)
    }
    let px = 1
    let pitch = 5
    g.enable(g.BLEND)
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA)

    return {
      resize(size, dpr) {
        px = Math.max(1, Math.round(size * dpr))
        // A whole number of device pixels per cell: the grid never lands between pixels, so nothing shimmers.
        pitch = Math.max(3, Math.round(6 * dpr))
        // Assigning canvas.width / height clears the bitmap, so only do it when the pixel size really changes (iOS fires resize
        // observers when the toolbar collapses; a cleared canvas there shows as a flash until the next frame).
        if (canvas.width !== px || canvas.height !== px) {
          canvas.width = px
          canvas.height = px
        }
        g.viewport(0, 0, px, px)
      },
      setMask(mask, fade) {
        const old = [maskPrev, maskCur]
        if (!mask) {
          maskPrev = maskCur = blank
        } else {
          const t = g.createTexture()!
          g.bindTexture(g.TEXTURE_2D, t)
          g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
          g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, mask)
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
          g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
          maskPrev = fade ? maskCur : t
          maskCur = t
        }
        for (const t of old) freeMask(t)
      },
      setSatellites(data) {
        if (!data || data.length < 5) {
          satCount = 0
          return
        }
        satCount = Math.floor(data.length / 5)
        g.bindVertexArray(svao)
        g.bindBuffer(g.ARRAY_BUFFER, sbuf)
        g.bufferData(g.ARRAY_BUFFER, data, g.STATIC_DRAW)
        g.enableVertexAttribArray(0)
        g.vertexAttribPointer(0, 4, g.FLOAT, false, 20, 0)
        g.enableVertexAttribArray(1)
        g.vertexAttribPointer(1, 1, g.FLOAT, false, 20, 16)
        // the same buffer, one instance per satellite, for the trails
        g.bindVertexArray(tvao)
        g.bindBuffer(g.ARRAY_BUFFER, sbuf)
        g.enableVertexAttribArray(0)
        g.vertexAttribPointer(0, 4, g.FLOAT, false, 20, 0)
        g.vertexAttribDivisor(0, 1)
        g.enableVertexAttribArray(1)
        g.vertexAttribPointer(1, 1, g.FLOAT, false, 20, 16)
        g.vertexAttribDivisor(1, 1)
        g.bindVertexArray(null)
      },
      draw(lat0, lon0, extra = {}) {
        const rot = rotation(lat0, lon0)
        const R = (px * 0.5 * SPHERE_FRACTION) / maskScale
        g.clearColor(0, 0, 0, 0)
        g.clear(g.COLOR_BUFFER_BIT)
        g.useProgram(prog)
        g.uniform2f(u.res, px, px)
        g.uniform1f(u.r, R)
        g.uniform1f(u.pitch, pitch)
        g.uniformMatrix3fv(u.rot, false, rot)
        g.activeTexture(g.TEXTURE3)
        g.bindTexture(g.TEXTURE_2D, maskPrev)
        g.activeTexture(g.TEXTURE4)
        g.bindTexture(g.TEXTURE_2D, maskCur)
        g.activeTexture(g.TEXTURE0)
        bindMasks({ a: u.maskA, b: u.maskB, mix: u.maskMix, s: u.maskScale }, extra.maskMix ?? 1)
        const ptr = extra.ptr && extra.ptr.k > 0 ? extra.ptr : null
        const push = extra.push ?? { radius: 130, max: 14 }
        const wake = extra.wake ?? [0, 0]
        g.uniform3f(u.ptr, ptr?.x ?? 0, ptr?.y ?? 0, ptr?.k ?? 0)
        g.uniform2f(u.push, push.radius, push.max)
        g.uniform2f(u.wake, wake[0], wake[1])
        g.uniform1f(u.globeA, extra.globeA ?? 1)
        g.uniform3fv(u.ink, palette.ink)
        g.activeTexture(g.TEXTURE0)
        g.bindTexture(g.TEXTURE_2D, tex)
        g.uniform1i(u.land, 0)
        if (role === 'globe') {
          g.bindVertexArray(vao)
          g.drawArrays(g.TRIANGLES, 0, 3)
          g.bindVertexArray(null)
        }
        if (satCount > 0 && (extra.satAlpha ?? 0) > 0.003) {
          const alphaBase = (extra.satAlpha ?? 0) * (extra.globeA ?? 1)
          const common = (l: Record<string, WebGLUniformLocation | null>, alpha: number) => {
            g.uniform1f(l.uT, extra.satT ?? 0)
            g.uniform1f(l.uGmst, extra.gmst ?? 0)
            g.uniformMatrix3fv(l.uRot, false, rot)
            g.uniform2f(l.uRes, px, px)
            g.uniform1f(l.uR, R)
            g.uniform1f(l.uPitch, pitch)
            const sh = extra.shell ?? [1.9, 2.3]
            g.uniform2f(l.uShell, sh[0], sh[1])
            g.uniform1f(l.uHalf, (0.5 * px) / R)
            g.uniform1f(l.uAlpha, alpha)
            g.uniform3fv(l.uInk, palette.ink)
            bindMasks({ a: l.uMaskA, b: l.uMaskB, mix: l.uMaskMix, s: l.uMaskScale }, extra.maskMix ?? 1)
            g.uniform3f(l.uPtr, ptr?.x ?? 0, ptr?.y ?? 0, ptr?.k ?? 0)
            g.uniform2f(l.uPush, push.radius, push.max)
            g.uniform2f(l.uWake, wake[0], wake[1])
          }
          g.useProgram(sprog)
          common(sl, alphaBase)
          g.uniform1f(sl.uThin, extra.satThin ?? 1)
          g.bindVertexArray(svao)
          g.drawArrays(g.POINTS, 0, satCount)
          if ((extra.trailSeconds ?? 0) > 0) {
            g.useProgram(tprog)
            common(tl, alphaBase * 0.75)
            g.uniform1f(tl.uThin, (extra.satThin ?? 1) * 3)
            g.uniform1f(tl.uTrail, extra.trailSeconds ?? 0)
            g.bindVertexArray(tvao)
            g.drawArraysInstanced(g.POINTS, 0, TRAIL_N, satCount)
          }
          const pg = extra.pings
          if (pg && pg.count > 0) {
            g.useProgram(qprog)
            common(ql, Math.min(1, alphaBase * 1.1))
            g.uniform4fv(ql['uPA[0]'], pg.a)
            g.uniform1fv(ql['uPAd[0]'], pg.ad)
            g.uniform4fv(ql['uPB[0]'], pg.b)
            g.uniform1fv(ql['uPBd[0]'], pg.bd)
            g.uniform2fv(ql['uPT[0]'], pg.t)
            g.uniform1f(ql.uNowP, pg.now)
            g.bindVertexArray(svao)
            g.uniform1f(ql.uHead, 0)
            g.drawArraysInstanced(g.POINTS, 0, PING_SEG, pg.count)
            g.uniform1f(ql.uHead, 1)
            g.drawArraysInstanced(g.POINTS, 0, 1, pg.count)
          }
          g.bindVertexArray(null)
        }
      },
      destroy() {
        g.getExtension('WEBGL_lose_context')?.loseContext()
      },
      probe() {
        return { lost: g.isContextLost(), error: g.getError() }
      },
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.warn('globe renderer failed:', e)
    return null
  }
}
