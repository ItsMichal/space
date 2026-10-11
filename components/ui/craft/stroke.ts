// Hand-drawn geometry for the micro-UI kit. Pure functions, no DOM. Shapes here are meant to be swapped for the
// shared motion toolkit (HandStroke / PathMorph) when it lands; keep signatures small.

/** Deterministic pseudo-random in [0,1) from an integer seed (mulberry32 step). */
export function rand(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const f = (n: number) => (Math.round(n * 100) / 100).toString()

const wander = (x: number, i: number, seed: number, sway: number) =>
  Math.sin(x * 0.018 + seed) * sway * 0.6 + (rand(seed * 131 + i) - 0.5) * sway * 0.5

/**
 * A stem: a left-to-right stroke of slightly varying width along a gently wandering centreline, returned as a closed
 * path outline. Width tapers from `base` at the root to `tip` at the end with a little seeded wobble, so it reads as
 * drawn with a brush rather than ruled. `sway` is the vertical wander in px.
 */
export function stemPath(length: number, { base = 2.6, tip = 0.9, sway = 1.4, seed = 1, step = 12 } = {}): string {
  const n = Math.max(2, Math.ceil(length / step))
  const top: string[] = []
  const bot: string[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = t * length
    const y = wander(x, i, seed, sway)
    const w = (base + (tip - base) * t) * (0.86 + rand(seed * 17 + i * 3) * 0.28)
    top.push(`${f(x)} ${f(y - w / 2)}`)
    bot.push(`${f(x)} ${f(y + w / 2)}`)
  }
  return `M${top.join('L')}L${bot.reverse().join('L')}Z`
}

/** The wandering hairline the stem grows along (a thin, quiet version of the same centreline). */
export function railPath(length: number, { sway = 1.4, seed = 1, step = 12 } = {}): string {
  const n = Math.max(2, Math.ceil(length / step))
  const pts: string[] = []
  for (let i = 0; i <= n; i++) pts.push(`${f((i / n) * length)} ${f(wander((i / n) * length, i, seed, sway))}`)
  return `M${pts.join('L')}`
}

/** y of the centreline at x, so ticks and the growing tip can sit exactly on the drawn stem. */
export function railY(x: number, length: number, { sway = 1.4, seed = 1, step = 12 } = {}): number {
  const n = Math.max(2, Math.ceil(length / step))
  const i = Math.min(n, Math.max(0, Math.round((x / length) * n)))
  return wander((i / n) * length, i, seed, sway)
}

/**
 * A leaf bud rising from (0,0) upward: a pointed-oval with an asymmetric belly and a slight curl at the tip. `size`
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
