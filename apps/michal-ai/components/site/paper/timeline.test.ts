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

  it('crumples in three squeezes that run into each other, never undoing one', () => {
    for (let i = 1; i < ts.length; i++) expect(at(ts[i]).ball).toBeGreaterThanOrEqual(at(ts[i - 1]).ball - 1e-9)
    const last = SQUEEZES[2]
    expect(at(last.at + last.len).ball).toBeCloseTo(1)
    // three bursts of speed, slowing between them but not stopping for more than a drawing
    const step = 1000 / PAPER_FPS / PAPER_MS
    const v: number[] = []
    for (let T = 0; T < last.at + last.len; T += step) v.push(at(T + step).ball - at(T).ball)
    const peaks = v.filter((x, i) => i > 0 && i < v.length - 1 && x > v[i - 1] && x >= v[i + 1] && x > 0.02)
    expect(peaks).toHaveLength(3)
    const firstMove = v.findIndex((x) => x > 0)
    const still = v.slice(firstMove, v.length - 1).filter((x) => x < 1e-4).length
    expect(still).toBeLessThanOrEqual(1)
  })

  it('draws in and overshoots only a little, and rests at 1', () => {
    for (const T of ts) expect(Math.abs(at(T).scale - 1)).toBeLessThan(0.06)
    expect(at(SQUEEZES[0].len * 0.07).scale).toBeLessThan(1)
    expect(Math.max(...ts.map((T) => at(T).scale))).toBeGreaterThan(1.02)
    expect(at(1).scale).toBe(1)
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
