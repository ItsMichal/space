import { describe, expect, it } from 'vitest'
import { PAPER_ASH, PAPER_FPS, PAPER_MS } from './config'
import { IGNITE, SQUEEZES, frameAt, onTwos } from './timeline'

const at = (T: number) => frameAt(T)
const ts = Array.from({ length: 201 }, (_, i) => i / 200)

describe('paper transition timeline', () => {
  it('runs under two seconds in all', () => {
    expect(PAPER_MS).toBeGreaterThanOrEqual(800)
    expect(PAPER_MS).toBeLessThanOrEqual(2000)
  })

  it('starts on the flat page exactly where it is, not yet lit', () => {
    expect(at(0)).toMatchObject({ ball: 0, fold: 0, scale: 1, spin: [-0, 0, 0] })
    expect(at(0).burn).toBeLessThan(0)
  })

  it('crumples in three squeezes, held in between, never undoing one', () => {
    for (let i = 1; i < ts.length; i++) expect(at(ts[i]).ball).toBeGreaterThanOrEqual(at(ts[i - 1]).ball - 1e-9)
    // the holds between squeezes sit on each squeeze's target
    expect(at(SQUEEZES[1].at).ball).toBeCloseTo(SQUEEZES[0].ball)
    expect(at(SQUEEZES[2].at).ball).toBeCloseTo(SQUEEZES[1].ball)
    expect(at(SQUEEZES[2].at + SQUEEZES[2].len).ball).toBeCloseTo(1)
    // three separate bursts of movement: count the drawings on twos in which the ball moves
    const step = 1000 / PAPER_FPS / PAPER_MS
    let bursts = 0
    let moving = false
    for (let T = 0; T < 1; T += step) {
      const m = at(T + step).ball - at(T).ball > 0.01
      if (m && !moving) bursts++
      moving = m
    }
    expect(bursts).toBe(3)
  })

  it('draws in before each squeeze and overshoots after it, then rests at 1', () => {
    for (const s of SQUEEZES) {
      expect(at(s.at + s.len * 0.12).scale).toBeLessThan(1)
      expect(Math.max(...[0.7, 0.75, 0.8].map((u) => at(s.at + s.len * u).scale))).toBeGreaterThan(1)
      expect(at(s.at + s.len).scale).toBeCloseTo(1, 6)
    }
  })

  it('lights during the second squeeze and burns until the last ash is gone', () => {
    expect(IGNITE).toBeGreaterThan(SQUEEZES[1].at)
    expect(IGNITE).toBeLessThan(SQUEEZES[1].at + SQUEEZES[1].len)
    expect(at(IGNITE).burn).toBeLessThan(0)
    for (let i = 1; i < ts.length; i++) expect(at(ts[i]).burn).toBeGreaterThanOrEqual(at(ts[i - 1]).burn)
    expect(at(1).burn).toBeCloseTo(1 + PAPER_ASH)
  })

  it('holds each drawing for two frames at 24 fps, and lands on the end', () => {
    expect(PAPER_FPS).toBe(12)
    expect(onTwos(0)).toBe(0)
    expect(onTwos(80)).toBe(0)
    expect(onTwos(90)).toBeCloseTo(1000 / 12)
    expect(onTwos(PAPER_MS + 5)).toBe(PAPER_MS)
  })
})
