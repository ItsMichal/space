// Pure timing for the paper transition: what the sheet looks like, and where the ball is, at a moment. No DOM, no GL.
// The motion is posed the way hand animation is: an anticipation before the crumple, an overshoot when the ball forms, a wind-up
// (pulled back, squashed) and a toss (stretched along its path, spinning off screen).
import { PAPER_FPS, PAPER_MS, PAPER_PHASES } from './config'

export type Frame = {
  /** 0 flat sheet, 1 paper ball. */
  ball: number
  /** Large folds, 0 to 1. */
  fold: number
  /** Fine crease relief, 0 to 1. */
  wrinkle: number
  /** The ball's centre on screen, CSS px from the viewport centre, y up. */
  x: number
  y: number
  /** Apparent size: 1 on the desk, above 1 picked up toward the viewer. */
  lift: number
  /** Volume pulse for the squash at the end of the crumple, 1 none. */
  scale: number
  /** Along `dir`: above 1 stretched, below 1 squashed (the cross directions take the inverse root, so the volume holds). */
  stretch: number
  /** Direction of the stretch, radians. */
  dir: number
  /** Euler angles of the ball, radians. */
  spin: [number, number, number]
  /** Contact shadow strength, 0 to 1. */
  shadow: number
}

/** The viewport and the ball radius, CSS px. */
export type Dims = { w: number; h: number; R: number }

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

/** Share of the crumple spent on the anticipation (the sheet draws in a little before it goes). */
const ANTICIPATE = 0.14
/** Where the ball has formed; the rest of the crumple is its overshoot. */
const FORMED = 0.84

/** Step one: the flat old page draws in, wrinkles, folds and is squeezed into a ball that overshoots and settles. */
export function crumpleAt(t: number): Frame {
  t = clamp01(t)
  const ball = easeInOutCubic(smoothstep(ANTICIPATE, FORMED, t))
  let scale = 1
  if (t < ANTICIPATE) scale = 1 - 0.035 * Math.sin(Math.PI * (t / ANTICIPATE))
  else if (t > FORMED) {
    const u = (t - FORMED) / (1 - FORMED)
    scale = 1 + 0.14 * Math.exp(-3 * u) * Math.sin(2.5 * Math.PI * u)
  }
  return {
    ball,
    fold: smoothstep(0.08, 0.6, t),
    wrinkle: smoothstep(0, 0.35, t),
    x: 0,
    y: 0,
    lift: 1,
    scale,
    stretch: 1,
    dir: 0,
    spin: [-0.35 * ball, 0.55 * ball, 0.5 * ball],
    shadow: 1,
  }
}

const pullBack = (d: Dims) => ({ x: -0.045 * d.w, y: -0.035 * d.h })
const LIFT_UP = 1.1

/** The toss path: from the wind-up to past the right edge, arcing up. */
function path(d: Dims) {
  const a = pullBack(d)
  return { x0: a.x, y0: a.y, x1: d.w / 2 + 2.6 * d.R * (LIFT_UP + 0.15), y1: 0.12 * d.h, arc: 0.2 * d.h }
}

/** The launch direction, for the wind-up's squash: it squashes against the way it is about to go. */
function launchDir(d: Dims) {
  const p = path(d)
  return Math.atan2(p.y1 - p.y0 + 4 * p.arc, p.x1 - p.x0)
}

/** Step two, first half: the ball is picked up and pulled back, squashed. */
export function windupAt(t: number, d: Dims): Frame {
  const e = easeOutCubic(clamp01(t))
  const back = pullBack(d)
  return {
    ball: 1,
    fold: 1,
    wrinkle: 1,
    x: back.x * e,
    y: back.y * e,
    lift: 1 + (LIFT_UP - 1) * e,
    scale: 1,
    stretch: 1 - 0.22 * e,
    dir: launchDir(d),
    spin: [-0.35, 0.55, 0.5 + 0.35 * e],
    shadow: 1,
  }
}

/** Step two, second half: the ball is thrown, stretched along its arc and spinning, until it is off screen. */
export function tossAt(t: number, d: Dims): Frame {
  const p = clamp01(t)
  const { x0, y0, x1, y1, arc } = path(d)
  return {
    ball: 1,
    fold: 1,
    wrinkle: 1,
    x: x0 + (x1 - x0) * p,
    y: y0 + (y1 - y0) * p + 4 * arc * p * (1 - p),
    lift: LIFT_UP + 0.15 * p,
    scale: 1,
    stretch: 1.12 + 0.33 * (1 - p) ** 2,
    dir: Math.atan2(y1 - y0 + 4 * arc * (1 - 2 * p), x1 - x0),
    spin: [-0.35 + 2.5 * p, 0.55, 0.85 - 6 * p],
    shadow: 1 - smoothstep(0, 0.5, p),
  }
}

/** The whole animation at `T` (0 to 1 over PAPER_MS). */
export function frameAt(T: number, d: Dims): Frame {
  T = clamp01(T)
  const { crumple, windup } = PAPER_PHASES
  if (T < crumple) return crumpleAt(T / crumple)
  if (T < crumple + windup) return windupAt((T - crumple) / windup, d)
  return tossAt((T - crumple - windup) / (1 - crumple - windup), d)
}

/** Elapsed ms snapped to the drawing it falls on: the sheet holds each drawing for 1 / PAPER_FPS s. The last one lands on the end. */
export function onTwos(ms: number): number {
  if (ms >= PAPER_MS) return PAPER_MS
  const step = 1000 / PAPER_FPS
  return Math.floor(ms / step) * step
}
