// Shared geometry for the lidar field: the point set, the terrain function and
// the camera. The WebGL2 vertex shader mirrors `terrain()` and `project()`
// exactly so the Canvas2D fallback draws the same picture.

export type RGB = [number, number, number] // 0..1

export interface FieldColors {
  dot: RGB
  ink: RGB
  accent: RGB
}

export interface FrameState {
  /** seconds of animation time */
  t: number
  /** scan plane enabled (off for the reduced-motion still) */
  scan: boolean
  /** pointer parallax, -1..1 */
  px: number
  py: number
  /** scroll parallax, CSS px */
  scrollY: number
  colors: FieldColors
}

export interface Renderer {
  resize(cssW: number, cssH: number, dpr: number): void
  draw(f: FrameState): void
  destroy(): void
}

// ---- point set --------------------------------------------------------------

export const COLS = 72
export const ROWS = 48
export const POINTS = COLS * ROWS // 2560
export const HALF_X = 11
export const HALF_Z = 10
export const TERRAIN_AMP = 1.4

/** Per-point: gx, gz in -1..1 (grid), jx, jz = jitter in cells. Deterministic. */
export function buildPoints(): Float32Array {
  const out = new Float32Array(POINTS * 4)
  let s = 1337
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  let k = 0
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      out[k++] = (c / (COLS - 1)) * 2 - 1
      out[k++] = (r / (ROWS - 1)) * 2 - 1
      out[k++] = (rnd() - 0.5) * 0.9 // jitter along the scan line (x)
      out[k++] = (rnd() - 0.5) * 0.35
    }
  }
  return out
}

// ---- terrain -----------------------------------------------------------------

/** Layered sines with rotated/scaled domains: smooth, drifting, same in GLSL. */
export function terrain(x: number, z: number, t: number): number {
  let px = x + t * 0.06
  let pz = z + t * 0.035
  let h = 0
  let a = TERRAIN_AMP
  const f = 0.42
  for (let i = 0; i < 4; i++) {
    h += a * Math.sin(px * f) * Math.cos(pz * f * 1.13 + 0.7)
    const nx = 0.8 * px - 0.6 * pz
    const nz = 0.6 * px + 0.8 * pz
    px = nx * 1.9 + 3.1
    pz = nz * 1.9 - 1.7
    a *= 0.5
  }
  return h
}

// ---- camera ------------------------------------------------------------------

export interface Camera {
  c: [number, number, number]
  r: [number, number, number]
  u: [number, number, number]
  f: [number, number, number]
  /** focal lengths x,y (clip = view * focal / depth) */
  fx: number
  fy: number
}

const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const norm = (a: number[]): [number, number, number] => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const cross = (a: number[], b: number[]) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

export const DEPTH_MIN = 6
export const DEPTH_MAX = 21

export function camera(f: Pick<FrameState, 't' | 'px' | 'py' | 'scrollY'>, aspect: number): Camera {
  // Slow orbit: yaw sweeps a wide arc over ~3 min, elevation breathes slightly.
  const yaw = 0.55 * Math.sin(f.t * 0.035) + f.px * 0.06
  const elev = 0.62 + 0.05 * Math.sin(f.t * 0.021 + 1) + f.py * 0.03 - Math.min(0.12, f.scrollY * 0.00008)
  const dist = 10
  const target = [0, 0.3, 0.5]
  const c: [number, number, number] = [
    target[0] + dist * Math.sin(yaw) * Math.cos(elev),
    target[1] + dist * Math.sin(elev),
    target[2] + dist * Math.cos(yaw) * Math.cos(elev),
  ]
  const fw = norm(sub(target, c))
  const r = norm(cross(fw, [0, 1, 0]))
  const u = norm(cross(r, fw))
  const fovY = 0.62 // radians, vertical
  const fy = 1 / Math.tan(fovY / 2)
  // Portrait screens keep the same horizontal coverage as a 4:3 window.
  const fx = fy / Math.max(aspect, 0.75)
  return { c, r, u, f: fw, fx, fy }
}

/** Mirror of the vertex shader, for the Canvas2D fallback. Returns depth or -1. */
export function project(cam: Camera, wx: number, wy: number, wz: number, out: number[]): number {
  const dx = wx - cam.c[0]
  const dy = wy - cam.c[1]
  const dz = wz - cam.c[2]
  const d = cam.f[0] * dx + cam.f[1] * dy + cam.f[2] * dz
  if (d < 0.1) return -1
  const vx = cam.r[0] * dx + cam.r[1] * dy + cam.r[2] * dz
  const vy = cam.u[0] * dx + cam.u[1] * dy + cam.u[2] * dz
  out[0] = (vx * cam.fx) / d
  out[1] = (vy * cam.fy) / d
  return d
}

export const SCAN_PERIOD = 6 // seconds

/** Scan position in normalized depth (0 = near .. 1 = far), sweeping front-to-back. */
export function scanPos(t: number): number {
  return ((t / SCAN_PERIOD) % 1) * 1.3 - 0.15
}

export function scanGlow(nd: number, s: number): number {
  const delta = s - nd
  return delta >= 0 ? Math.exp(-delta * 9) * (delta < 0.6 ? 1 : 0) : Math.exp((-delta * delta) / 0.0006)
}

export function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
