// HandStroke maths: a pen-like, variable-width stroke built as ONE filled outline (not a CSS stroke), so it can
// swell in the belly, taper to a point and have a live leading tip while it draws. The idea follows perfect-freehand
// (steveruizok, MIT): width is a function of arclength, the outline is offset along normals. Ours additionally lets
// both ends move (`from`, `to`), so a stroke can be drawn on from the left and wiped off from the left, like ink soaking.
import { fbm1 } from './rng'

export type Pt = { x: number; y: number }

/** Catmull-Rom through `pts`, `per` samples per span. Returns a dense polyline. */
export function catmullRom(pts: Pt[], per = 10): Pt[] {
  if (pts.length < 3) return pts.slice()
  const out: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let s = 0; s < per; s++) {
      const t = s / per
      const t2 = t * t
      const t3 = t2 * t
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      })
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

/** Cumulative arclength of a polyline, starting at 0. */
export function cumulative(pts: Pt[]) {
  const c = [0]
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return c
}

/** Resample to `n` points equally spaced along arclength. */
export function resample(pts: Pt[], n: number): Pt[] {
  const c = cumulative(pts)
  const total = c[c.length - 1]
  if (total === 0 || n < 2) return pts.slice(0, 1)
  const out: Pt[] = []
  let j = 0
  for (let i = 0; i < n; i++) {
    const target = (i / (n - 1)) * total
    while (j < c.length - 2 && c[j + 1] < target) j++
    const span = c[j + 1] - c[j] || 1
    const t = (target - c[j]) / span
    out.push({ x: pts[j].x + (pts[j + 1].x - pts[j].x) * t, y: pts[j].y + (pts[j + 1].y - pts[j].y) * t })
  }
  return out
}

/** Push each point sideways by smooth seeded noise, zero at both ends so the stroke still lands where it should. */
export function wobble(pts: Pt[], seed: number, amp: number, freq = 2.2): Pt[] {
  const c = cumulative(pts)
  const total = c[c.length - 1] || 1
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const u = c[i] / total
    const d = fbm1(u * freq * 3, seed) * amp * Math.sin(Math.PI * u) ** 0.5
    return { x: p.x + (-(b.y - a.y) / len) * d, y: p.y + ((b.x - a.x) / len) * d }
  })
}

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

export type StrokeOpts = {
  /** Peak width in px. */
  size: number
  /** Width at the start as a fraction of `size` (a pen lands, it does not begin at a point). */
  startWidth?: number
  /** Fraction of arclength over which a moving end tapers to a point. */
  tip?: number
}

/** Width profile along 0..1: lands soft, swells through the belly, eases thinner toward the end. */
export function widthAt(u: number, startWidth = 0.35) {
  const belly = Math.sin(Math.PI * Math.min(1, Math.max(0, u)) ** 0.85)
  return startWidth + (1 - startWidth) * belly ** 0.7
}

/**
 * The filled outline for the part of the stroke between `from` and `to` (0..1 of arclength). Moving ends taper to a
 * point so the leading edge is a brush tip, never a clipped rectangle. `bump` adds width (the pen pressing down as it
 * settles). Returns an SVG path `d`, or '' when there is nothing to draw.
 */
export function strokeOutline(pts: Pt[], opts: StrokeOpts, from = 0, to = 1, bump = 0): string {
  if (pts.length < 2 || to - from < 0.004) return ''
  const { size, startWidth = 0.35, tip = 0.14 } = opts
  const c = cumulative(pts)
  const total = c[c.length - 1] || 1
  const L: Pt[] = []
  const R: Pt[] = []
  const tipLen = Math.max(0.02, Math.min(tip, (to - from) / 2))
  for (let i = 0; i < pts.length; i++) {
    const u = c[i] / total
    if (u < from - 1e-6 || u > to + 1e-6) continue
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const nx = -(b.y - a.y) / len
    const ny = (b.x - a.x) / len
    const headTaper = smooth((to - u) / tipLen)
    const tailTaper = from > 0.002 ? smooth((u - from) / tipLen) : 1
    const endBlend = to >= 0.999 ? 0.3 + 0.7 * headTaper : 1
    const w = ((size * widthAt(u, startWidth) + bump) * Math.min(headTaper, tailTaper) * endBlend) / 2
    L.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w })
    R.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w })
  }
  if (L.length < 2) return ''
  return polygonToSmoothPath([...L, ...R.reverse()])
}

/** Closed polygon to a path with quadratic midpoints (soft corners, no spikes). */
export function polygonToSmoothPath(ring: Pt[]): string {
  const n = ring.length
  if (n < 3) return ''
  const f = (v: number) => Math.round(v * 100) / 100
  const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const m0 = mid(ring[n - 1], ring[0])
  let d = `M${f(m0.x)} ${f(m0.y)}`
  for (let i = 0; i < n; i++) {
    const m = mid(ring[i], ring[(i + 1) % n])
    d += `Q${f(ring[i].x)} ${f(ring[i].y)} ${f(m.x)} ${f(m.y)}`
  }
  return d + 'Z'
}

/** Point and tangent angle (radians) at u along the polyline. */
export function pointAt(pts: Pt[], u: number): Pt & { angle: number } {
  const c = cumulative(pts)
  const total = c[c.length - 1] || 1
  const t = Math.min(1, Math.max(0, u)) * total
  let j = 0
  while (j < c.length - 2 && c[j + 1] < t) j++
  const span = c[j + 1] - c[j] || 1
  const k = (t - c[j]) / span
  const a = pts[j]
  const b = pts[j + 1]
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle: Math.atan2(b.y - a.y, b.x - a.x) }
}

/** Build a stroke once (dense, wobbled polyline); call `d(from, to, bump)` per frame. */
export function makeStroke(control: Pt[], opts: StrokeOpts & { seed?: number; wobble?: number; density?: number }) {
  const dense = resample(catmullRom(control, 12), opts.density ?? 72)
  const pts = opts.wobble ? wobble(dense, opts.seed ?? 1, opts.wobble) : dense
  return {
    pts,
    d: (from = 0, to = 1, bump = 0) => strokeOutline(pts, opts, from, to, bump),
    at: (u: number) => pointAt(pts, u),
  }
}
