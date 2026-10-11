// PathMorph: morph organic closed shapes without popping. Like flubber (veltman, MIT), shapes are resampled to the
// same point count and the start index (and winding) is aligned to minimise travel; unlike a naive lerp this avoids
// shapes folding through themselves. Interpolation is polar about the centroid, so a blob "breathes" outward instead of
// shrinking toward a straight line mid-way.
import { mulberry32 } from './rng'
import type { Pt } from './handStroke'

export const centroid = (pts: Pt[]): Pt => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
})

/** A closed organic blob: radius modulated by a few seeded harmonics. */
export function blob(seed: number, radius: number, irregularity = 0.18, n = 40, center: Pt = { x: 0, y: 0 }): Pt[] {
  const rnd = mulberry32(seed)
  const harmonics = [2, 3, 5, 7].map((k) => ({ k, a: (rnd() * 2 - 1) * irregularity * (3 / (k + 1)), ph: rnd() * Math.PI * 2 }))
  return Array.from({ length: n }, (_, i) => {
    const th = (i / n) * Math.PI * 2
    const rr = radius * (1 + harmonics.reduce((s, h) => s + h.a * Math.sin(h.k * th + h.ph), 0))
    return { x: center.x + Math.cos(th) * rr, y: center.y + Math.sin(th) * rr }
  })
}

/** Resample a closed polygon to `n` points equal in arclength. */
export function resampleClosed(pts: Pt[], n: number): Pt[] {
  const m = pts.length
  const seg: number[] = []
  let total = 0
  for (let i = 0; i < m; i++) {
    const d = Math.hypot(pts[(i + 1) % m].x - pts[i].x, pts[(i + 1) % m].y - pts[i].y)
    seg.push(d)
    total += d
  }
  const out: Pt[] = []
  let j = 0
  let acc = 0
  for (let i = 0; i < n; i++) {
    const target = (i / n) * total
    while (acc + seg[j] < target && j < m - 1) {
      acc += seg[j]
      j++
    }
    const t = seg[j] ? (target - acc) / seg[j] : 0
    const a = pts[j]
    const b = pts[(j + 1) % m]
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  }
  return out
}

const signedArea = (pts: Pt[]) => pts.reduce((s, p, i) => s + (p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y), 0) / 2

/** Resample both to `n`, match winding, rotate `b` so total point travel is minimal. Returns the aligned pair. */
export function alignClosed(a: Pt[], b: Pt[], n = 48): [Pt[], Pt[]] {
  const A = resampleClosed(a, n)
  let B = resampleClosed(b, n)
  if (Math.sign(signedArea(A)) !== Math.sign(signedArea(B))) B = B.slice().reverse()
  let best = 0
  let bestCost = Infinity
  for (let s = 0; s < n; s++) {
    let cost = 0
    for (let i = 0; i < n; i++) {
      const q = B[(i + s) % n]
      cost += (A[i].x - q.x) ** 2 + (A[i].y - q.y) ** 2
    }
    if (cost < bestCost) {
      bestCost = cost
      best = s
    }
  }
  return [A, B.map((_, i) => B[(i + best) % n])]
}

/** Interpolate two aligned shapes at t (may overshoot outside 0..1 for springy morphs). Polar about each centroid. */
export function morph(a: Pt[], b: Pt[], t: number): Pt[] {
  const ca = centroid(a)
  const cb = centroid(b)
  const c = { x: ca.x + (cb.x - ca.x) * t, y: ca.y + (cb.y - ca.y) * t }
  return a.map((p, i) => {
    const q = b[i]
    const ra = Math.hypot(p.x - ca.x, p.y - ca.y)
    const rb = Math.hypot(q.x - cb.x, q.y - cb.y)
    let da = Math.atan2(q.y - cb.y, q.x - cb.x) - Math.atan2(p.y - ca.y, p.x - ca.x)
    while (da > Math.PI) da -= Math.PI * 2
    while (da < -Math.PI) da += Math.PI * 2
    const ang = Math.atan2(p.y - ca.y, p.x - ca.x) + da * t
    const r = Math.max(0, ra + (rb - ra) * t)
    return { x: c.x + Math.cos(ang) * r, y: c.y + Math.sin(ang) * r }
  })
}

/** Closed Catmull-Rom spline through the points as cubic Beziers (smooth, no corners). */
export function closedPath(pts: Pt[], tension = 1): string {
  const n = pts.length
  if (n < 3) return ''
  const f = (v: number) => Math.round(v * 100) / 100
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const k = tension / 6
    d += `C${f(p1.x + (p2.x - p0.x) * k)} ${f(p1.y + (p2.y - p0.y) * k)} ${f(p2.x - (p3.x - p1.x) * k)} ${f(p2.y - (p3.y - p1.y) * k)} ${f(p2.x)} ${f(p2.y)}`
  }
  return d + 'Z'
}
