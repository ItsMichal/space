// The fire's glyphs as particles: every glyph cell the fire eats lets go of one glyph, thrown out from the ball, blown wider by the
// blast as the ball hits the floor, then carried on a moving, swirling air that draws upward, and lifted while it is hot. The air is the curl of a few
// travelling waves, so it has no sources or sinks: the glyphs billow and curl round each other as smoke does, never bunching into
// a point. Pure: numbers in, numbers out, no DOM, no GL; the engine (./engine.ts) spawns them from the burnt cells and draws them.

/** The most glyphs in the air at once; past it the fire lets fewer go. */
export const CAP = 6000
/** One step of the sim, ms; the engine runs it at this rate whatever the display's, so a scrub replays a run exactly. */
export const STEP_MS = 1000 / 60

/** How a glyph moves, in shares of the stage's short side (`scale`) a second. */
const THROW = [0.03, 0.13] as const
/** How far the throw may turn off straight out from the ball, radians. */
const THROW_TURN = 0.6
/** The glyph's own speed fades with this time constant, s: a soft push, soon left to the air. */
const DRAG_S = 0.3
/** The blast as the ball lands: its push outward (a second²) and how fast it dies, s. */
const BLAST = 1
const BLAST_S = 0.09
/** The swirling air: its speed, and the wavelengths of its waves. */
const AIR = 0.3
const AIR_WAVES = [0.22, 0.31, 0.47, 0.63] as const
/** The air as a whole draws up, a second: the swirls ride a rising current, so the glyphs go up and away. */
const UPDRAFT = 0.18
/** Hot glyphs rise, a second², fading as they cool. */
const LIFT = 0.3
/** A glyph sits where it burnt at first, then eases into moving over this long, ms: the paper turns to glyphs before they go. */
const SETTLE_MS = 320
/** How long a glyph lives, ms. */
export const LIFE_MS = [900, 1700] as const

export type Embers = {
  n: number
  x: Float32Array
  y: Float32Array
  vx: Float32Array
  vy: Float32Array
  born: Float32Array
  life: Float32Array
  /** A fixed random per glyph, 0 to 1: its flicker and its glyph. */
  seed: Float32Array
  /** The page colour it burnt from, and how much that was ink rather than paper (0 to 1). */
  r: Float32Array
  g: Float32Array
  b: Float32Array
  ink: Float32Array
}

/** Where the blast comes from and when, the stage's scale, px, and this run's air. y is up. */
export type Blast = { cx: number; cy: number; at: number; scale: number; waves: Wave[] }
type Wave = { kx: number; ky: number; w: number; phase: number; a: number }

export function embers(cap = CAP): Embers {
  const f = () => new Float32Array(cap)
  return { n: 0, x: f(), y: f(), vx: f(), vy: f(), born: f(), life: f(), seed: f(), r: f(), g: f(), b: f(), ink: f() }
}

/** This run's air: waves in random directions at the set wavelengths, each drifting at its own speed. */
export function air(scale: number, rand: () => number): Wave[] {
  return AIR_WAVES.map((l) => {
    const a = rand() * 2 * Math.PI
    const k = (2 * Math.PI) / (l * scale)
    // a stream function of amplitude A over wavenumber k flows at A * k: set A so each wave flows at its share of AIR
    return { kx: Math.cos(a) * k, ky: Math.sin(a) * k, w: 0.5 + rand(), phase: rand() * 2 * Math.PI, a: (AIR * scale) / AIR_WAVES.length / k }
  })
}

/** The air's velocity at a point, px a second: the curl of the stream function sum(A sin(k.p + wt + phase)). */
export function airAt(waves: Wave[], x: number, y: number, t: number): [number, number] {
  let vx = 0
  let vy = 0
  for (const v of waves) {
    const c = v.a * Math.cos(v.kx * x + v.ky * y + v.w * t + v.phase)
    vx += c * v.ky
    vy -= c * v.kx
  }
  return [vx, vy]
}

/** Lets a glyph go at x, y (px, y up) at `ms`, thrown out from the blast's centre. Lives at most until `end`. */
export function spawn(e: Embers, b: Blast, x: number, y: number, ms: number, end: number, rgb: [number, number, number], ink: number, rand: () => number) {
  if (e.n >= e.x.length) return
  const i = e.n++
  const out = Math.atan2(y - b.cy, x - b.cx) + (rand() - 0.5) * 2 * THROW_TURN
  const speed = b.scale * (THROW[0] + (THROW[1] - THROW[0]) * rand())
  e.x[i] = x
  e.y[i] = y
  e.vx[i] = Math.cos(out) * speed
  e.vy[i] = Math.sin(out) * speed
  e.born[i] = ms
  e.life[i] = Math.max(1, Math.min(LIFE_MS[0] + (LIFE_MS[1] - LIFE_MS[0]) * rand(), end - ms))
  e.seed[i] = rand()
  e.r[i] = rgb[0]
  e.g[i] = rgb[1]
  e.b[i] = rgb[2]
  e.ink[i] = ink
}

/** Moves every glyph on by `dt` ms, from `ms`, and drops the ones that have lived out. */
export function step(e: Embers, b: Blast, ms: number, dt: number) {
  const s = dt / 1000
  const t = ms / 1000
  const drag = Math.exp(-s / DRAG_S)
  const since = (ms - b.at) / 1000
  const blast = since > 0 ? b.scale * BLAST * Math.exp(-since / BLAST_S) : 0
  for (let i = 0; i < e.n; i++) {
    const u = (ms - e.born[i]) / e.life[i]
    if (u >= 1) {
      remove(e, i--)
      continue
    }
    if (blast > 0) {
      const dx = e.x[i] - b.cx
      const dy = e.y[i] - b.cy
      const d = Math.hypot(dx, dy) || 1
      // nearer glyphs feel more of it, and each its own share
      const k = (blast * s * (0.6 + 0.8 * e.seed[i])) / (1 + d / b.scale)
      e.vx[i] += (dx / d) * k
      e.vy[i] += (dy / d) * k
    }
    e.vx[i] *= drag
    e.vy[i] = e.vy[i] * drag + b.scale * LIFT * (1 - u) * s
    // the air takes over as the glyph's own speed dies
    const [ax, ay] = airAt(b.waves, e.x[i], e.y[i], t)
    const carry = 0.7 + 0.3 * Math.min(1, u * 3)
    const go = Math.min(1, (ms - e.born[i]) / SETTLE_MS)
    const ease = go * go * (3 - 2 * go)
    e.x[i] += (e.vx[i] + ax * carry) * s * ease
    e.y[i] += (e.vy[i] + (ay + b.scale * UPDRAFT) * carry) * s * ease
  }
}

function remove(e: Embers, i: number) {
  const j = --e.n
  for (const k of ['x', 'y', 'vx', 'vy', 'born', 'life', 'seed', 'r', 'g', 'b', 'ink'] as const) e[k][i] = e[k][j]
}

/** A small seeded random, so a run and its scrub let the same glyphs go. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
