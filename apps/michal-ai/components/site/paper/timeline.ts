// Pure timing for the paper transition: what the sheet looks like at a moment. No DOM, no GL.
// The crumple is posed the way hand animation is: not one smooth squeeze but three, each with an anticipation, a fast squeeze and
// an overshoot, held in between. The fire catches during the second, on the face of the sheet, and opens it up; what burns turns to
// glyphs that rise and fade (drawn by the engine from `burn`).
import { PAPER_ASH, PAPER_FPS, PAPER_MS } from './config'

export type Frame = {
  /** 0 flat sheet, 1 paper ball. */
  ball: number
  /** Large folds, 0 to 1. */
  fold: number
  /** Volume pulse for the squeezes, 1 none. */
  scale: number
  /** Euler angles of the sheet, radians. */
  spin: [number, number, number]
  /** The fire front in the sheet's burn field (0 to 1 across the sheet); a spot burns once it is behind it. Below 0 not lit. */
  burn: number
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

/** The crumples, in T: when each starts, how long it takes, and how far it gets toward the ball and its folds. */
export const SQUEEZES = [
  { at: 0, len: 0.17, ball: 0.38, fold: 0.55, twist: 0.22 },
  { at: 0.21, len: 0.16, ball: 0.7, fold: 0.85, twist: -0.16 },
  { at: 0.41, len: 0.18, ball: 1, fold: 1, twist: 0.12 },
] as const

/** Within a squeeze: the share spent drawing in before it, and where the squeeze itself ends (the rest is its overshoot). */
const ANTICIPATE = 0.25
const SQUEEZED = 0.62

/** When the fire catches, in T. */
export const IGNITE = 0.26
/** The front starts just short of the sheet so the first drawings are untouched. */
const BURN_FROM = -0.04

/** The whole animation at `T` (0 to 1 over PAPER_MS). */
export function frameAt(T: number): Frame {
  T = clamp01(T)
  let ball = 0
  let fold = 0
  let twist = 0
  let scale = 1
  for (const s of SQUEEZES) {
    const u = (T - s.at) / s.len
    if (u <= 0) break
    const e = easeOutCubic(smoothstep(ANTICIPATE, SQUEEZED, u))
    ball += (s.ball - ball) * e
    fold += (s.fold - fold) * e
    twist += s.twist * e
    if (u < ANTICIPATE) scale *= 1 - 0.04 * Math.sin(Math.PI * (u / ANTICIPATE))
    else if (u > SQUEEZED && u < 1) {
      const v = (u - SQUEEZED) / (1 - SQUEEZED)
      scale *= 1 + 0.12 * (1 - v) ** 1.5 * Math.sin(2 * Math.PI * v)
    }
  }
  const p = clamp01((T - IGNITE) / (1 - IGNITE))
  // the fire is slow to catch and quickens; at the end the last ash has lived out its PAPER_ASH
  const burn = BURN_FROM + (1 + PAPER_ASH - BURN_FROM) * p ** 1.3
  return {
    ball,
    fold,
    scale,
    spin: [-0.35 * ball, 0.55 * ball, 0.5 * ball + twist],
    burn,
  }
}

/** Elapsed ms snapped to the drawing it falls on: the sheet holds each drawing for 1 / PAPER_FPS s. The last one lands on the end. */
export function onTwos(ms: number): number {
  if (ms >= PAPER_MS) return PAPER_MS
  const step = 1000 / PAPER_FPS
  return Math.floor(ms / step) * step
}
