import { describe, expect, it } from 'vitest'
import { bounded, dragAxis, focusOf, settleDamping, settleIndex, VelocityTracker } from '../kinetics'
import { createChain, springEasing } from '../craft/chain'
import { bladePath, leafPath, railPath, rand, stemPath } from '../craft/stroke'

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
  it('chain followers lag and converge', () => {
    const c = createChain(4, { response: 0.3, damping: 1 })
    for (let i = 0; i < 6; i++) c.step(1 / 60, 1)
    expect(c.values[0]).toBeGreaterThan(c.values[3])
    for (let i = 0; i < 600; i++) c.step(1 / 60, 1)
    expect(c.values[3]).toBeCloseTo(1, 2)
    expect(c.settled(0.01)).toBe(true)
  })
  it('spring easing is monotone when critically damped, overshoots when not', () => {
    const a = springEasing(0.5, 1)
    expect(a.easing.startsWith('linear(0')).toBe(true)
    const nums = (s: string) => s.slice(7, -1).split(',').map(Number)
    expect(Math.max(...nums(a.easing))).toBeLessThanOrEqual(1)
    expect(Math.max(...nums(springEasing(0.5, 0.7).easing))).toBeGreaterThan(1)
    expect(a.duration).toBeGreaterThan(300)
  })
  it('hand-drawn geometry is deterministic and closed', () => {
    expect(rand(3)).toBe(rand(3))
    expect(stemPath(200, { seed: 2 })).toBe(stemPath(200, { seed: 2 }))
    expect(stemPath(200, { seed: 2 })).not.toBe(stemPath(200, { seed: 3 }))
    expect(stemPath(100).endsWith('Z')).toBe(true)
    expect(railPath(100).startsWith('M')).toBe(true)
    expect(leafPath(20)).toMatch(/Z$/)
    const b = bladePath(5)
    expect(b.h).toBeGreaterThan(0)
    expect(b.h).toBeLessThanOrEqual(9)
  })
})
