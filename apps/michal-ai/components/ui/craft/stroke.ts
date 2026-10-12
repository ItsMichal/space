// Small organic shapes for the micro-UI kit, built on the shared motion toolkit: seeded randomness from @space/motion/rng,
// pen strokes from @space/motion/handStroke (makeStroke), blobs from @space/motion/pathMorph. This file only adds the leaf,
// blade and seed silhouettes those do not provide.
import { blob, closedPath } from '@space/motion/pathMorph'
import { hash01 } from '@space/motion/rng'

/** Deterministic float in [0,1) from an integer. */
export const rand = (seed: number) => hash01(seed, 7)

/** A resting page-control marker: a small seed, a little different every time (seeded), centred on the origin. */
export function seedPath(seed: number, radius = 3.3): string {
  const pts = blob(seed * 31 + 5, radius, 0.26, 14)
  // slightly flattened and tilted like a seed rather than a dot
  const tilt = (rand(seed) - 0.5) * 1.2
  const c = Math.cos(tilt)
  const s = Math.sin(tilt)
  return closedPath(pts.map((p) => ({ x: (p.x * c - p.y * s) * 1.12, y: (p.x * s + p.y * c) * 0.86 })))
}
