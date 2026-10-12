// WebGL2 renderer for the hero background globe: a screen-space dot matrix over an analytically rendered sphere.
// One canvas, one fullscreen triangle, transparent. The sphere has no colour or texture of its own: each cell of a fixed pixel
// grid (snapped to whole device pixels, so it never shimmers) samples the sphere at the cell centre, turns land / lambert shading /
// limb falloff into a luminance, and draws one round dot whose radius follows it. The globe rotates underneath a stationary
// matrix. Dots are the hero's ink colour; the page behind shows through. The only other colour is the Hawthorne cell.
import { toVec } from '@/lib/presence/geo'
import type { Ring } from './data'

export interface Palette {
  ink: [number, number, number]
  accent: [number, number, number]
}
export const LIGHT: Palette = { ink: [0.13, 0.13, 0.11], accent: [0.24, 0.42, 0.21] }

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
export const SPHERE_FRACTION = 0.94

// Shared by the land pass and the satellite pass: text-aware dimming and the pointer push. Boxes are in canvas px.
const COMMON = `
uniform vec4 uBox[3]; uniform float uDim[3]; uniform float uFeather;
uniform vec3 uPtr;    // pointer x, y (canvas px, origin bottom-left), strength 0..1 (0 = idle: the push code is skipped)
uniform vec2 uPush;   // radius px, maximum displacement px
// how much of the alpha stays at a point: 1 in the open, uDim[i] inside box i, easing back over uFeather
float dimAt(vec2 c){
  float f = 1.;
  for (int i = 0; i < 3; i++) {
    vec2 dd = max(uBox[i].xy - c, c - uBox[i].zw);
    f *= mix(uDim[i], 1., smoothstep(0., uFeather, length(max(dd, 0.))));
  }
  return f;
}
// symbols part around the pointer: radial, gaussian falloff, no jump at the centre
vec2 pushAt(vec2 c){
  vec2 d = c - uPtr.xy;
  float l2 = dot(d, d);
  float r = uPush.x;
  return d * inversesqrt(l2 + .0225 * r * r) * uPush.y * uPtr.z * exp(-l2 / (r * r));
}
`

const VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position = vec4(p*2.-1., 0., 1.); }`

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uR; uniform float uPitch; uniform mat3 uRot; uniform sampler2D uLand;
uniform vec3 uInk; uniform vec3 uAccent; uniform vec2 uHomeCell; uniform float uHomeVis; uniform float uGlobeA;
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
    // dots thin out behind the text blocks (boxes in canvas px), softly: they shrink and fade over a few cells, so text keeps its contrast
    float dimf = dimAt(centre);
    float rad = uPitch * (.06 + .30 * lum) * (.5 + .5 * dimf);
    float d = length(local);
    float a = (1. - smoothstep(rad - .55, rad + .55, d)) * limb;
    a *= .86 + .14 * h2(cell);                 // the faintest per-cell variation
    a *= dimf;
    vec3 c = uInk;
    if (uHomeVis > .5 && cell == uHomeCell) {
      float ra = uPitch * .42;
      a = (1. - smoothstep(ra - .55, ra + .55, d)) * limb;
      c = uAccent;
    }
    a *= uGlobeA;
    col = vec4(c * a, a);
  }
  o = col;
}`


// Satellite pass: one GL point per satellite, propagated here (mirror of lib/starlink/orbit.mjs positionEcef). The point is snapped
// to the same cell grid as the land dots and drawn as one small round dot, so it reads as part of the same dot matrix.
const SAT_VS = `#version 300 es
precision highp float;
in vec4 aA;   // inclination, RAAN at epoch, argument of latitude at epoch, rate (rad/s)
in float aB;  // rate of the rate (drag), rad/s^2
uniform float uT; uniform float uGmst; uniform mat3 uRot; uniform vec2 uRes; uniform float uR; uniform float uPitch;
uniform float uThin; uniform float uAlpha;
${COMMON}
out float vA; out float vDim;
const float MU = 398600.8; const float RE = 6378.135; const float J2 = .001082616; const float TAU = 6.2831853;
void main(){
  vA = 0.; vDim = 1.;
  gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 1.;
  if (uThin > 1. && mod(float(gl_VertexID), uThin) > .5) return;
  float udot = aA.w;
  float aKm = pow(MU / (udot * udot), 1. / 3.);
  float k = J2 * (RE / aKm) * (RE / aKm);
  float raan = aA.y - 1.5 * k * udot * cos(aA.x) * uT - uGmst;
  float u = mod(aA.z + udot * uT + .5 * aB * uT * uT, TAU);
  float cu = cos(u), su = sin(u), cr = cos(raan), sr = sin(raan), ci = cos(aA.x);
  vec3 ecef = (aKm / 6371.) * vec3(cr * cu - sr * su * ci, sr * cu + cr * su * ci, su * sin(aA.x));
  vec3 v = uRot * vec3(ecef.y, ecef.z, ecef.x);   // globe frame: x = east at lon 90, y = north, z = lon 0
  float rho = length(v.xy);
  // hidden behind the Earth's disc; on the far side but outside the disc they stay, dimmer
  float vis = v.z < 0. ? smoothstep(.985, 1.03, rho) : 1.;
  vis *= mix(.5, 1., smoothstep(-.3, .3, v.z));
  vis *= 1. - smoothstep(1.04, 1.062, rho);          // inside the canvas margin
  vec2 px = .5 * uRes + v.xy * uR;
  vec2 c = (floor(px / uPitch) + .5) * uPitch;
  vDim = dimAt(c);
  if (uPtr.z > 0.) c += pushAt(c);
  vA = vis * uAlpha * vDim;
  gl_Position = vec4(c / uRes * 2. - 1., 0., 1.);
  gl_PointSize = uPitch;
}`

const SAT_FS = `#version 300 es
precision highp float;
uniform float uPitch; uniform vec3 uInk;
in float vA; in float vDim;
out vec4 o;
void main(){
  if (vA <= 0.) discard;
  float d = length((gl_PointCoord - .5) * uPitch);
  float rad = uPitch * .2 * (.5 + .5 * vDim);
  float a = (1. - smoothstep(rad - .55, rad + .55, d)) * vA;
  o = vec4(uInk * a, a);
}`

// Portrait pass: the owner's picture as monospace glyphs (or dots), chosen per cell by luminance, over the globe. Two draws in the
// same canvas: first a knockout (dst *= 1 - matte) so the globe and satellites give way behind him, then the glyphs. The cell grid is
// its own (any size, glyph aspect); the pointer pushes individual glyphs apart exactly like the globe's dots, only gentler.
const P_FS = `#version 300 es
precision highp float;
uniform sampler2D uPic; uniform sampler2D uAtlas;
uniform vec4 uRect; uniform vec4 uCrop; uniform vec2 uCell; uniform float uGlyphs;
uniform float uCircle; uniform float uMode; uniform float uStr; uniform float uDots; uniform float uEdge; uniform vec3 uInk;
${COMMON}
out vec4 o;
vec2 picUV(vec2 p){ vec2 t = (p - uRect.xy) / uRect.zw; t.y = 1. - t.y; return mix(uCrop.xy, uCrop.zw, t); }
float circ(vec2 p){
  if (uCircle < .5) return 1.;
  float d = length(p - (uRect.xy + .5 * uRect.zw)) / (.5 * min(uRect.z, uRect.w));
  return 1. - smoothstep(.78, 1., d);
}
void main(){
  vec2 f = gl_FragCoord.xy;
  vec2 rel = f - uRect.xy;
  if (rel.x < 0. || rel.y < 0. || rel.x > uRect.z || rel.y > uRect.w) discard;
  float edge = uEdge > 0. ? smoothstep(0., uEdge, rel.y) : 1.;
  if (uMode < .5) {
    float a = uCircle > .5 ? circ(f) : smoothstep(.12, .8, texture(uPic, picUV(f)).a);
    o = vec4(0., 0., 0., a * edge * uStr);
    return;
  }
  vec2 src = f;
  if (uPtr.z > 0.) { src -= pushAt(src); src = f - pushAt(src); }
  vec2 cell = floor((src - uRect.xy) / uCell);
  vec2 origin = uRect.xy + cell * uCell;
  vec2 centre = origin + .5 * uCell;
  vec2 local = f - origin;
  if (uPtr.z > 0.) local -= pushAt(centre);
  if (local.x < 0. || local.y < 0. || local.x >= uCell.x || local.y >= uCell.y) discard;
  vec2 q = .25 * uCell;
  vec4 s = texture(uPic, picUV(centre)) * .4 + .15 * (texture(uPic, picUV(centre + vec2(q.x, q.y))) + texture(uPic, picUV(centre + vec2(-q.x, q.y))) + texture(uPic, picUV(centre + vec2(q.x, -q.y))) + texture(uPic, picUV(centre + vec2(-q.x, -q.y))));
  float m = smoothstep(.3, .75, s.a) * circ(centre);
  if (m <= .01) discard;
  float lum = s.r / max(s.a, .001);
  float d = clamp(pow(1. - clamp(lum, 0., 1.), .8) * 1.5 + .05, 0., 1.);
  float cov;
  if (uDots > .5) {
    float r = min(uCell.x, uCell.y) * (.12 + .46 * d);
    cov = 1. - smoothstep(r - .5, r + .5, length(local - .5 * uCell));
  } else {
    float gi = floor(d * (uGlyphs - 1.) + .5);
    cov = texture(uAtlas, vec2((gi + local.x / uCell.x) / uGlyphs, 1. - local.y / uCell.y)).a;
  }
  float a = cov * m * uStr * dimAt(centre) * edge;
  o = vec4(uInk * a, a);
}`

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

export interface PortraitSpec {
  /** x, y (canvas px, origin bottom-left), width, height */
  rect: [number, number, number, number]
  /** texture crop u0, v0, u1, v1 (v from the top) */
  crop: [number, number, number, number]
  /** glyph cell, canvas px */
  cell: [number, number]
  circle: boolean
  /** density dots instead of glyphs */
  dots: boolean
  /** 0..1 */
  strength: number
  /** fade the bottom edge over this many canvas px (0 = hard) */
  edge: number
  /** pointer push for this layer, canvas px */
  push: { radius: number; max: number }
}

export interface DrawExtra {
  /** CSS opacity the globe is meant to have (the canvas itself is drawn at full opacity so the portrait can be stronger). */
  globeA?: number
  portrait?: PortraitSpec
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
}

export interface GlobeRenderer {
  resize(cssSize: number, dpr: number): void
  /** Satellite elements (5 floats each, see lib/starlink/orbit.mjs) or null to remove them. */
  setSatellites(data: Float32Array | null): void
  /** Portrait picture (luminance in rgb, matte in alpha) and its glyph atlas (n glyphs side by side, lightest first). */
  setPortrait(pic: ImageBitmap | null, atlas: HTMLCanvasElement | null, glyphs: number): void
  draw(lat0: number, lon0: number, home?: { lat: number; lon: number } | null, extra?: DrawExtra): void
  /** Boxes (canvas px, origin bottom-left: x0, y0, x1, y1) behind which the dots thin out, with the factor that remains (0..1). */
  setBoxes(boxes: { box: [number, number, number, number]; dim: number }[], feather: number): void
  destroy(): void
}

/** Returns null when WebGL2 is unavailable or setup fails (the caller shows the static image instead). */
export function createRenderer(canvas: HTMLCanvasElement, rings: Ring[], palette: Palette = LIGHT): GlobeRenderer | null {
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
    g.attachShader(prog, compile(g, g.FRAGMENT_SHADER, FS))
    g.linkProgram(prog)
    if (!g.getProgramParameter(prog, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(prog) ?? 'link')

    const sprog = g.createProgram()!
    g.attachShader(sprog, compile(g, g.VERTEX_SHADER, SAT_VS))
    g.attachShader(sprog, compile(g, g.FRAGMENT_SHADER, SAT_FS))
    g.bindAttribLocation(sprog, 0, 'aA')
    g.bindAttribLocation(sprog, 1, 'aB')
    g.linkProgram(sprog)
    if (!g.getProgramParameter(sprog, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(sprog) ?? 'link')
    const SU = (n: string) => g.getUniformLocation(sprog, n)
    const su = { t: SU('uT'), gmst: SU('uGmst'), rot: SU('uRot'), res: SU('uRes'), r: SU('uR'), pitch: SU('uPitch'), thin: SU('uThin'), alpha: SU('uAlpha'), ink: SU('uInk'), box: SU('uBox[0]'), dim: SU('uDim[0]'), feather: SU('uFeather'), ptr: SU('uPtr'), push: SU('uPush') }
    const pprog = g.createProgram()!
    g.attachShader(pprog, compile(g, g.VERTEX_SHADER, VS))
    g.attachShader(pprog, compile(g, g.FRAGMENT_SHADER, P_FS))
    g.linkProgram(pprog)
    if (!g.getProgramParameter(pprog, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(pprog) ?? 'link')
    const PU = (n: string) => g.getUniformLocation(pprog, n)
    const pu = { pic: PU('uPic'), atlas: PU('uAtlas'), rect: PU('uRect'), crop: PU('uCrop'), cell: PU('uCell'), glyphs: PU('uGlyphs'), circle: PU('uCircle'), mode: PU('uMode'), str: PU('uStr'), dots: PU('uDots'), edge: PU('uEdge'), ink: PU('uInk'), box: PU('uBox[0]'), dim: PU('uDim[0]'), feather: PU('uFeather'), ptr: PU('uPtr'), push: PU('uPush') }
    let picTex: WebGLTexture | null = null
    let atlasTex: WebGLTexture | null = null
    let atlasN = 1
    const makeTex = (src: TexImageSource, wrapS: number) => {
      const t = g.createTexture()!
      g.bindTexture(g.TEXTURE_2D, t)
      g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, wrapS)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
      return t
    }
    const svao = g.createVertexArray()!
    const sbuf = g.createBuffer()!
    let satCount = 0

    const tex = g.createTexture()!
    g.bindTexture(g.TEXTURE_2D, tex)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, landCanvas(rings))
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.REPEAT)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
    const vao = g.createVertexArray()!

    const U = (n: string) => g.getUniformLocation(prog, n)
    const u = { res: U('uRes'), r: U('uR'), pitch: U('uPitch'), rot: U('uRot'), land: U('uLand'), ink: U('uInk'), accent: U('uAccent'), globeA: U('uGlobeA'), homeCell: U('uHomeCell'), homeVis: U('uHomeVis'), box: U('uBox[0]'), dim: U('uDim[0]'), feather: U('uFeather'), ptr: U('uPtr'), push: U('uPush') }
    const boxes = new Float32Array(12)
    const dims = new Float32Array([1, 1, 1])
    let feather = 24
    let px = 1
    let pitch = 5
    g.enable(g.BLEND)
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA)

    return {
      resize(size, dpr) {
        px = Math.max(1, Math.round(size * dpr))
        // A whole number of device pixels per cell: the grid never lands between pixels, so nothing shimmers.
        pitch = Math.max(3, Math.round(6 * dpr))
        canvas.width = px
        canvas.height = px
        g.viewport(0, 0, px, px)
      },
      setBoxes(list, f) {
        boxes.fill(0)
        dims.fill(1)
        list.slice(0, 3).forEach((b, i) => {
          boxes.set(b.box, i * 4)
          dims[i] = b.dim
        })
        feather = f
      },
      setPortrait(pic, atlas, glyphs) {
        if (picTex) g.deleteTexture(picTex)
        if (atlasTex) g.deleteTexture(atlasTex)
        picTex = pic ? makeTex(pic, g.CLAMP_TO_EDGE) : null
        atlasTex = atlas ? makeTex(atlas, g.CLAMP_TO_EDGE) : null
        atlasN = Math.max(1, glyphs)
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
        g.bindVertexArray(null)
      },
      draw(lat0, lon0, home, extra = {}) {
        const rot = rotation(lat0, lon0)
        const R = px * 0.5 * SPHERE_FRACTION
        g.clearColor(0, 0, 0, 0)
        g.clear(g.COLOR_BUFFER_BIT)
        g.useProgram(prog)
        g.uniform2f(u.res, px, px)
        g.uniform1f(u.r, R)
        g.uniform1f(u.pitch, pitch)
        g.uniformMatrix3fv(u.rot, false, rot)
        g.uniform4fv(u.box, boxes)
        g.uniform1fv(u.dim, dims)
        g.uniform1f(u.feather, feather)
        const ptr = extra.ptr && extra.ptr.k > 0 ? extra.ptr : null
        const push = extra.push ?? { radius: 100, max: 14 }
        g.uniform3f(u.ptr, ptr?.x ?? 0, ptr?.y ?? 0, ptr?.k ?? 0)
        g.uniform2f(u.push, push.radius, push.max)
        g.uniform1f(u.globeA, extra.globeA ?? 1)
        g.uniform3fv(u.ink, palette.ink)
        g.uniform3fv(u.accent, palette.accent)
        let vis = 0
        if (home) {
          const p = projectPoint(home.lat, home.lon, rot)
          if (p.z > 0.25) {
            vis = 1
            g.uniform2f(u.homeCell, Math.floor((px / 2 + p.x * R) / pitch), Math.floor((px / 2 + p.y * R) / pitch))
          }
        }
        g.uniform1f(u.homeVis, vis)
        g.activeTexture(g.TEXTURE0)
        g.bindTexture(g.TEXTURE_2D, tex)
        g.uniform1i(u.land, 0)
        g.bindVertexArray(vao)
        g.drawArrays(g.TRIANGLES, 0, 3)
        g.bindVertexArray(null)
        if (satCount > 0 && (extra.satAlpha ?? 0) > 0.003) {
          g.useProgram(sprog)
          g.uniform1f(su.t, extra.satT ?? 0)
          g.uniform1f(su.gmst, extra.gmst ?? 0)
          g.uniformMatrix3fv(su.rot, false, rot)
          g.uniform2f(su.res, px, px)
          g.uniform1f(su.r, R)
          g.uniform1f(su.pitch, pitch)
          g.uniform1f(su.thin, extra.satThin ?? 1)
          g.uniform1f(su.alpha, (extra.satAlpha ?? 0) * (extra.globeA ?? 1))
          g.uniform3fv(su.ink, palette.ink)
          g.uniform4fv(su.box, boxes)
          g.uniform1fv(su.dim, dims)
          g.uniform1f(su.feather, feather)
          g.uniform3f(su.ptr, ptr?.x ?? 0, ptr?.y ?? 0, ptr?.k ?? 0)
          g.uniform2f(su.push, push.radius, push.max)
          g.bindVertexArray(svao)
          g.drawArrays(g.POINTS, 0, satCount)
          g.bindVertexArray(null)
        }
        const pt = extra.portrait
        if (pt && picTex && pt.strength > 0.003 && (pt.dots || atlasTex)) {
          g.useProgram(pprog)
          g.enable(g.SCISSOR_TEST)
          g.scissor(Math.floor(pt.rect[0]), Math.floor(pt.rect[1]), Math.ceil(pt.rect[2]) + 1, Math.ceil(pt.rect[3]) + 1)
          g.activeTexture(g.TEXTURE1)
          g.bindTexture(g.TEXTURE_2D, picTex)
          g.uniform1i(pu.pic, 1)
          g.activeTexture(g.TEXTURE2)
          g.bindTexture(g.TEXTURE_2D, atlasTex ?? picTex)
          g.uniform1i(pu.atlas, 2)
          g.uniform4f(pu.rect, ...pt.rect)
          g.uniform4f(pu.crop, ...pt.crop)
          g.uniform2f(pu.cell, pt.cell[0], pt.cell[1])
          g.uniform1f(pu.glyphs, atlasN)
          g.uniform1f(pu.circle, pt.circle ? 1 : 0)
          g.uniform1f(pu.str, pt.strength)
          g.uniform1f(pu.dots, pt.dots ? 1 : 0)
          g.uniform1f(pu.edge, pt.edge)
          g.uniform3fv(pu.ink, palette.ink)
          g.uniform4fv(pu.box, boxes)
          g.uniform1fv(pu.dim, dims)
          g.uniform1f(pu.feather, feather)
          g.uniform3f(pu.ptr, ptr?.x ?? 0, ptr?.y ?? 0, ptr?.k ?? 0)
          g.uniform2f(pu.push, pt.push.radius, pt.push.max)
          g.bindVertexArray(vao)
          g.blendFunc(g.ZERO, g.ONE_MINUS_SRC_ALPHA)
          g.uniform1f(pu.mode, 0)
          g.drawArrays(g.TRIANGLES, 0, 3)
          g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA)
          g.uniform1f(pu.mode, 1)
          g.drawArrays(g.TRIANGLES, 0, 3)
          g.bindVertexArray(null)
          g.disable(g.SCISSOR_TEST)
          g.activeTexture(g.TEXTURE0)
        }
      },
      destroy() {
        g.getExtension('WEBGL_lose_context')?.loseContext()
      },
    }
  } catch {
    return null
  }
}
