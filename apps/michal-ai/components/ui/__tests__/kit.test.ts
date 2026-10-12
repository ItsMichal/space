import { describe, expect, it } from 'vitest'
import { bounded, dragAxis, focusOf, settleDamping, settleIndex, VelocityTracker } from '../kinetics'
import { createFollowers } from '../craft/followers'
import { rand, seedPath } from '../craft/stroke'
import { springFor, projectMomentum } from '@/components/glass/geometry'
import { springCoeffs, project } from '@space/motion/spring'

describe('kinetics', () => {
  it('estimates velocity from recent samples only', () => {
    const v = new VelocityTracker()
    v.add(0, 0)
    v.add(50, 50)
    v.add(100, 100)
    expect(v.get(105)).toBeCloseTo(1000, 0)
    expect(v.get(400)).toBe(0)
  })
  it('rubber-bands past the limits and not inside', () => {
    expect(bounded(5, 0, 10, 100)).toBe(5)
    const over = bounded(-100, 0, 10, 100)
    expect(over).toBeLessThan(0)
    expect(over).toBeGreaterThan(-100)
    expect(bounded(-400, 0, 10, 100)).toBeGreaterThan(-100)
  })
  it('settles on the nearest detent, carrying velocity', () => {
    expect(settleIndex(2.3, 0, 10)).toBe(2)
    expect(settleIndex(2.6, 0, 10)).toBe(3)
    expect(settleIndex(2.3, 8, 10)).toBeGreaterThan(3)
    expect(settleIndex(2.3, -8, 10)).toBeLessThan(2)
    expect(settleIndex(8.5, 500, 10)).toBe(9)
    expect(settleIndex(0.2, -500, 10)).toBe(0)
    expect(settleIndex(5, 1e6, 100, 6)).toBe(11)
  })
  it('damps critically for gentle releases, a little less for throws', () => {
    expect(settleDamping(0)).toBe(1)
    expect(settleDamping(5000)).toBeCloseTo(0.84)
  })
  it('clamps focus and decides axis', () => {
    expect(focusOf(-1, 5)).toBe(0)
    expect(focusOf(9, 5)).toBe(4)
    expect(dragAxis(2, 1)).toBeNull()
    expect(dragAxis(10, 2)).toBe('x')
    expect(dragAxis(2, 10)).toBe('y')
  })
})

describe('craft', () => {
  it('followers lag and converge', () => {
    const c = createFollowers(4, { response: 0.3, damping: 1 })
    for (let i = 0; i < 6; i++) c.step(1 / 60, 1)
    expect(c.values[0]).toBeGreaterThan(c.values[3])
    for (let i = 0; i < 600; i++) c.step(1 / 60, 1)
    expect(c.values[3]).toBeCloseTo(1, 2)
    expect(c.settled(0.01)).toBe(true)
  })
  it('organic silhouettes are deterministic, closed and not identical', () => {
    expect(rand(3)).toBe(rand(3))
    expect(seedPath(1)).toBe(seedPath(1))
    expect(seedPath(1)).not.toBe(seedPath(2))
  })
})

describe('one spring maths', () => {
  it('glass springFor and momentum projection derive from @space/motion/spring', () => {
    const cfg = springFor(0.5, 1)
    const { k, c } = springCoeffs({ response: 0.5, damping: 1 })
    expect(cfg.stiffness).toBeCloseTo(k)
    expect(cfg.damping).toBeCloseTo(c)
    expect(projectMomentum(800)).toBeCloseTo(project(0, 800))
  })
})
