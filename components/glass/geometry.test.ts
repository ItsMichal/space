import { describe, expect, it } from 'vitest'
import { glass, Glass } from './glass'
import {
  FOLLOW,
  MORPH,
  PRESS,
  RIM_PEAK,
  flipTone,
  luminance,
  projectMomentum,
  resolveRadius,
  rimHeight,
  rimShift,
  rimSlope,
  rubberBand,
  sdRoundRect,
  smin,
  springFor,
  springSettled,
  stepSpring,
  unionSdf,
  type Spring,
} from './geometry'

describe('Glass descriptor', () => {
  it('is immutable and chainable', () => {
    const base = glass.regular
    const t = base.tint('red').interactive()
    expect(base.tintColor).toBeNull()
    expect(base.isInteractive).toBe(false)
    expect(t.tintColor).toBe('red')
    expect(t.isInteractive).toBe(true)
    expect(t.variant).toBe('regular')
    expect(t.tint(null).tintColor).toBeNull()
    expect(t.interactive(false).isInteractive).toBe(false)
    expect(glass.clear.variant).toBe('clear')
    expect(glass.identity.variant).toBe('identity')
  })
  it('compares by value and exposes a stable key', () => {
    expect(glass.regular.tint('a').equals(new Glass('regular', 'a'))).toBe(true)
    expect(glass.regular.tint('a').equals(glass.regular.tint('b'))).toBe(false)
    expect(glass.regular.interactive().key).toBe('regular||1')
  })
})

describe('shapes', () => {
  it('resolves radii', () => {
    expect(resolveRadius('capsule', 100, 40)).toBe(20)
    expect(resolveRadius('circle', 40, 40)).toBe(20)
    expect(resolveRadius('rect', 100, 40)).toBe(0)
    expect(resolveRadius({ cornerRadius: 12 }, 100, 40)).toBe(12)
    expect(resolveRadius({ cornerRadius: 99 }, 100, 40)).toBe(20)
    expect(resolveRadius('containerConcentric', 100, 40, 15)).toBe(15)
    expect(resolveRadius('inherit', 100, 40, 9999)).toBe(20)
  })
})

describe('SDF union', () => {
  const a = { cx: 0, cy: 0, hx: 20, hy: 20, r: 20 }
  const b = (x: number) => ({ cx: x, cy: 0, hx: 20, hy: 20, r: 20 })

  it('round rect distance is signed', () => {
    expect(sdRoundRect(0, 0, 0, 0, 20, 20, 20)).toBeCloseTo(-20)
    expect(sdRoundRect(20, 0, 0, 0, 20, 20, 20)).toBeCloseTo(0)
    expect(sdRoundRect(30, 0, 0, 0, 20, 20, 20)).toBeCloseTo(10)
  })

  it('smin equals min far apart and dips when close', () => {
    expect(smin(5, 100, 24)).toBe(5)
    expect(smin(5, 5, 24)).toBeCloseTo(5 - 24 / 4)
    expect(smin(1, 2, 0)).toBe(1)
    expect(smin(5, 8, 24)).toBeLessThan(5)
  })

  it('shapes within spacing bridge; shapes beyond do not', () => {
    // midpoint of two circles, 8px apart edge to edge: fused with spacing 24
    const near = unionSdf(24, 0, [a, b(48)], 24)
    expect(near).toBeLessThan(0)
    // same gap with spacing 0 stays separated
    expect(unionSdf(24, 0, [a, b(48)], 0)).toBeGreaterThan(0)
    // far apart: midpoint stays outside
    expect(unionSdf(60, 0, [a, b(120)], 24)).toBeGreaterThan(0)
  })

  it('splits again smoothly as the shapes move apart', () => {
    let prev = -Infinity
    for (let gap = 0; gap <= 60; gap += 4) {
      const v = unionSdf(20 + gap / 2 + 0, 0, [a, b(40 + gap)], 24)
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = v
    }
  })

  it('same union group fuses with the wider union radius', () => {
    const g1 = { ...a, group: 0 }
    const g2 = { ...b(70), group: 0 }
    const plain = unionSdf(35, 0, [a, b(70)], 12, 48)
    const fused = unionSdf(35, 0, [g1, g2], 12, 48)
    expect(fused).toBeLessThan(plain)
  })
})

describe('lens profile', () => {
  it('is a convex squircle from 0 at the silhouette to 1 inside', () => {
    expect(rimHeight(0)).toBeCloseTo(0, 5)
    expect(rimHeight(1)).toBeCloseTo(1, 5)
    expect(rimHeight(0.5)).toBeGreaterThan(0.5)
    expect(rimSlope(1)).toBeCloseTo(0, 5)
  })
  it('refracts with Snell at n=1.5: zero in the flat interior, bounded by the peak', () => {
    expect(rimShift(1)).toBeCloseTo(0, 5)
    expect(RIM_PEAK).toBeGreaterThan(0)
    for (let t = 0.01; t <= 1; t += 0.01) expect(Math.abs(rimShift(t))).toBeLessThanOrEqual(RIM_PEAK + 1e-9)
    // maximum bend angle cannot exceed the critical limit: asin(1/1.5) leaves a finite shift
    expect(Number.isFinite(rimShift(0.001))).toBe(true)
  })
})

describe('springs (Designing Fluid Interfaces)', () => {
  const run = (cfg: { stiffness: number; damping: number }, from: number, to: number, v = 0, seconds = 3) => {
    const s: Spring = { x: from, v }
    let peak = from
    const trace: number[] = []
    for (let t = 0; t < seconds; t += 1 / 120) {
      stepSpring(s, to, cfg, 1 / 120)
      peak = to > from ? Math.max(peak, s.x) : Math.min(peak, s.x)
      trace.push(s.x)
    }
    return { s, peak, trace }
  }

  it('critically damped defaults never overshoot', () => {
    for (const cfg of [FOLLOW, MORPH, PRESS, springFor(0.5)]) {
      const { peak, s } = run(cfg, 0, 100)
      expect(peak).toBeLessThanOrEqual(100.001)
      expect(springSettled(s, 100, 0.05)).toBe(true)
    }
  })
  it('morph settles in about 600-900ms, viscous but not sluggish', () => {
    const { trace } = run(MORPH, 0, 1)
    const settledAt = trace.findIndex((x, i) => trace.slice(i).every((y) => Math.abs(y - 1) < 0.02)) / 120
    expect(settledAt).toBeGreaterThan(0.45)
    expect(settledAt).toBeLessThan(1.0)
  })
  it('damping 0.85 gives a hint of bounce, 1.0 none', () => {
    expect(run(springFor(0.5, 0.85), 0, 100).peak).toBeGreaterThan(100.2)
    expect(run(springFor(0.5, 1), 0, 100).peak).toBeLessThanOrEqual(100.001)
  })
  it('retargeting carries velocity: no snap, no discontinuity', () => {
    const s: Spring = { x: 0, v: 0 }
    for (let i = 0; i < 20; i++) stepSpring(s, 100, MORPH, 1 / 120)
    const x0 = s.x
    const v0 = s.v
    expect(v0).toBeGreaterThan(0)
    stepSpring(s, 0, MORPH, 1 / 120) // reverse mid-flight
    expect(Math.abs(s.x - x0)).toBeLessThan(2)
    expect(s.v).toBeLessThan(v0 + 1e-9) // decelerates smoothly rather than jumping
  })
  it('projects momentum and rubber-bands past limits', () => {
    expect(projectMomentum(1000)).toBeCloseTo(499, 0)
    expect(projectMomentum(-500)).toBeLessThan(0)
    expect(rubberBand(50, 0, 100)).toBe(50)
    const over = rubberBand(160, 0, 100)
    expect(over).toBeGreaterThan(100)
    expect(over).toBeLessThan(160)
    expect(rubberBand(-60, 0, 100)).toBeLessThan(0)
  })
})

describe('adaptive tone', () => {
  it('flips with hysteresis', () => {
    expect(flipTone(0.3, false)).toBe(true)
    expect(flipTone(0.42, false)).toBe(false)
    expect(flipTone(0.42, true)).toBe(true)
    expect(flipTone(0.6, true)).toBe(false)
  })
  it('computes relative luminance', () => {
    expect(luminance(1, 1, 1)).toBeCloseTo(1)
    expect(luminance(0, 0, 0)).toBe(0)
    expect(luminance(0, 1, 0)).toBeGreaterThan(luminance(1, 0, 0))
  })
})
