// Pure timing for the paper transition: what the sheet looks like at a moment. No DOM, no GL.
// The crumple is one drop, moving like a bouncy ball dropped on a slightly soft floor: it leaves gently and gathers speed, lands
// and squishes into the floor, rebounds once a little way back and settles on the second landing without bouncing again. It takes
// the flat page to the ball. The motion is a small physics run (gravity, a spring and damper floor), made once and read back by
// time, so everything is a continuous curve, drawn every frame.
// An ember catches late in the fall, before the sheet is fully crumpled, and spreads once the ball has sprung back; what burns turns to glyphs that rise, billow
// outward and fade (drawn by the engine from `burn`).
import { IGNITE_MS, LEAD_MS, PAPER_ASH, PAPER_MS } from './config'

export { IGNITE_MS }

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
export const DROPS = [{ at: LEAD_MS, ball: 1, fold: 1, twist: 0.1, squish: 0.17 }] as const
/** How far the slow crumple of the lead-in gathers the sheet before the drop. */
const LEAD_BALL = 0.08

/** How long a drop falls before it first lands, ms. */
export const FALL_MS = 150
/** How long the ball is in contact with the soft floor on a landing, ms: the squish. */
const CONTACT_MS = 88
/** How much of its speed the ball keeps off the floor; the one rebound rises BOUNCE² of the drop, the next landing stays down. */
const BOUNCE = 0.5
/** How much the ball stretches along its fall at full speed, against its squish. */
const STRETCH = 0.15

/** On landing the ball is wrung, turned back and forth by the hands crumpling it: how far (radians), one swing (ms), its fade (ms). */
const WRING = 0.16
const WRING_MS = 170
const WRING_FADE = 110

/** One drop, run once at 1ms: height above the floor (1 at the start, 0 on the floor, below 0 pressed in) and squish, 0 to 1. */
const DROP = (() => {
  const g = 2 / FALL_MS ** 2
  const lnE = Math.log(BOUNCE)
  const zeta = -lnE / Math.sqrt(Math.PI ** 2 + lnE ** 2)
  const w = Math.PI / CONTACT_MS / Math.sqrt(1 - zeta ** 2)
  const k = w * w
  const c = 2 * zeta * w
  // from the second landing on the floor is critically damped: it squishes and comes to rest, no second bounce
  const still = 2 * w
  const v0 = g * FALL_MS
  const rest = g / k
  const dt = 0.25
  const n = 1000
  const height = new Float32Array(n + 1)
  const speed = new Float32Array(n + 1)
  let x = 1
  let v = 0
  let landings = 0
  for (let i = 0; i <= n * 4; i++) {
    if (i % 4 === 0) {
      height[i / 4] = x
      speed[i / 4] = v
    }
    if (x < 0 && x - v * dt >= 0) landings++
    const a = -g + (x < 0 ? -k * x - (landings > 1 ? still : c) * v : 0)
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

/** The front starts short of the sheet, its burning edge of glyphs too (engine EDGE), so the first drawings are untouched. */
const BURN_FROM = -0.02

/** The whole animation at `T` (0 to 1 over PAPER_MS). */
export function frameAt(T: number): Frame {
  T = clamp01(T)
  const ms = T * PAPER_MS
  let ball = 0
  let fold = 0
  let twist = 0
  let squash = 0
  // the lead-in: the page slowly starts to give, easing in and out so the drop leaves from rest
  const lead = clamp01(ms / LEAD_MS)
  const s = LEAD_BALL * lead * lead * (3 - 2 * lead)
  ball += s
  fold += s
  let prevBall = LEAD_BALL
  let prevFold = LEAD_BALL
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
  // wrung back and forth from the landing, dying out with the bounce
  const since = ms - DROPS[0].at - FALL_MS
  const wring = since > 0 && T < 1 ? WRING * Math.sin((2 * Math.PI * since) / WRING_MS) * Math.exp(-since / WRING_FADE) : 0
  const p = clamp01((ms - IGNITE_MS) / (PAPER_MS - IGNITE_MS))
  // the fire catches as the drop leaves and spreads at once, then the last of it burns out slowly (eased out, so the extra time
  // goes to the tail); at the end the last ash has lived out its PAPER_ASH
  const burn = BURN_FROM + (1 + PAPER_ASH - BURN_FROM) * (1 - (1 - p) ** 2)
  return {
    ball,
    fold,
    squash,
    spin: [-0.35 * ball + 0.3 * wring, 0.55 * ball - 0.5 * wring, 0.5 * ball + twist + wring],
    burn,
  }
}

/** One crumple back and forth of the waiting fringes, ms. */
const WAIT_MS = 420
/** How far the fringes crumple in and out while waiting, in ball. */
const WAIT_BALL = 0.05

/** While the drop waits for the new route at the end of the lead-in, the fringes of the sheet keep crumpling in and back out a
 * little (only the edges gather at this little ball). `waited` is how long it has waited, ms; `fade` 1 while waiting, easing to 0
 * as the drop leaves, so the swing never jumps. */
export function waitingAt(f: Frame, waited: number, fade: number): Frame {
  const k = (WAIT_BALL * fade * (1 - Math.cos((2 * Math.PI * waited) / WAIT_MS))) / 2
  return { ...f, ball: f.ball + k, fold: f.fold + k, spin: [f.spin[0], f.spin[1], f.spin[2] + 0.3 * k] }
}

/** The flicker of the burning glyphs steps on twos (12 a second, as hand-drawn fire does) while the sheet moves every frame. */
export function flickerAt(ms: number, fps: number): number {
  return Math.floor(ms / (1000 / fps))
}
