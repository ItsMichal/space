// Handwriting geometry: a checked ink file (lib/content/rules.mjs parseInk) to SVG paths. Pure and DOM-free, so the same
// numbers come out at build time (the static ink in the prerendered page) and in the browser (the animated copy and the
// editor's pen pad). It works from the raw points alone, so files recorded before any capture-side cleanup look the same.
//
// Per stroke:
// 1. Resample the recorded polyline at an even spacing along its length (carrying time and pressure).
// 2. Trim touch-down and lift-off hooks: a sharp turn in the first or last few pen widths.
// 3. Smooth the centerline with a zero-phase Gaussian (repeated 1-2-1 passes, ends pinned): jitter and polyline corners go,
//    curves keep their shape and there is no lag, so the line still ends where the pen lifted.
// 4. Width from pressure when the file has it, otherwise from speed (slow is fuller, as ink pools; fast is thinner), smoothed
//    along the stroke; tapered in and out, less where the pen was slow (a pen that stops leaves a blob, a flick leaves a point).
// 5. Offset both sides along the normals, simplify each side to a tolerance well under a device pixel, and close the outline
//    with round caps. The outline is written as quadratic curves through the side midpoints (smooth, compact path data).
// The smoothed centerline is kept for the draw-on mask, so the reveal follows exactly the line the outline is built around.
import type { Ink } from '@/lib/content/rules.mjs'

export type InkStroke = {
  /** Filled outline (SVG path d). */
  outline: string
  /** Smoothed centerline as a polyline (SVG path d); the draw-on mask strokes along it. */
  center: string
  /** Length of the centerline in viewBox units. */
  length: number
  /** Widest point of the outline. */
  maxWidth: number
  /** Bounding box of the outline: x0, y0, x1, y1. */
  box: [number, number, number, number]
  /** Recorded start and end, ms since the first point of the drawing. */
  t0: number
  t1: number
  /** Fraction of the length drawn at each of PACE_STEPS + 1 even steps through the stroke's recorded time. */
  pace: number[]
}

export type BuiltInk = { width: number; height: number; size: number; strokes: InkStroke[] }

export type StrokeOptions = {
  /** The stroke is still being drawn (the pen pad): no lift-off taper or hook trim at its end. */
  live?: boolean
  /** Smallest resample spacing in viewBox units (buildInk raises it for very long drawings, to bound the work). */
  minSpacing?: number
}

export const PACE_STEPS = 24
/** Samples per stroke at most, and in a whole drawing at most: bounds the work and the path data for any valid file. */
export const MAX_STROKE_SAMPLES = 1500
export const MAX_INK_SAMPLES = 60000

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const r1 = (v: number) => Math.round(v * 10) / 10

type Pt = { x: number; y: number }

/** The stroke's points, consecutive duplicates dropped. */
function rawPoints(ink: Ink, s: number[]) {
  const stride = ink.pressure ? 4 : 3
  const x: number[] = []
  const y: number[] = []
  const t: number[] = []
  const p: number[] = []
  for (let i = 0; i < s.length; i += stride) {
    const n = x.length
    if (n && Math.abs(s[i] - x[n - 1]) < 0.01 && Math.abs(s[i + 1] - y[n - 1]) < 0.01) continue
    x.push(s[i])
    y.push(s[i + 1])
    t.push(s[i + 2])
    p.push(ink.pressure ? s[i + 3] : 0.5)
  }
  return { x, y, t, p }
}

function polyLength(x: ArrayLike<number>, y: ArrayLike<number>) {
  let len = 0
  for (let i = 1; i < x.length; i++) len += Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1])
  return len
}

/** Total recorded length of a stroke (for buildInk's sample budget). */
function strokeLength(ink: Ink, s: number[]) {
  const r = rawPoints(ink, s)
  return polyLength(r.x, r.y)
}

type Samples = { x: Float64Array; y: Float64Array; t: Float64Array; p: Float64Array; n: number }

/** Even spacing `h` along the polyline, first and last points kept. */
function resample(r: ReturnType<typeof rawPoints>, len: number, h: number): Samples {
  const n = Math.max(2, Math.min(MAX_STROKE_SAMPLES, Math.round(len / h) + 1))
  const step = len / (n - 1)
  const out: Samples = { x: new Float64Array(n), y: new Float64Array(n), t: new Float64Array(n), p: new Float64Array(n), n }
  let j = 0
  let at = 0 // arc length at r[j]
  for (let k = 0; k < n; k++) {
    const want = k === n - 1 ? len : k * step
    while (j < r.x.length - 2) {
      const seg = Math.hypot(r.x[j + 1] - r.x[j], r.y[j + 1] - r.y[j])
      if (at + seg >= want) break
      at += seg
      j++
    }
    const seg = Math.hypot(r.x[j + 1] - r.x[j], r.y[j + 1] - r.y[j])
    const u = seg > 0 ? clamp((want - at) / seg, 0, 1) : 1
    out.x[k] = r.x[j] + (r.x[j + 1] - r.x[j]) * u
    out.y[k] = r.y[j] + (r.y[j + 1] - r.y[j]) * u
    out.t[k] = r.t[j] + (r.t[j + 1] - r.t[j]) * u
    out.p[k] = r.p[j] + (r.p[j + 1] - r.p[j]) * u
  }
  return out
}

/** `passes` rounds of a 1-2-1 kernel, ends pinned: a Gaussian with sigma = sqrt(passes / 2) samples. In place. */
function blur(a: Float64Array, n: number, passes: number, tmp: Float64Array) {
  for (let k = 0; k < passes; k++) {
    tmp[0] = a[0]
    tmp[n - 1] = a[n - 1]
    for (let i = 1; i < n - 1; i++) tmp[i] = (a[i - 1] + 2 * a[i] + a[i + 1]) / 4
    a.set(tmp.subarray(0, n))
  }
}

/** Angle (radians) between the directions a to b and b to c. */
function bend(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const ux = bx - ax
  const uy = by - ay
  const vx = cx - bx
  const vy = cy - by
  const lu = Math.hypot(ux, uy)
  const lv = Math.hypot(vx, vy)
  if (lu < 1e-6 || lv < 1e-6) return 0
  return Math.acos(clamp((ux * vx + uy * vy) / (lu * lv), -1, 1))
}

/**
 * Length in samples of a hook at the start of `s` (read backwards when `end`), or 0. A hook is a short lead-in that meets the
 * rest of the stroke at a corner: the lead-in leaves the body's line by more than half a pen width, turns by more than 45
 * degrees where it joins, and the body right after the corner turns much less (so the start of a small loop is not a hook).
 */
function hookLength(s: Samples, reach: number, minDev: number, end: boolean): number {
  const n = s.n
  if (n < reach * 4 + 4) return 0
  const X = (i: number) => s.x[end ? n - 1 - i : i]
  const Y = (i: number) => s.y[end ? n - 1 - i : i]
  let best = 0
  let at = 0
  for (let i = 2; i <= reach; i++) {
    const a = bend(X(0), Y(0), X(i), Y(i), X(i + reach), Y(i + reach))
    if (a <= best) continue
    const body = bend(X(i), Y(i), X(i + reach), Y(i + reach), X(i + 2 * reach), Y(i + 2 * reach))
    const bx = X(i + reach) - X(i)
    const by = Y(i + reach) - Y(i)
    const dev = Math.abs(bx * (Y(0) - Y(i)) - by * (X(0) - X(i))) / (Math.hypot(bx, by) || 1)
    if (body < a * 0.5 && dev > minDev) [best, at] = [a, i]
  }
  return best > Math.PI / 4 ? at : 0
}

/** Ramer-Douglas-Peucker on a ring side (iterative), returning the kept points. */
function simplify(pts: Pt[], eps: number): Pt[] {
  const n = pts.length
  if (n < 3) return pts
  const keep = new Uint8Array(n)
  keep[0] = keep[n - 1] = 1
  const stack: number[] = [0, n - 1]
  while (stack.length) {
    const b = stack.pop()!
    const a = stack.pop()!
    const dx = pts[b].x - pts[a].x
    const dy = pts[b].y - pts[a].y
    const len2 = dx * dx + dy * dy
    let worst = -1
    let at = -1
    for (let i = a + 1; i < b; i++) {
      const ex = pts[i].x - pts[a].x
      const ey = pts[i].y - pts[a].y
      const u = len2 ? clamp((ex * dx + ey * dy) / len2, 0, 1) : 0
      const d = Math.hypot(ex - u * dx, ey - u * dy)
      if (d > worst) [worst, at] = [d, i]
    }
    if (worst > eps && at > 0) {
      keep[at] = 1
      stack.push(a, at, at, b)
    }
  }
  const out: Pt[] = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i])
  return out
}

/** A closed ring as quadratic curves through the midpoints of its sides (C1-smooth, one curve per kept point). */
function ringPath(ring: Pt[]): string {
  const n = ring.length
  const mid = (a: Pt, b: Pt) => `${r1((a.x + b.x) / 2)} ${r1((a.y + b.y) / 2)}`
  let d = `M${mid(ring[n - 1], ring[0])}`
  for (let i = 0; i < n; i++) d += `Q${r1(ring[i].x)} ${r1(ring[i].y)} ${mid(ring[i], ring[(i + 1) % n])}`
  return d + 'Z'
}

/** Points of a half circle (exclusive of its ends), turning clockwise in atan2 terms from angle `from`. */
function arc(cx: number, cy: number, r: number, from: number): Pt[] {
  const steps = clamp(Math.ceil(r * 3), 3, 8)
  const out: Pt[] = []
  for (let k = 1; k < steps; k++) {
    const a = from - (Math.PI * k) / steps
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
  }
  return out
}

const evenPace = () => Array.from({ length: PACE_STEPS + 1 }, (_, k) => k / PACE_STEPS)

function dot(x: number, y: number, size: number, t0: number, t1: number): InkStroke {
  const r = size * 0.5
  const ring = Array.from({ length: 12 }, (_, k) => ({ x: x + Math.cos((k * Math.PI) / 6) * r, y: y + Math.sin((k * Math.PI) / 6) * r }))
  return { outline: ringPath(ring), center: `M${r1(x)} ${r1(y)}h0.1`, length: 0.1, maxWidth: r * 2, box: [x - r, y - r, x + r, y + r], t0, t1, pace: evenPace() }
}

export function buildStroke(ink: Ink, s: number[], opts: StrokeOptions = {}): InkStroke {
  const size = ink.size
  const raw = rawPoints(ink, s)
  const t0 = s[2]
  const t1 = s[s.length - (ink.pressure ? 2 : 1)]
  const rawLen = polyLength(raw.x, raw.y)
  if (raw.x.length < 2 || rawLen < Math.max(0.5, size * 0.25)) return dot(raw.x[0], raw.y[0], size, t0, t1)

  // 1. Even samples, about a third of a pen width apart.
  const h = Math.max(0.5, size * 0.3, opts.minSpacing ?? 0, rawLen / (MAX_STROKE_SAMPLES - 1))
  let S = resample(raw, rawLen, h)
  const step = rawLen / (S.n - 1)

  // 2. Hooks: within about four pen widths of either end (and never more than a fifth of the stroke).
  const reach = Math.floor(Math.min(size * 4, rawLen * 0.2) / step)
  const from = hookLength(S, reach, size * 0.5, false)
  const to = S.n - 1 - (opts.live ? 0 : hookLength(S, reach, size * 0.5, true))
  if (from > 0 || to < S.n - 1) {
    const cut = (a: Float64Array) => a.slice(from, to + 1)
    S = { x: cut(S.x), y: cut(S.y), t: cut(S.t), p: cut(S.p), n: to - from + 1 }
  }
  const n = S.n
  const tmp = new Float64Array(n)

  // 3. Zero-phase smoothing: sigma of about a pen width plus a little, for finger jitter at any pen size.
  const sigma = clamp(size * 1.1 + 1, 1.5, 8) / step
  const passes = Math.min(48, Math.round(2 * sigma * sigma))
  blur(S.x, n, passes, tmp)
  blur(S.y, n, passes, tmp)
  if (ink.pressure) blur(S.p, n, passes, tmp)

  const cum = new Float64Array(n)
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(S.x[i] - S.x[i - 1], S.y[i] - S.y[i - 1])
  const length = cum[n - 1]
  if (n < 2 || length < 0.5) return dot(S.x[0], S.y[0], size, t0, t1)

  // 4. Speed (units per ms) over a window of a few pen widths, smoothed along the stroke, as 0 (still) to 1 (fast).
  const k = Math.max(1, Math.round((size * 2) / step))
  const speed = new Float64Array(n)
  const vHalf = Math.max(0.15, size * 0.17)
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - k)
    const b = Math.min(n - 1, i + k)
    const v = (cum[b] - cum[a]) / Math.max(4, S.t[b] - S.t[a])
    speed[i] = v / (v + vHalf)
  }
  blur(speed, n, passes * 2, tmp)
  const f = new Float64Array(n)
  for (let i = 0; i < n; i++) f[i] = ink.pressure ? (0.34 + 0.86 * S.p[i]) * (1.08 - 0.2 * speed[i]) : 1.2 - 0.55 * speed[i]

  // Tapers: eased in over a few pen widths, deeper for a fast start or finish.
  const taperIn = Math.min(size * 3.5, length * 0.3)
  const taperOut = opts.live ? 0 : Math.min(size * 5, length * 0.35)
  const floorIn = 0.62 - 0.5 * speed[0]
  const floorOut = 0.6 - 0.5 * speed[n - 1]
  const ease = (u: number) => 1 - (1 - u) * (1 - u)
  const half = new Float64Array(n)
  let maxWidth = 0
  for (let i = 0; i < n; i++) {
    let w = size * f[i]
    if (cum[i] < taperIn) w *= floorIn + (1 - floorIn) * ease(cum[i] / taperIn)
    const left = length - cum[i]
    if (left < taperOut) w *= floorOut + (1 - floorOut) * ease(left / taperOut)
    half[i] = Math.max(0.12, w / 2)
    maxWidth = Math.max(maxWidth, half[i] * 2)
  }

  // 5. Sides along the normals, simplified, then the ring with round caps.
  const L: Pt[] = []
  const R: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1)
    const b = Math.min(n - 1, i + 1)
    const len = Math.hypot(S.x[b] - S.x[a], S.y[b] - S.y[a]) || 1
    const nx = -(S.y[b] - S.y[a]) / len
    const ny = (S.x[b] - S.x[a]) / len
    L.push({ x: S.x[i] + nx * half[i], y: S.y[i] + ny * half[i] })
    R.push({ x: S.x[i] - nx * half[i], y: S.y[i] - ny * half[i] })
  }
  const tol = 0.12
  const angle = (i: number, j: number) => Math.atan2(S.y[j] - S.y[i], S.x[j] - S.x[i])
  const ring = [
    ...simplify(L, tol),
    ...arc(S.x[n - 1], S.y[n - 1], half[n - 1], angle(n - 2, n - 1) + Math.PI / 2),
    ...simplify(R, tol).reverse(),
    ...arc(S.x[0], S.y[0], half[0], angle(0, 1) - Math.PI / 2),
  ]
  const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const p of ring) {
    box[0] = Math.min(box[0], p.x)
    box[1] = Math.min(box[1], p.y)
    box[2] = Math.max(box[2], p.x)
    box[3] = Math.max(box[3], p.y)
  }

  const line: Pt[] = []
  for (let i = 0; i < n; i++) line.push({ x: S.x[i], y: S.y[i] })
  const kept = simplify(line, 0.2)
  let center = `M${r1(kept[0].x)} ${r1(kept[0].y)}`
  for (let i = 1; i < kept.length; i++) center += `L${r1(kept[i].x)} ${r1(kept[i].y)}`

  // Recorded pace: how far along the stroke the pen was at even steps of its time.
  const pace: number[] = []
  let j = 0
  for (let q = 0; q <= PACE_STEPS; q++) {
    if (t1 <= t0) {
      pace.push(q / PACE_STEPS)
      continue
    }
    const at = t0 + ((t1 - t0) * q) / PACE_STEPS
    while (j < n - 2 && S.t[j + 1] < at) j++
    const span = S.t[j + 1] - S.t[j]
    const u = span > 0 ? clamp((at - S.t[j]) / span, 0, 1) : 1
    pace.push(clamp((cum[j] + (cum[j + 1] - cum[j]) * u) / length, 0, 1))
  }
  pace[PACE_STEPS] = 1
  return { outline: ringPath(ring), center, length, maxWidth, box, t0, t1, pace }
}

export function buildInk(ink: Ink): BuiltInk {
  // A drawing too long for the sample budget is resampled more coarsely as a whole (only hostile or enormous files).
  const total = ink.strokes.reduce((sum, s) => sum + strokeLength(ink, s), 0)
  const minSpacing = total / MAX_INK_SAMPLES
  return { width: ink.width, height: ink.height, size: ink.size, strokes: ink.strokes.map((s) => buildStroke(ink, s, { minSpacing })) }
}
