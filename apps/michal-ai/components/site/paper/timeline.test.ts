import { describe, expect, it } from 'vitest'
import { PAPER_FPS, PAPER_MS, PAPER_PHASES } from './config'
import { crumpleAt, frameAt, onTwos, tossAt, windupAt, type Dims } from './timeline'

const dims: Dims = { w: 1280, h: 800, R: 160 }

describe('paper transition timeline', () => {
  it('runs about a second in all, split over the three phases', () => {
    expect(PAPER_MS).toBeGreaterThanOrEqual(800)
    expect(PAPER_MS).toBeLessThanOrEqual(2000)
    expect(PAPER_PHASES.crumple + PAPER_PHASES.windup + PAPER_PHASES.toss).toBeCloseTo(1)
  })

  it('starts on the flat page exactly where it is', () => {
    expect(frameAt(0, dims)).toMatchObject({ ball: 0, fold: 0, wrinkle: 0, x: 0, y: 0, lift: 1, scale: 1, stretch: 1 })
  })

  it('draws in before it crumples, and overshoots once the ball has formed', () => {
    expect(crumpleAt(0.07).scale).toBeLessThan(1)
    expect(crumpleAt(0.07).ball).toBe(0)
    expect(Math.max(...[0.88, 0.9, 0.92].map((t) => crumpleAt(t).scale))).toBeGreaterThan(1)
    expect(crumpleAt(1).scale).toBeCloseTo(1, 1)
  })

  it('hands the ball from one phase to the next without a jump, bar the release', () => {
    const [c, w0, w1, t0] = [crumpleAt(1), windupAt(0, dims), windupAt(1, dims), tossAt(0, dims)]
    expect(w0.ball).toBeCloseTo(c.ball)
    expect(w0.spin).toEqual(c.spin)
    expect([t0.x, t0.y, t0.lift]).toEqual([w1.x, w1.y, w1.lift])
    expect(t0.spin[2]).toBeCloseTo(w1.spin[2])
    // squashed on the wind-up, stretched on the release
    expect(w1.stretch).toBeLessThan(1)
    expect(t0.stretch).toBeGreaterThan(1.3)
  })

  it('ends with the ball off screen', () => {
    const end = frameAt(1, dims)
    expect(end.x - dims.R * 1.5 * end.lift * end.stretch).toBeGreaterThan(dims.w / 2)
    expect(end.shadow).toBe(0)
  })

  it('holds each drawing for two frames at 24 fps, and lands on the end', () => {
    expect(PAPER_FPS).toBe(12)
    expect(onTwos(0)).toBe(0)
    expect(onTwos(80)).toBe(0)
    expect(onTwos(90)).toBeCloseTo(1000 / 12)
    expect(onTwos(PAPER_MS + 5)).toBe(PAPER_MS)
  })
})
