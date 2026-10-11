// A tiny velocity-aware spring. No dependencies, no DOM. Retargeting (`to`) keeps the current position AND velocity,
// so an interrupted animation redirects smoothly instead of snapping or restarting.
//
// Parameterised the way designers think about it: `response` (seconds for a full oscillation cycle, i.e. how quick it
// feels) and `damping` (ratio; 1 = critically damped, no overshoot; ~0.85 = a hint of bounce, for momentum the user gave).

export type SpringConfig = { response: number; damping: number }

export const SPRING_SOFT: SpringConfig = { response: 0.5, damping: 1 }
export const SPRING_MOMENTUM: SpringConfig = { response: 0.45, damping: 0.85 }

export type SpringState = { value: number; velocity: number; target: number }

/** Natural frequency and damping coefficient for a unit mass. */
const coeffs = ({ response, damping }: SpringConfig) => {
  const w = (2 * Math.PI) / Math.max(response, 0.01)
  return { k: w * w, c: 2 * damping * w }
}

/** Advance by `dt` seconds. Sub-steps keep stiff springs stable at low frame rates. Returns a new state. */
export function stepSpring(s: SpringState, cfg: SpringConfig, dt: number): SpringState {
  const { k, c } = coeffs(cfg)
  let { value, velocity } = s
  const n = Math.max(1, Math.ceil(dt / (1 / 240)))
  const h = dt / n
  for (let i = 0; i < n; i++) {
    const a = k * (s.target - value) - c * velocity
    velocity += a * h
    value += velocity * h
  }
  return { value, velocity, target: s.target }
}

export const isSettled = (s: SpringState, eps = 0.001) =>
  Math.abs(s.target - s.value) < eps && Math.abs(s.velocity) < eps

/** Where a throw with `velocity` (units/s) would come to rest, with iOS-style deceleration. Used to pick a destination. */
export function project(value: number, velocity: number, decelerationRate = 0.998) {
  return value + ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

/** Resistance past a limit: the further you drag, the less it moves (rubber band). `range` is the soft scale. */
export function rubberBand(offset: number, range: number, coeff = 0.55) {
  return (1 - 1 / ((offset * coeff) / range + 1)) * range
}

export type Spring = {
  readonly state: SpringState
  /** Retarget from the current value and velocity. Optionally inject velocity (e.g. from a release). */
  to(target: number, velocity?: number): void
  /** Jump to a value with zero velocity (e.g. while the finger drives it 1:1). */
  set(value: number): void
  step(dt: number): SpringState
  /** Change stiffness/damping without touching position or velocity. */
  configure(next: SpringConfig): void
}

export function createSpring(initial: number, cfg: SpringConfig = SPRING_SOFT): Spring {
  let state: SpringState = { value: initial, velocity: 0, target: initial }
  let config = cfg
  return {
    get state() {
      return state
    },
    to(target, velocity) {
      state = { ...state, target, velocity: velocity ?? state.velocity }
    },
    set(value) {
      state = { value, velocity: 0, target: value }
    },
    step(dt) {
      state = stepSpring(state, config, dt)
      return state
    },
    configure(next) {
      config = next
    },
  }
}
