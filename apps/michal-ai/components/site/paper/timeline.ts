// Pure timing for the paper transition: what the sheet looks like at a moment. No DOM, no GL.
// The crumple is three squeezes on springs, one running into the next: each pulls the sheet further toward the ball on a damped
// spring that departs softly and lands with only a breath of overshoot, and each kicks a squash into it, the ball squished flat by the
// squeeze and springing back a little past round before it settles. Everything is a continuous curve, drawn every frame.
// The fire catches during the second squeeze, on the face of the sheet, and opens it up; what burns turns to glyphs that rise and
// fade (drawn by the engine from `burn`).
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

/** The squeezes: when each starts (ms), how far it takes the ball and its folds, its twist, and how hard it squishes. */
export const SQUEEZES = [
  { at: 0, ball: 0.4, fold: 0.6, twist: 0.22, squish: 0.16 },
  { at: 230, ball: 0.72, fold: 0.88, twist: -0.16, squish: 0.13 },
  { at: 460, ball: 1, fold: 1, twist: 0.12, squish: 0.11 },
] as const

/** The spring carrying each squeeze: its frequency (Hz) and damping. Damped enough that it overshoots by only a few percent. */
const MOVE = { hz: 2.6, zeta: 0.72 }
/** The spring of the squash: looser, so the ball springs back a little past round once before it settles. */
const SQUISH = { hz: 3.4, zeta: 0.42 }
/** The squish lands as its squeeze bites, a little after the squeeze starts (ms). */
const SQUISH_LAG = 80

/** Step response of a damped spring, 0 to 1, `t` in ms since it was let go. */
function springStep(t: number, { hz, zeta }: { hz: number; zeta: number }) {
  if (t <= 0) return 0
  const w = 2 * Math.PI * hz
  const wd = w * Math.sqrt(1 - zeta * zeta)
  const s = t / 1000
  return 1 - Math.exp(-zeta * w * s) * (Math.cos(wd * s) + ((zeta * w) / wd) * Math.sin(wd * s))
}

/** Impulse response of a damped spring, peaking at 1: the kick in, then the smaller swing back past rest. */
function springKick(t: number, { hz, zeta }: { hz: number; zeta: number }) {
  if (t <= 0) return 0
  const w = 2 * Math.PI * hz
  const wd = w * Math.sqrt(1 - zeta * zeta)
  const peak = Math.atan(wd / (zeta * w)) / wd
  const f = (s: number) => Math.exp(-zeta * w * s) * Math.sin(wd * s)
  return f(t / 1000) / f(peak)
}

/** When the fire catches, in ms: during the second squeeze. */
export const IGNITE_MS = 330
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
  for (const s of SQUEEZES) {
    const t = ms - s.at
    const e = springStep(t, MOVE)
    ball += (s.ball - prevBall) * e
    fold += (s.fold - prevFold) * e
    twist += s.twist * e
    squash += s.squish * springKick(t - SQUISH_LAG, SQUISH)
    prevBall = s.ball
    prevFold = s.fold
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
