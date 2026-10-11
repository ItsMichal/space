// A falling petal is a thin plate, not a ball. Face-on it catches air (high drag, slow); edge-on it slices (low drag,
// fast). Its tumble angle theta sweeps through both, so it alternately stalls and slips, and a lift term proportional
// to sin(2*theta) throws it sideways, giving the classic swinging arc. Terminal speed emerges from drag; nothing is
// scripted. `scaleX = |cos(theta)|` is the apparent foreshortening used to render the flat photo texture.
import { mulberry32 } from './rng'

export type PetalState = {
  x: number
  y: number
  vx: number
  vy: number
  /** Tumble angle about the horizontal axis, radians. */
  theta: number
  omega: number
  /** In-plane rotation, radians. */
  rot: number
  rotV: number
  t: number
}

export type PetalParams = {
  gravity: number
  /** Drag per unit speed when edge-on and face-on. */
  dragEdge: number
  dragFace: number
  lift: number
  /** Tumble rate in rad/s and how much it speeds up with sideways velocity. */
  spin: number
}

export const PETAL_DEFAULTS: PetalParams = { gravity: 70, dragEdge: 0.35, dragFace: 2.4, lift: 1.7, spin: 1.5 }

export function createPetal(x: number, y: number, seed = 1): PetalState {
  const r = mulberry32(seed)
  return { x, y, vx: (r() - 0.5) * 20, vy: 0, theta: r() * Math.PI * 2, omega: 1 + r(), rot: (r() - 0.5) * 2, rotV: 0, t: 0 }
}

/** Advance by dt seconds. `wind` is an air velocity in px/s. */
export function stepPetal(s: PetalState, dt: number, wind: { x: number; y: number } = { x: 0, y: 0 }, p: PetalParams = PETAL_DEFAULTS): PetalState {
  const n = Math.max(1, Math.ceil(dt / (1 / 120)))
  const h = dt / n
  let { x, y, vx, vy, theta, omega, rot, rotV, t } = s
  for (let i = 0; i < n; i++) {
    const face = Math.cos(theta) ** 2
    const cd = p.dragEdge + (p.dragFace - p.dragEdge) * face
    const rx = vx - wind.x
    const ry = vy - wind.y
    const speed = Math.hypot(rx, ry)
    const lift = p.lift * Math.sin(2 * theta) * speed * 0.02
    vx += (-cd * speed * rx * 0.012 + lift * Math.abs(ry) * 0.4) * h * 60
    vy += (p.gravity - cd * speed * ry * 0.012) * h
    // the plate rights itself toward falling flat, with a spin that rides the sideways air flow
    const target = p.spin + 0.006 * rx
    omega += (target - omega) * 1.2 * h + Math.sin(theta * 2 + t * 0.7) * 0.9 * h
    theta += omega * h
    // in-plane rotation follows the sideways velocity with inertia (a soft pendulum)
    const aim = Math.max(-1.1, Math.min(1.1, vx * 0.018))
    rotV += ((aim - rot) * 6 - rotV * 2.6) * h
    rot += rotV * h
    x += vx * h
    y += vy * h
    t += h
  }
  return { x, y, vx, vy, theta, omega, rot, rotV, t }
}

/** Apparent horizontal foreshortening, never fully zero so the petal stays a visible sliver. */
export const petalScaleX = (theta: number) => Math.max(0.16, Math.abs(Math.cos(theta)))
