import { describe, expect, it } from 'vitest'
import { PAPER_ASH, PAPER_FPS, PAPER_MS } from './config'
import { IGNITE_MS, SQUEEZES, flickerAt, frameAt } from './timeline'

const at = (T: number) => frameAt(T)
const ts = Array.from({ length: 401 }, (_, i) => i / 400)
const ms = (m: number) => m / PAPER_MS

describe('paper transition timeline', () => {
  it('runs in about a second', () => {
    expect(PAPER_MS).toBeGreaterThanOrEqual(800)
    expect(PAPER_MS).toBeLessThanOrEqual(1400)
  })

  it('starts on the flat page exactly where it is, not yet lit', () => {
    expect(at(0)).toMatchObject({ ball: 0, fold: 0, squash: 0, spin: [-0, 0, 0] })
    expect(at(0).burn).toBeLessThan(0)
  })

  it('moves smoothly: no jump between frames at 60 fps', () => {
    const step = 1000 / 60 / PAPER_MS
    for (let T = 0; T < 1; T += step) {
      expect(Math.abs(at(T + step).ball - at(T).ball)).toBeLessThan(0.08)
      expect(Math.abs(at(T + step).squash - at(T).squash)).toBeLessThan(0.08)
    }
  })

  it('crumples in three springy squeezes, overshooting only a breath, and rests at the ball', () => {
    const v = ts.slice(1).map((T, i) => at(T).ball - at(ts[i]).ball)
    const peaks = v.filter((x, i) => i > 0 && i < v.length - 1 && x > v[i - 1] && x >= v[i + 1] && x > 0.003)
    expect(peaks).toHaveLength(3)
    for (const T of ts) expect(at(T).ball).toBeLessThan(1.02)
    expect(at(ms(SQUEEZES[2].at + 400)).ball).toBeCloseTo(1, 2)
    expect(at(1).ball).toBe(1)
  })

  it('squishes at each squeeze and springs back just past round', () => {
    for (const s of SQUEEZES) {
      const window = ts.filter((T) => T * PAPER_MS >= s.at && T * PAPER_MS < s.at + 230)
      const most = Math.max(...window.map((T) => at(T).squash))
      expect(most).toBeGreaterThan(0.08)
      expect(most).toBeLessThan(0.2)
    }
    const back = Math.min(...ts.map((T) => at(T).squash))
    expect(back).toBeLessThan(-0.01)
    expect(back).toBeGreaterThan(-0.06)
    expect(at(1).squash).toBe(0)
  })

  it('lights during the second squeeze and burns until the last ash is gone', () => {
    expect(IGNITE_MS).toBeGreaterThan(SQUEEZES[1].at)
    expect(IGNITE_MS).toBeLessThan(SQUEEZES[2].at)
    expect(at(ms(IGNITE_MS)).burn).toBeLessThan(0)
    for (let i = 1; i < ts.length; i++) expect(at(ts[i]).burn).toBeGreaterThanOrEqual(at(ts[i - 1]).burn)
    expect(at(1).burn).toBeCloseTo(1 + PAPER_ASH)
  })

  it('flickers the glyphs on twos', () => {
    expect(PAPER_FPS).toBe(12)
    expect(flickerAt(0, PAPER_FPS)).toBe(0)
    expect(flickerAt(80, PAPER_FPS)).toBe(0)
    expect(flickerAt(90, PAPER_FPS)).toBe(1)
  })
})
