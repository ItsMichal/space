// Settle: the numbers behind "text that settles line by line". Each line starts a hair low, a hair rotated and soft,
// and arrives with different timings per property (this asymmetry is the craft): opacity is quick, blur lingers,
// the rotation and rise ride a spring that overshoots by a few percent and comes back. All from a seed, so a reload
// settles identically.
import { hash01 } from './rng'

export type SettleOpts = {
  /** Gap between lines in ms. */
  stagger?: number
  /** Resting travel in px (design limit is 12). */
  rise?: number
  /** Max rotation in degrees. */
  tilt?: number
  blur?: number
  seed?: number
}

export type LineSettle = {
  delay: number
  fromY: number
  fromRot: number
  fromBlur: number
  /** Property durations in ms. */
  opacityMs: number
  blurMs: number
  moveMs: number
}

export function settleLine(index: number, o: SettleOpts = {}): LineSettle {
  const { stagger = 110, rise = 10, tilt = 0.7, blur = 5, seed = 7 } = o
  const dir = hash01(index, seed) < 0.5 ? -1 : 1
  const mag = 0.6 + 0.4 * hash01(index, seed + 1)
  return {
    delay: Math.round(index * stagger * (0.9 + 0.2 * hash01(index, seed + 2))),
    fromY: rise * (0.8 + 0.2 * hash01(index, seed + 3)),
    fromRot: dir * tilt * mag,
    fromBlur: blur,
    opacityMs: 620,
    blurMs: 980,
    moveMs: 1100,
  }
}

/** Total time until the last line has finished, for cleanup (will-change removal) timers. */
export function settleTotal(lines: number, o: SettleOpts = {}) {
  const l = settleLine(Math.max(0, lines - 1), o)
  return l.delay + Math.max(l.opacityMs, l.blurMs, l.moveMs) + 60
}
