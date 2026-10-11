import { createSpring, type Spring, type SpringConfig } from '@/lib/motion/spring'

/**
 * Follow-through: a leader value drives a chain of followers, each a little softer and later than the one before, so a
 * disturbance travels through the set instead of everything moving as one block. The chain owns no timing: call
 * `step(dt, leader)` from the host's frame loop. Pure and unit-testable.
 */
export type Chain = {
  readonly values: number[]
  step(dt: number, leader: number): void
  settled(eps?: number): boolean
  reset(v: number): void
}

export function createChain(n: number, base: SpringConfig, lag = 0.12, initial = 0): Chain {
  const springs: Spring[] = Array.from({ length: n }, (_, i) =>
    createSpring(initial, { response: base.response * (1 + lag * i), damping: base.damping })
  )
  const values = new Array<number>(n).fill(initial)
  return {
    values,
    step(dt, leader) {
      let prev = leader
      for (let i = 0; i < n; i++) {
        springs[i].to(prev)
        values[i] = springs[i].step(dt).value
        prev = values[i]
      }
    },
    settled(eps = 0.001) {
      return springs.every((s) => Math.abs(s.state.value - s.state.target) < eps && Math.abs(s.state.velocity) < eps)
    },
    reset(v) {
      springs.forEach((s) => s.set(v))
      values.fill(v)
    },
  }
}

/**
 * A CSS `linear()` easing sampled from a real spring (response seconds, damping ratio), so CSS transitions get the
 * same physical curve as the JS springs, including the small overshoot of an underdamped one. Returns the
 * function string and the duration (ms) that makes it look settled.
 */
export function springEasing(response: number, damping = 1, samples = 36): { easing: string; duration: number } {
  const w = (2 * Math.PI) / response
  const zeta = damping
  const duration = Math.min(4000, Math.max(120, (zeta >= 1 ? 6.9 / w : 6.9 / (zeta * w)) * 1000))
  const pts: number[] = []
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * (duration / 1000)
    let x: number
    if (zeta >= 1) x = 1 - (1 + w * t) * Math.exp(-w * t)
    else {
      const wd = w * Math.sqrt(1 - zeta * zeta)
      x = 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t))
    }
    pts.push(Math.round(x * 1000) / 1000)
  }
  pts[pts.length - 1] = 1
  return { easing: `linear(${pts.join(', ')})`, duration: Math.round(duration) }
}
