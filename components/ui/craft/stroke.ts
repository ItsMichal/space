// Small organic shapes for the micro-UI kit, built on the shared motion toolkit: seeded randomness from lib/motion/rng,
// pen strokes from lib/motion/handStroke (makeStroke), blobs from lib/motion/pathMorph. This file only adds the leaf,
// blade and seed silhouettes those do not provide.
import { blob, closedPath } from '@/lib/motion/pathMorph'
import { hash01 } from '@/lib/motion/rng'

const f = (n: number) => (Math.round(n * 100) / 100).toString()

/** Deterministic float in [0,1) from an integer. */
export const rand = (seed: number) => hash01(seed, 7)

/**
 * A leaf bud rising from (0,0) upward: a pointed oval with an asymmetric belly and a slight curl at the tip. `size`
 * is the height in px, `bend` (-1..1) leans the tip, `fat` widens it. Origin is the base, so scale/rotate from there.
 */
export function leafPath(size: number, bend = 0, fat = 0.38): string {
  const h = size
  const w = h * fat
  const tx = bend * h * 0.3
  return (
    `M0 0C${f(-w)} ${f(-h * 0.25)} ${f(-w * 0.8 + tx * 0.4)} ${f(-h * 0.75)} ${f(tx)} ${f(-h)}` +
    `C${f(w * 0.9 + tx * 0.5)} ${f(-h * 0.7)} ${f(w * 1.1)} ${f(-h * 0.28)} 0 0Z`
  )
}

/** A minor tick: a short curved blade, not a ruled line. Heights and lean vary by seed. */
export function bladePath(seed: number, max = 9): { d: string; h: number } {
  const h = max * (0.45 + rand(seed) * 0.55)
  const lean = (rand(seed + 99) - 0.5) * 2.4
  const w = 0.7 + rand(seed + 7) * 0.5
  const d = `M${f(-w)} 0Q${f(-w * 0.4 + lean * 0.3)} ${f(-h * 0.6)} ${f(lean)} ${f(-h)}Q${f(w * 0.4 + lean * 0.3)} ${f(-h * 0.55)} ${f(w)} 0Z`
  return { d, h }
}

/** A resting page-control marker: a small seed, a little different every time (seeded), centred on the origin. */
export function seedPath(seed: number, radius = 3.3): string {
  const pts = blob(seed * 31 + 5, radius, 0.26, 14)
  // slightly flattened and tilted like a seed rather than a dot
  const tilt = (rand(seed) - 0.5) * 1.2
  const c = Math.cos(tilt)
  const s = Math.sin(tilt)
  return closedPath(pts.map((p) => ({ x: (p.x * c - p.y * s) * 1.12, y: (p.x * s + p.y * c) * 0.86 })))
}
