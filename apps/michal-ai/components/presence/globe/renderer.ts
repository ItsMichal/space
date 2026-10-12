// WebGL2 renderer for the background dot globe. One canvas, one program, transparent: the page shows through.
// Land is an equal-area (Fibonacci sphere) point set filtered against the Natural Earth land mask, so there are no polar
// convergence streaks. Each dot is an instanced quad; size and alpha fall off toward the limb, back-facing dots are not drawn.
// No coastline, graticule, rim or fill. Single ink colour.
import { toVec } from '@/lib/presence/geo'
import type { Ring } from './data'

export interface Palette {
  ink: [number, number, number]
}
export const LIGHT: Palette = { ink: [0.13, 0.13, 0.11] }

/** Column-major 3x3: world -> view. Centres (lat0, lon0): rotate about Y by -lon0, then about X by +lat0. */
export function rotation(lat0: number, lon0: number): Float32Array {
  const a = (-lon0 * Math.PI) / 180
  const b = (lat0 * Math.PI) / 180
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  const cb = Math.cos(b)
  const sb = Math.sin(b)
  const m = [
    [ca, 0, sa],
    [sb * sa, cb, -sb * ca],
    [-cb * sa, sb, cb * ca],
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

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;   // -1..1
layout(location=1) in vec3 aPos;      // unit vector, world space
uniform mat3 uRot; uniform vec2 uRes; uniform float uR; uniform float uDpr; uniform float uDot;
out vec2 vC; out float vA;
void main(){
  vec3 p = uRot*aPos;
  float z = p.z;
  float vis = smoothstep(0.02, 0.5, z);           // fades out toward the limb, nothing on the far side
  float size = uDot*uDpr*(0.45 + 0.55*smoothstep(0.0, 0.9, z));
  vec2 px = p.xy*uR + aCorner*(size*0.5 + 1.0);
  gl_Position = vec4(px/(.5*uRes), 0., 1.);
  vC = aCorner*(size*0.5 + 1.0); vA = vis; vSize = size;
}`
// (vSize declared below via replace to keep the template readable)
const VS_FIXED = VS.replace('out vec2 vC; out float vA;', 'out vec2 vC; out float vA; out float vSize;')

const FS = `#version 300 es
precision highp float;
uniform vec3 uInk;
in vec2 vC; in float vA; in float vSize;
out vec4 o;
void main(){
  float d = length(vC);
  float a = (1. - smoothstep(vSize*.5 - .5, vSize*.5 + .5, d)) * vA;
  o = vec4(uInk*a, a);
}`

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
  return s
}

/** Land mask as pixel data (1024x512, red channel), from the polygon rings. */
function landMask(rings: Ring[]): Uint8ClampedArray {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 512
  const g = c.getContext('2d', { willReadFrequently: true })!
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
  return g.getImageData(0, 0, 1024, 512).data
}

/** Equal-area land points (unit vectors). N total points on the sphere, about 30% land. */
export function landPoints(rings: Ring[], n = 22000): Float32Array {
  const mask = landMask(rings)
  const out: number[] = []
  const golden = 137.50776405
  for (let i = 0; i < n; i++) {
    const lat = (Math.asin(1 - (2 * (i + 0.5)) / n) * 180) / Math.PI
    const lon = ((i * golden) % 360) - 180
    const x = Math.min(1023, Math.floor(((lon + 180) / 360) * 1024))
    const y = Math.min(511, Math.floor(((90 - lat) / 180) * 512))
    if (mask[(y * 1024 + x) * 4] < 128) continue
    if (lat < -60) continue // Antarctica reads as noise at this size
    const v = toVec(lat, lon)
    out.push(v[0], v[1], v[2])
  }
  return new Float32Array(out)
}

export interface GlobeRenderer {
  resize(cssSize: number, dpr: number): void
  draw(lat0: number, lon0: number): void
  destroy(): void
}

/** Fraction of the canvas half-size used by the sphere. */
export const SPHERE_FRACTION = 0.96

/** Returns null when WebGL2 is unavailable or setup fails (the caller shows the static drawing instead). */
export function createRenderer(canvas: HTMLCanvasElement, rings: Ring[], palette: Palette = LIGHT): GlobeRenderer | null {
  let gl: WebGL2RenderingContext | null = null
  try {
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' })
  } catch {
    gl = null
  }
  if (!gl) return null
  try {
    const g = gl
    const prog = g.createProgram()!
    g.attachShader(prog, compile(g, g.VERTEX_SHADER, VS_FIXED))
    g.attachShader(prog, compile(g, g.FRAGMENT_SHADER, FS))
    g.linkProgram(prog)
    if (!g.getProgramParameter(prog, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(prog) ?? 'link')

    const pts = landPoints(rings)
    const count = pts.length / 3
    const vao = g.createVertexArray()!
    g.bindVertexArray(vao)
    const corners = g.createBuffer()!
    g.bindBuffer(g.ARRAY_BUFFER, corners)
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, -1, 1, 1]), g.STATIC_DRAW)
    g.enableVertexAttribArray(0)
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0)
    const inst = g.createBuffer()!
    g.bindBuffer(g.ARRAY_BUFFER, inst)
    g.bufferData(g.ARRAY_BUFFER, pts, g.STATIC_DRAW)
    g.enableVertexAttribArray(1)
    g.vertexAttribPointer(1, 3, g.FLOAT, false, 0, 0)
    g.vertexAttribDivisor(1, 1)
    g.bindVertexArray(null)

    const U = (n: string) => g.getUniformLocation(prog, n)
    const u = { rot: U('uRot'), res: U('uRes'), r: U('uR'), dpr: U('uDpr'), dot: U('uDot'), ink: U('uInk') }
    let px = 1
    let dprNow = 1
    let cssSize = 1
    g.enable(g.BLEND)
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA)

    return {
      resize(size, dpr) {
        dprNow = dpr
        cssSize = size
        px = Math.max(1, Math.round(size * dpr))
        canvas.width = px
        canvas.height = px
        g.viewport(0, 0, px, px)
      },
      draw(lat0, lon0) {
        g.clearColor(0, 0, 0, 0)
        g.clear(g.COLOR_BUFFER_BIT)
        g.useProgram(prog)
        g.uniformMatrix3fv(u.rot, false, rotation(lat0, lon0))
        g.uniform2f(u.res, px, px)
        g.uniform1f(u.r, px * 0.5 * SPHERE_FRACTION)
        g.uniform1f(u.dpr, dprNow)
        // dot diameter in CSS px grows gently with the globe so it keeps the same look from 300 to 900 px
        g.uniform1f(u.dot, Math.max(1.1, Math.min(2.3, cssSize / 260)))
        g.uniform3fv(u.ink, palette.ink)
        g.bindVertexArray(vao)
        g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, count)
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
