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

const VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position = vec4(p*2.-1., 0., 1.); }`

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uR; uniform float uPitch; uniform mat3 uRot; uniform sampler2D uLand;
uniform vec3 uInk; uniform vec3 uAccent; uniform vec2 uHomeCell; uniform float uHomeVis;
uniform vec4 uBox[3]; uniform float uDim[3]; uniform float uFeather;
out vec4 o;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 cell = floor(gl_FragCoord.xy / uPitch);
  vec2 centre = (cell + .5) * uPitch;
  vec2 local = gl_FragCoord.xy - centre;
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
    float rad = uPitch * (.06 + .30 * lum);
    float d = length(local);
    float a = (1. - smoothstep(rad - .55, rad + .55, d)) * limb;
    a *= .86 + .14 * h2(cell);                 // the faintest per-cell variation
    // dots thin out behind the text blocks (boxes in canvas px, measured on resize only), softly, so text keeps its contrast
    float dimf = 1.;
    for (int i = 0; i < 3; i++) {
      vec2 dd = max(uBox[i].xy - centre, centre - uBox[i].zw);
      dimf *= mix(uDim[i], 1., smoothstep(0., uFeather, length(max(dd, 0.))));
    }
    a *= dimf;
    vec3 c = uInk;
    if (uHomeVis > .5 && cell == uHomeCell) {
      float ra = uPitch * .42;
      a = (1. - smoothstep(ra - .55, ra + .55, d)) * limb;
      c = uAccent;
    }
    col = vec4(c * a, a);
  }
  o = col;
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

export interface GlobeRenderer {
  resize(cssSize: number, dpr: number): void
  draw(lat0: number, lon0: number, home?: { lat: number; lon: number } | null): void
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

    const tex = g.createTexture()!
    g.bindTexture(g.TEXTURE_2D, tex)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, landCanvas(rings))
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.REPEAT)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
    const vao = g.createVertexArray()!

    const U = (n: string) => g.getUniformLocation(prog, n)
    const u = { res: U('uRes'), r: U('uR'), pitch: U('uPitch'), rot: U('uRot'), land: U('uLand'), ink: U('uInk'), accent: U('uAccent'), homeCell: U('uHomeCell'), homeVis: U('uHomeVis'), box: U('uBox[0]'), dim: U('uDim[0]'), feather: U('uFeather') }
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
      draw(lat0, lon0, home) {
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
      },
      destroy() {
        g.getExtension('WEBGL_lose_context')?.loseContext()
      },
    }
  } catch {
    return null
  }
}
