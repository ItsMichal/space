// Spring and bounce easings as CSS `linear()` strings (the idea and format: Jake Archibald's linear-easing-generator,
// Apache-2.0; this is an independent implementation). A sampled spring runs in plain CSS, on the compositor, and
// CSS transitions retarget from the current value when interrupted, so it is the default for state changes.
import { createSpring, type SpringConfig } from './spring'

export type LinearEasing = { easing: string; duration: number; samples: number[] }

const r = (v: number) => String(Math.round(v * 10000) / 10000)

/** Sample any 0..1 easing function into a `linear()` list. */
export function sampledLinear(fn: (t: number) => number, n = 40): string {
  const pts: string[] = []
  for (let i = 0; i <= n; i++) pts.push(r(fn(i / n)))
  return `linear(${pts.join(', ')})`
}

/**
 * Unit-step response of the velocity-aware spring in `spring.ts`, as a `linear()` easing plus the duration (ms) after
 * which it has settled. Use the returned `duration` with the returned `easing`: they are a pair.
 */
export function linearSpring(cfg: SpringConfig, maxSeconds = 3, eps = 0.0015): LinearEasing {
  const sp = createSpring(0, cfg)
  sp.to(1)
  const dt = 1 / 240
  const trace: number[] = [0]
  let settledAt = maxSeconds
  let lastOut = 0
  for (let t = dt; t <= maxSeconds; t += dt) {
    const s = sp.step(dt)
    trace.push(s.value)
    if (Math.abs(s.value - 1) > eps || Math.abs(s.velocity) > eps * 4) lastOut = t
  }
  settledAt = Math.min(maxSeconds, lastOut + dt)
  const last = Math.max(2, Math.round(settledAt / dt))
  const n = Math.min(48, Math.max(12, Math.round(settledAt * 28)))
  const samples: number[] = []
  for (let i = 0; i <= n; i++) samples.push(i === n ? 1 : trace[Math.round((i / n) * last)])
  return { easing: `linear(${samples.map(r).join(', ')})`, duration: Math.round(settledAt * 1000), samples }
}

/** Largest overshoot of a sampled easing above 1 (0 when critically damped). */
export const overshoot = (samples: number[]) => Math.max(0, Math.max(...samples) - 1)
