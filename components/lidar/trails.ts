import { TRAIL_LEN, TRAIL_LIFE_MS, trailNewest, type Trail } from '@/lib/presence/store'

export const GRID = 12 // space-3
const HEAD_RADIUS = 4.5

/**
 * Draw trails (CSS px space). Each sample is snapped to the 12px grid and has
 * alpha ∝ freshness², where freshness falls linearly to 0 over TRAIL_LIFE_MS;
 * so a visitor who stops moving fades out completely ~2s later. The newest
 * sample also gets an exact-position 4.5px head dot.
 */
export function drawTrails(
  ctx: CanvasRenderingContext2D,
  trails: ReadonlyMap<string, Trail>,
  colors: string[], // index 1..6
  w: number,
  h: number,
  now: number,
) {
  const seen = new Set<number>()
  for (const tr of trails.values()) {
    const color = colors[tr.color] ?? colors[1] ?? '#e0502a'
    seen.clear()
    ctx.fillStyle = color
    // newest -> oldest so a cell keeps its brightest sample
    for (let k = 0; k < tr.len; k++) {
      const idx = (tr.head - 1 - k + TRAIL_LEN * 2) % TRAIL_LEN
      const fresh = 1 - (now - tr.ts[idx]) / TRAIL_LIFE_MS
      if (fresh <= 0) break // older ones are even staler
      const gx = Math.round((tr.xs[idx] * w) / GRID) * GRID
      const gy = Math.round((tr.ys[idx] * h) / GRID) * GRID
      const key = gx * 100000 + gy
      if (seen.has(key)) continue
      seen.add(key)
      ctx.globalAlpha = fresh * fresh * 0.9
      ctx.beginPath()
      ctx.arc(gx, gy, 1 + 2.2 * fresh, 0, Math.PI * 2)
      ctx.fill()
    }
    const newest = trailNewest(tr)
    const fresh = 1 - (now - newest) / TRAIL_LIFE_MS
    if (fresh > 0) {
      const i = (tr.head - 1 + TRAIL_LEN) % TRAIL_LEN
      ctx.globalAlpha = fresh * fresh
      ctx.beginPath()
      ctx.arc(tr.xs[i] * w, tr.ys[i] * h, HEAD_RADIUS, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}
