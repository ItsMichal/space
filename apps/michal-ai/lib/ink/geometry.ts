// Handwriting geometry: a checked ink file (lib/content/rules.mjs parseInk) to SVG paths. Pure and DOM-free, so the same
// numbers come out at build time (the static ink in the prerendered page) and in the browser (the animated copy).
// Each stroke becomes a filled outline whose width follows the pen: pressure when the file has it (iPad Pencil), otherwise
// speed (fast is thin, slow is full), with soft tapers at both ends. The smoothed centerline is kept for the draw-on mask.
import type { Ink } from '@/lib/content/rules.mjs'

type P = { x: number; y: number; w: number; t: number }

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

export const PACE_STEPS = 24
const r1 = (v: number) => Math.round(v * 10) / 10
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function points(ink: Ink, s: number[]): P[] {
  const stride = ink.pressure ? 4 : 3
  const out: P[] = []
  for (let i = 0; i < s.length; i += stride) out.push({ x: s[i], y: s[i + 1], t: s[i + 2], w: ink.pressure ? s[i + 3] : 0 })
  return out
}

/** Width factor per point: from pressure, or from speed (units per ms, smoothed) when there is none. */
function widths(ink: Ink, pts: P[]): number[] {
  const out: number[] = []
  let ema = 0
  for (let i = 0; i < pts.length; i++) {
    let f: number
    if (ink.pressure) f = 0.32 + 0.95 * pts[i].w
    else {
      const a = pts[Math.max(0, i - 1)]
      const b = pts[i]
      const v = i === 0 ? 0 : Math.hypot(b.x - a.x, b.y - a.y) / Math.max(4, b.t - a.t)
      ema = i <= 1 ? v : ema * 0.6 + v * 0.4
      f = 1.2 - 0.62 * Math.min(1, ema / (ink.size * 0.55)) ** 0.8
    }
    out.push(i === 0 ? f : out[i - 1] * 0.45 + f * 0.55)
  }
  return out
}

/** Centripetal-ish Catmull-Rom through the points, carrying width and time; denser where points are far apart. */
function smooth(pts: P[]): P[] {
  if (pts.length < 3) return pts.slice()
  const out: P[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const per = clamp(Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 1.5), 1, 16)
    for (let s = 0; s < per; s++) {
      const t = s / per
      const t2 = t * t
      const t3 = t2 * t
      const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push({ x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y), w: p1.w + (p2.w - p1.w) * t, t: p1.t + (p2.t - p1.t) * t })
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

function ringPath(ring: { x: number; y: number }[]): string {
  const n = ring.length
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => `${r1((a.x + b.x) / 2)} ${r1((a.y + b.y) / 2)}`
  let d = `M${mid(ring[n - 1], ring[0])}`
  for (let i = 0; i < n; i++) d += `Q${r1(ring[i].x)} ${r1(ring[i].y)} ${mid(ring[i], ring[(i + 1) % n])}`
  return d + 'Z'
}

/** Points of a half circle (exclusive of its ends), turning clockwise in atan2 terms from angle `from`. */
function arc(cx: number, cy: number, r: number, from: number, steps = 6) {
  const out: { x: number; y: number }[] = []
  for (let k = 1; k < steps; k++) {
    const a = from - (Math.PI * k) / steps
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
  }
  return out
}

function dot(p: P, size: number, t: number): InkStroke {
  const r = size * 0.55
  const ring = Array.from({ length: 12 }, (_, k) => ({ x: p.x + Math.cos((k * Math.PI) / 6) * r, y: p.y + Math.sin((k * Math.PI) / 6) * r }))
  return { outline: ringPath(ring), center: `M${r1(p.x)} ${r1(p.y)}h0.1`, length: 0.1, maxWidth: r * 2, box: [p.x - r, p.y - r, p.x + r, p.y + r], t0: t, t1: t, pace: Array.from({ length: PACE_STEPS + 1 }, (_, k) => k / PACE_STEPS) }
}

export function buildStroke(ink: Ink, s: number[]): InkStroke {
  const raw = points(ink, s)
  const f = widths(ink, raw)
  const pts = smooth(raw.map((p, i) => ({ ...p, w: f[i] })))
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  const length = cum[cum.length - 1]
  const t0 = raw[0].t
  const t1 = raw[raw.length - 1].t
  if (pts.length < 2 || length < 0.5) return dot(raw[0], ink.size, t0)

  const taper = Math.min(length / 3, ink.size * 2.5)
  const L: { x: number; y: number }[] = []
  const R: { x: number; y: number }[] = []
  let maxWidth = 0
  let box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
  const half: number[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const nx = -(b.y - a.y) / len
    const ny = (b.x - a.x) / len
    const head = clamp(cum[i] / taper, 0, 1)
    const tail = clamp((length - cum[i]) / taper, 0, 1)
    const w = ink.size * pts[i].w * (0.6 + 0.4 * head) * (0.5 + 0.5 * tail)
    half.push(w / 2)
    maxWidth = Math.max(maxWidth, w)
    L.push({ x: pts[i].x + nx * (w / 2), y: pts[i].y + ny * (w / 2) })
    R.push({ x: pts[i].x - nx * (w / 2), y: pts[i].y - ny * (w / 2) })
  }
  const first = pts[0]
  const last = pts[pts.length - 1]
  const angle = (a: P, b: P) => Math.atan2(b.y - a.y, b.x - a.x)
  // Round caps: half circles around each end, from one side of the outline to the other.
  const endA = angle(pts[pts.length - 2], last) + Math.PI / 2
  const startA = angle(first, pts[1]) - Math.PI / 2
  const ring = [...L, ...arc(last.x, last.y, half[half.length - 1], endA), ...R.reverse(), ...arc(first.x, first.y, half[0], startA)]
  for (const p of ring) box = [Math.min(box[0], p.x), Math.min(box[1], p.y), Math.max(box[2], p.x), Math.max(box[3], p.y)]

  let center = `M${r1(first.x)} ${r1(first.y)}`
  for (let i = 1; i < pts.length; i++) center += `L${r1(pts[i].x)} ${r1(pts[i].y)}`

  // Recorded pace: how far along the stroke the pen was at even steps of its time.
  const pace: number[] = []
  let j = 0
  for (let k = 0; k <= PACE_STEPS; k++) {
    if (t1 <= t0) {
      pace.push(k / PACE_STEPS)
      continue
    }
    const at = t0 + ((t1 - t0) * k) / PACE_STEPS
    while (j < pts.length - 2 && pts[j + 1].t < at) j++
    const span = pts[j + 1].t - pts[j].t
    const u = span > 0 ? clamp((at - pts[j].t) / span, 0, 1) : 1
    pace.push(clamp((cum[j] + (cum[j + 1] - cum[j]) * u) / length, 0, 1))
  }
  pace[PACE_STEPS] = 1
  return { outline: ringPath(ring), center, length, maxWidth, box, t0, t1, pace }
}

export function buildInk(ink: Ink): BuiltInk {
  return { width: ink.width, height: ink.height, size: ink.size, strokes: ink.strokes.map((s) => buildStroke(ink, s)) }
}
