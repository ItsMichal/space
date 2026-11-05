// Pure timing for the paper transition: what the sheet looks like at a moment. No DOM, no GL.
// The crumple is one drop, moving like a bouncy ball dropped on a slightly soft floor: it leaves gently and gathers speed, lands
// and squishes into the floor, rebounds once a little way back and settles on the second landing without bouncing again. It takes
// the flat page to the ball. The motion is a small physics run (gravity, a spring and damper floor), made once and read back by
// time, so everything is a continuous curve, drawn every frame.
// The folded flower rests a moment, then an ember catches and eats the sheet; what burns turns to glyphs that rise, billow
// outward and fade (drawn by the engine from `burn`).
import { DROP_AT, FOLD_MS, FRONT_MS, IGNITE_MS, LEAD_MS, PAPER_ASH, PAPER_MS } from './config'
import { PATTERNS } from './origami'

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
  /** How far the folding has got, 0 flat to 1 the finished flower: it runs on its own clock through the lifted page, before the drop. */
  bloom: number
  /** How far the sheet is lifted toward the camera, 0 to 1: picked up in the lead-in, it falls back down with the drop. */
  lift: number
  /** The fire front in the sheet's burn field (0 to 1 across the sheet); a spot burns once it is behind it. Below 0 not lit. */
  burn: number
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

/** What differs from one crumple to the next, picked per run (randomCrumple): how far and which way the ball turns on each axis
 * as it gathers, its twist and which way it is wrung, and for the sheet itself (./shaders.ts) where its folds fall, which way it
 * twirls in and which side gathers first. */
export type Crumple = {
  spin: [number, number, number]
  twist: number
  wring: number
  /** Offset into the fold and flap noise, so every sheet creases differently. */
  seed: [number, number]
  /** How far, and which way, the sheet twirls round as it wraps the ball. */
  twirl: number
  /** The side that gathers first (sheet units, y up); its length is how far ahead it runs. */
  lead: [number, number]
  /** The origami flower the sheet folds into (./origami.ts PATTERNS). */
  flower: string
}

/** The crumple as first designed, the same every time: what tests and the default read. */
export const STILL: Crumple = { spin: [-0.35, 0.55, 0.5], twist: 1, wring: 1, seed: [0, 0], twirl: 1.1, lead: [0, 0], flower: 'lotus' }

const FLOWERS = Object.keys(PATTERNS)

/** A crumple of its own, near the designed one: the turn on each axis a little more or less and either way round (the tilt mostly
 * away), the wring either way, the folds anywhere, the twirl either way, a side gathering first, and one of the flowers. */
export function randomCrumple(rand: () => number = Math.random): Crumple {
  const range = (a: number, b: number) => a + (b - a) * rand()
  const sign = () => (rand() < 0.5 ? -1 : 1)
  const a = rand() * 2 * Math.PI
  const l = range(0.1, 0.35)
  return {
    spin: [range(-0.5, 0.15), sign() * range(0.35, 0.7), sign() * range(0.3, 0.7)],
    twist: sign() * range(0.5, 2),
    wring: sign() * range(0.7, 1.3),
    seed: [range(0, 100), range(0, 100)],
    twirl: sign() * range(0.7, 1.5),
    lead: [Math.cos(a) * l, Math.sin(a) * l],
    flower: FLOWERS[Math.floor(rand() * FLOWERS.length)],
  }
}

/** The drops: when each is let go (ms), how far it takes the ball and its folds, its twist, and how hard it squishes on landing. */
export const DROPS = [{ at: DROP_AT, ball: 1, fold: 1, twist: 0.1, squish: 0.17 }] as const
/** How far the slow crumple of the lead-in gathers the sheet before the drop. */
const LEAD_BALL = 0.08

/** How long a drop falls before it first lands, ms. */
export const FALL_MS = 295
/** How long the ball is in contact with the soft floor on a landing, ms: the squish. */
const CONTACT_MS = 105
/** How much of its speed the ball keeps off the floor; the one rebound rises BOUNCE² of the drop, the next landing stays down. */
const BOUNCE = 0.5
/** How much the ball stretches along its fall at full speed, against its squish. */
const STRETCH = 0.15

/** On landing the ball is wrung, turned back and forth by the hands crumpling it: how far (radians), one swing (ms), its fade (ms). */
const WRING = 0.16
const WRING_MS = 200
const WRING_FADE = 130

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
/** The front's speed across the sheet, burn units a ms: steady from catching to FRONT_MS. */
const FRONT_SPEED = (1 - BURN_FROM) / (FRONT_MS - IGNITE_MS)
/** The ash's ease out after the front, 1 - (1 - q)^ASH_EASE over the rest of the time: it leaves at the front's own speed, so the
 * rising glyphs never jolt, and slows to rest as the last of them goes. */
const ASH_EASE = (FRONT_SPEED * (PAPER_MS - FRONT_MS)) / PAPER_ASH

/** The whole animation at `T` (0 to 1 over PAPER_MS), for crumple `c`. */
export function frameAt(T: number, c: Crumple = STILL): Frame {
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
  let fallen = 0
  for (const d of DROPS) {
    const { p, squish } = dropAt(ms - d.at)
    if (d === DROPS[0]) fallen = Math.min(1, p)
    ball += (d.ball - prevBall) * p
    fold += (d.fold - prevFold) * p
    twist += d.twist * c.twist * p
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
  const wring = since > 0 && T < 1 ? c.wring * WRING * Math.sin((2 * Math.PI * since) / WRING_MS) * Math.exp(-since / WRING_FADE) : 0
  // the fire catches once the flower has settled and spreads steadily across it; then the
  // ash burns out slowly (eased out, so the extra time goes to the tail) and at the end the last of it has lived out its PAPER_ASH
  const q = clamp01((ms - FRONT_MS) / (PAPER_MS - FRONT_MS))
  const burn =
    ms < FRONT_MS
      ? BURN_FROM + FRONT_SPEED * Math.max(0, ms - IGNITE_MS)
      : 1 + PAPER_ASH * (1 - (1 - q) ** ASH_EASE)
  // the page is lifted off the desk as the lead-in gathers it, eased in and out, and falls back down with the drop
  const lift = T >= 1 ? 0 : lead * lead * (3 - 2 * lead) * (1 - fallen)
  const bloom = T >= 1 ? 1 : clamp01((ms - LEAD_MS) / FOLD_MS)
  return {
    bloom,
    ball,
    fold,
    squash,
    lift,
    spin: [c.spin[0] * ball + 0.3 * wring, c.spin[1] * ball - 0.5 * wring, c.spin[2] * ball + twist + wring],
    burn,
  }
}

/** One crumple back and forth of the waiting fringes, ms. */
const WAIT_MS = 900
/** How far the fringes crumple in and out while waiting, in ball. */
const WAIT_BALL = 0.025

/** While the drop waits for the new route at the end of the lead-in, the fringes of the sheet keep crumpling in and back out a
 * little (only the edges gather at this little ball). `waited` is how long it has waited, ms; `fade` 1 while waiting, easing to 0
 * as the drop leaves, so the swing never jumps. */
export function waitingAt(f: Frame, waited: number, fade: number): Frame {
  const k = (WAIT_BALL * fade * (1 - Math.cos((2 * Math.PI * waited) / WAIT_MS))) / 2
  return { ...f, ball: f.ball + k, fold: f.fold + k, spin: [f.spin[0], f.spin[1], f.spin[2] + 0.15 * k] }
}

/** The flicker of the burning glyphs steps on twos (12 a second, as hand-drawn fire does) while the sheet moves every frame. */
export function flickerAt(ms: number, fps: number): number {
  return Math.floor(ms / (1000 / fps))
}
