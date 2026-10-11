import { createSpring, type Spring, type SpringConfig } from '@/lib/motion/spring'

/**
 * Follow-through (a chain of springs; the Verlet stem lives in lib/motion/springChain.ts): a leader value drives a chain of followers, each a little softer and later than the one before, so a
 * disturbance travels through the set instead of everything moving as one block. The chain owns no timing: call
 * `step(dt, leader)` from the host's frame loop. Pure and unit-testable.
 */
export type Followers = {
  readonly values: number[]
  step(dt: number, leader: number): void
  settled(eps?: number): boolean
  reset(v: number): void
}

export function createFollowers(n: number, base: SpringConfig, lag = 0.12, initial = 0): Followers {
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
