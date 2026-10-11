// SpringChain: a position-Verlet chain (Jakobsen, "Advanced Character Physics") with a pinned root, distance
// constraints, a soft restoring pull toward an upright rest pose, and a travelling wind. Each node's wind is delayed by
// `phase * index`, so a gust visibly rolls up the stem: overlapping action and follow-through for free. Pure maths,
// no DOM, deterministic.
import type { Pt } from './handStroke'

export type ChainOpts = {
  nodes?: number
  /** Total length in px. */
  length: number
  /** Pull toward the rest pose, per second squared (higher = stiffer stem). */
  stiffness?: number
  /** Velocity retained per second (0..1); lower = more air drag. */
  damping?: number
  /** Wind amplitude in px/s^2 at the tip. */
  wind?: number
  /** Wind frequency (Hz) and per-node delay (radians along the stem). */
  windHz?: number
  phase?: number
  /** Rest direction (radians); default straight up. */
  rest?: number
}

export type SpringChain = {
  readonly pos: Pt[]
  readonly rest: Pt[]
  step(dt: number, t?: number): void
  /** Move the root (e.g. the whole plant is dragged); the rest of the chain follows with lag. */
  pin(x: number, y: number): void
  /** Kick the free nodes sideways, strongest at the tip (a tap, a scroll flick). */
  impulse(vx: number, vy?: number): void
}

export function createChain(root: Pt, o: ChainOpts): SpringChain {
  const n = o.nodes ?? 8
  const seg = o.length / (n - 1)
  const rest = o.rest ?? -Math.PI / 2
  const stiff = o.stiffness ?? 60
  const damp = o.damping ?? 0.12
  const wind = o.wind ?? 0
  const hz = o.windHz ?? 0.35
  const phase = o.phase ?? 0.5
  let rootPt = { ...root }
  const restPts: Pt[] = Array.from({ length: n }, (_, i) => ({ x: root.x + Math.cos(rest) * seg * i, y: root.y + Math.sin(rest) * seg * i }))
  const pos: Pt[] = restPts.map((p) => ({ ...p }))
  const prev: Pt[] = restPts.map((p) => ({ ...p }))

  return {
    pos,
    rest: restPts,
    pin(x, y) {
      rootPt = { x, y }
    },
    impulse(vx, vy = 0) {
      for (let i = 1; i < n; i++) {
        const k = i / (n - 1)
        prev[i].x -= vx * k * k * (1 / 60)
        prev[i].y -= vy * k * k * (1 / 60)
      }
    },
    step(dt, t = 0) {
      const h = Math.min(dt, 1 / 30)
      const shift = { x: rootPt.x - root.x, y: rootPt.y - root.y }
      pos[0] = { x: rootPt.x, y: rootPt.y }
      prev[0] = { x: rootPt.x, y: rootPt.y }
      const keep = Math.pow(damp, h)
      for (let i = 1; i < n; i++) {
        const k = i / (n - 1)
        const vx = (pos[i].x - prev[i].x) * keep
        const vy = (pos[i].y - prev[i].y) * keep
        const w = wind * k * Math.sin(2 * Math.PI * hz * t - phase * i) * (0.7 + 0.3 * Math.sin(2 * Math.PI * hz * 0.37 * t + i))
        const ax = (restPts[i].x + shift.x - pos[i].x) * stiff + w
        const ay = (restPts[i].y + shift.y - pos[i].y) * stiff * 0.6
        prev[i] = { ...pos[i] }
        pos[i] = { x: pos[i].x + vx + ax * h * h, y: pos[i].y + vy + ay * h * h }
      }
      for (let it = 0; it < 5; it++) {
        for (let i = 0; i < n - 1; i++) {
          const a = pos[i]
          const b = pos[i + 1]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const d = Math.hypot(dx, dy) || 1e-6
          const diff = (d - seg) / d
          if (i === 0) {
            b.x -= dx * diff
            b.y -= dy * diff
          } else {
            a.x += dx * diff * 0.5
            a.y += dy * diff * 0.5
            b.x -= dx * diff * 0.5
            b.y -= dy * diff * 0.5
          }
        }
      }
    },
  }
}
