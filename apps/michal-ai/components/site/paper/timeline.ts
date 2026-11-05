// Pure timing for the paper transition: what the sheet looks like at a moment. No DOM, no GL.
// The crumple is two drops, each moving like a bouncy ball dropped on a slightly soft floor: it leaves gently and gathers speed,
// lands and squishes into the floor, rebounds a little way back and settles after a smaller bounce. The first drop takes the flat
// page to a loose crumple, the second to the ball. The motion is a small physics run (gravity, a spring and damper floor), made
// once and read back by time, so everything is a continuous curve, drawn every frame.
// The fire catches between the drops, on the face of the sheet, and opens it up; what burns turns to glyphs that rise, billow
// outward and fade (drawn by the engine from `burn`).
import { PAPER_ASH, PAPER_MS } from './config'

export type Frame = {
  /** 0 flat sheet, 1 paper ball. */
  ball: number
  /** Large folds, 0 to 1. */
  fold: number
  /** Squash and stretch: above 0 squished flat (wider, shorter), below 0 stretched; volume kept. 0 at rest. */
  squash: number
  /** Euler angles of the sheet, radians. */
  spin: [number, number, number]
  /** The fire front in the sheet's burn field (0 to 1 across the sheet); a spot burns once it is behind it. Below 0 not lit. */
  burn: number
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

/** The drops: when each is let go (ms), how far it takes the ball and its folds, its twist, and how hard it squishes on landing. */
export const DROPS = [
  { at: 0, ball: 0.55, fold: 0.8, twist: 0.2, squish: 0.17 },
  { at: 300, ball: 1, fold: 1, twist: -0.1, squish: 0.13 },
] as const

/** How long a drop falls before it first lands, ms. */
export const FALL_MS = 140
/** How long the ball is in contact with the soft floor on a landing, ms: the squish. */
const CONTACT_MS = 75
/** How much of its speed the ball keeps off the floor; the first rebound rises BOUNCE² of the drop. */
const BOUNCE = 0.5
/** How much the ball stretches along its fall at full speed, against its squish. */
const STRETCH = 0.15

/** One drop, run once at 1ms: height above the floor (1 at the start, 0 on the floor, below 0 pressed in) and squish, 0 to 1. */
const DROP = (() => {
  const g = 2 / FALL_MS ** 2
  const lnE = Math.log(BOUNCE)
  const zeta = -lnE / Math.sqrt(Math.PI ** 2 + lnE ** 2)
  const w = Math.PI / CONTACT_MS / Math.sqrt(1 - zeta ** 2)
  const k = w * w
  const c = 2 * zeta * w
  const v0 = g * FALL_MS
  const rest = g / k
  const dt = 0.25
  const n = 1000
  const height = new Float32Array(n + 1)
  const speed = new Float32Array(n + 1)
  let x = 1
  let v = 0
  for (let i = 0; i <= n * 4; i++) {
    if (i % 4 === 0) {
      height[i / 4] = x
      speed[i / 4] = v
    }
    const a = -g + (x < 0 ? -k * x - c * v : 0)
    v += a * dt
    x += v * dt
  }
  let deepest = 0
  for (const h of height) deepest = Math.min(deepest, h)
  // squished by how far it is pressed in past where it rests, stretched by its speed while it flies
  const squish = height.map((h, i) => Math.max(0, -h - rest) / (-deepest - rest) - (STRETCH * Math.abs(speed[i])) / v0)
  return { height, squish, n }
})()

function dropAt(t: number) {
  if (t <= 0) return { p: 0, squish: 0 }
  const i = Math.min(t, DROP.n)
  const a = Math.floor(i)
  const b = Math.min(a + 1, DROP.n)
  const f = i - a
  const h = DROP.height[a] + (DROP.height[b] - DROP.height[a]) * f
  return { p: 1 - Math.max(0, h), squish: DROP.squish[a] + (DROP.squish[b] - DROP.squish[a]) * f }
}

/** When the fire catches, in ms: between the drops. */
export const IGNITE_MS = 220
/** The front starts short of the sheet, its burning edge of glyphs too (engine EDGE), so the first drawings are untouched. */
const BURN_FROM = -0.1

/** The whole animation at `T` (0 to 1 over PAPER_MS). */
export function frameAt(T: number): Frame {
  T = clamp01(T)
  const ms = T * PAPER_MS
  let ball = 0
  let fold = 0
  let twist = 0
  let squash = 0
  let prevBall = 0
  let prevFold = 0
  for (const d of DROPS) {
    const { p, squish } = dropAt(ms - d.at)
    ball += (d.ball - prevBall) * p
    fold += (d.fold - prevFold) * p
    twist += d.twist * p
    squash += d.squish * squish
    prevBall = d.ball
    prevFold = d.fold
  }
  // a flat page has nothing to squish: it comes in as the sheet gathers into a ball
  squash *= Math.min(1, ball / 0.35)
  // the end is exact: the last ash leaves a sheet at rest
  if (T >= 1) {
    ball = 1
    fold = 1
    squash = 0
  }
  const p = clamp01((ms - IGNITE_MS) / (PAPER_MS - IGNITE_MS))
  // the fire is slow to catch and quickens; at the end the last ash has lived out its PAPER_ASH
  const burn = BURN_FROM + (1 + PAPER_ASH - BURN_FROM) * p ** 1.3
  return {
    ball,
    fold,
    squash,
    spin: [-0.35 * ball, 0.55 * ball, 0.5 * ball + twist],
    burn,
  }
}

/** The flicker of the burning glyphs steps on twos (12 a second, as hand-drawn fire does) while the sheet moves every frame. */
export function flickerAt(ms: number, fps: number): number {
  return Math.floor(ms / (1000 / fps))
}
