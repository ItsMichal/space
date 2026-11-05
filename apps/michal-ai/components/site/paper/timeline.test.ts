import { describe, expect, it } from 'vitest'
import { PAPER_MS, PAPER_PHASES } from './config'
import { crumpleAt, smoothAt, unfoldAt, wrinkleLeft } from './timeline'

describe('paper transition timeline', () => {
  it('runs one to two seconds in all, split over the three phases', () => {
    expect(PAPER_MS).toBeGreaterThanOrEqual(1000)
    expect(PAPER_MS).toBeLessThanOrEqual(2000)
    expect(PAPER_PHASES.crumple + PAPER_PHASES.unfold + PAPER_PHASES.smooth).toBeCloseTo(1)
  })

  it('starts on the flat old page and ends on the clean new page', () => {
    expect(crumpleAt(0)).toEqual({ ball: 0, fold: 0, wrinkle: 0, smooth: 0, mix: 0 })
    const end = smoothAt(1)
    expect(end).toMatchObject({ ball: 0, fold: 0, smooth: 1, mix: 1 })
    // fully smoothed, no crease is left anywhere on the sheet
    for (const d of [0, 0.5, 1]) expect(wrinkleLeft(end.smooth, d)).toBe(0)
  })

  it('meets at the ball and at the wrinkled landing without a jump', () => {
    const ball = crumpleAt(1)
    const opening = unfoldAt(0)
    expect(ball.ball).toBeCloseTo(1)
    expect(opening.ball).toBeCloseTo(ball.ball)
    expect(opening.fold).toBeCloseTo(ball.fold)
    const landed = unfoldAt(1)
    const smoothing = smoothAt(0)
    expect(landed).toMatchObject({ ball: 0, fold: 0, mix: 1 })
    expect(smoothing.ball).toBe(landed.ball)
    expect(smoothing.wrinkle).toBe(landed.wrinkle)
    expect(smoothing.smooth).toBe(0)
  })

  it('presses the creases out from the centre first', () => {
    expect(wrinkleLeft(0.4, 0)).toBeLessThan(wrinkleLeft(0.4, 1))
  })
})
