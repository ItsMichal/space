import { project, rubberBand } from '@/lib/motion/spring'

/** Rolling velocity estimate from pointer samples, in units/second. Uses only the last ~100ms like UIKit does. */
export class VelocityTracker {
  private s: { t: number; x: number }[] = []
  reset() {
    this.s = []
  }
  add(t: number, x: number) {
    this.s.push({ t, x })
    while (this.s.length > 2 && t - this.s[0].t > 100) this.s.shift()
  }
  /** Velocity at time `now` (ms). Zero if the finger rested before release. */
  get(now: number): number {
    const a = this.s[0]
    const b = this.s[this.s.length - 1]
    if (!a || !b || a === b) return 0
    if (now - b.t > 80) return 0
    const dt = (b.t - a.t) / 1000
    return dt > 0 ? (b.x - a.x) / dt : 0
  }
}

/** Soft limit: inside [min,max] 1:1, beyond it resistance grows. */
export function bounded(x: number, min: number, max: number, soft: number): number {
  if (x < min) return min - rubberBand(min - x, soft)
  if (x > max) return max + rubberBand(x - max, soft)
  return x
}

/**
 * Where a released drag should settle. `pos` and `velocity` are in index space (items, items/s). The throw is
 * projected with native-scroll deceleration, clamped to the strip, and snapped to the nearest detent (integer).
 * A throw never skips more than `maxSkip` items.
 */
export function settleIndex(pos: number, velocity: number, count: number, maxSkip = 6): number {
  const projected = project(pos, velocity, 0.995)
  const lo = Math.max(0, Math.floor(pos) - maxSkip)
  const hi = Math.min(count - 1, Math.ceil(pos) + maxSkip)
  return Math.min(hi, Math.max(lo, Math.round(projected)))
}

/** Spring damping for a settle: critically damped for a gentle release, a hint of bounce when thrown. */
export function settleDamping(velocityPxPerSec: number): number {
  const v = Math.abs(velocityPxPerSec)
  return v < 300 ? 1 : v > 1800 ? 0.84 : 1 - ((v - 300) / 1500) * 0.16
}

/** Which item is focused for a continuous position. */
export const focusOf = (pos: number, count: number) => Math.min(count - 1, Math.max(0, Math.round(pos)))

/** Resolve the dominant axis once a pointer has moved far enough; null while undecided. */
export function dragAxis(dx: number, dy: number, slop = 6): 'x' | 'y' | null {
  if (Math.hypot(dx, dy) < slop) return null
  return Math.abs(dx) > Math.abs(dy) * 1.1 ? 'x' : 'y'
}
