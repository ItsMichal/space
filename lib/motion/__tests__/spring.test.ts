import { describe, expect, it } from 'vitest'
import { createSpring, isSettled, project, rubberBand, SPRING_MOMENTUM } from '../spring'

const run = (sp: ReturnType<typeof createSpring>, seconds: number, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) sp.step(dt)
}

describe('spring', () => {
  it('settles on the target with no overshoot when critically damped', () => {
    const sp = createSpring(0)
    sp.to(100)
    let max = 0
    for (let t = 0; t < 3; t += 1 / 60) max = Math.max(max, sp.step(1 / 60).value)
    expect(max).toBeLessThanOrEqual(100.0001)
    expect(isSettled(sp.state)).toBe(true)
  })

  it('retargeting mid-flight keeps position and velocity (no snap)', () => {
    const sp = createSpring(0)
    sp.to(100)
    run(sp, 0.2)
    const before = sp.state
    expect(before.velocity).toBeGreaterThan(0)
    sp.to(0)
    expect(sp.state.value).toBe(before.value)
    expect(sp.state.velocity).toBe(before.velocity)
    // First frame after the redirect continues in the old direction, then turns around smoothly.
    const next = sp.step(1 / 60)
    expect(Math.abs(next.value - before.value)).toBeLessThan(5)
    run(sp, 3)
    expect(sp.state.value).toBeCloseTo(0, 2)
  })

  it('carries injected release velocity and may overshoot with a hint of bounce', () => {
    const sp = createSpring(0, SPRING_MOMENTUM)
    sp.to(10, 800)
    let max = 0
    for (let t = 0; t < 2; t += 1 / 60) max = Math.max(max, sp.step(1 / 60).value)
    expect(max).toBeGreaterThan(10)
    expect(sp.state.value).toBeCloseTo(10, 1)
  })

  it('projects momentum and rubber-bands past limits', () => {
    expect(project(0, 1000)).toBeGreaterThan(100)
    expect(project(0, -1000)).toBeLessThan(-100)
    expect(rubberBand(0, 100)).toBe(0)
    expect(rubberBand(1000, 100)).toBeLessThan(100)
    expect(rubberBand(200, 100)).toBeGreaterThan(rubberBand(100, 100))
  })
})
