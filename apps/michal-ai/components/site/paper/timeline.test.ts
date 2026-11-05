import { describe, expect, it } from 'vitest'
import { PAPER_ASH, PAPER_FPS, PAPER_MS } from './config'
import { FALL_MS, IGNITE_MS, flickerAt, frameAt } from './timeline'

const at = (T: number) => frameAt(T)
const ms = (m: number) => m / PAPER_MS
const each = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => at(ms(from + i)))

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
      // never faster than the ball hitting the floor (it falls the whole way in FALL_MS, so lands at 2/FALL_MS a ms)
      expect(Math.abs(at(T + step).ball - at(T).ball)).toBeLessThan(((2 / FALL_MS) * 1000) / 60)
      // the landing snaps from stretched to squished over about two frames, as a ball hitting the floor does
      expect(Math.abs(at(T + step).squash - at(T).squash)).toBeLessThan(0.2)
    }
  })

  it('leaves gently and gathers speed, like a dropped ball', () => {
    const early = at(ms(FALL_MS * 0.25)).ball
    const late = at(ms(FALL_MS * 0.9)).ball
    expect(early).toBeLessThan(0.1)
    expect(late).toBeGreaterThan(0.7)
  })

  it('lands, springs back once and settles without a second bounce, never past the ball', () => {
    const after = each(FALL_MS + 30, 600).map((f) => f.ball)
    const low = after.indexOf(Math.min(...after))
    expect(1 - after[low]).toBeGreaterThan(0.15)
    expect(1 - after[low]).toBeLessThan(0.4)
    // once it is back down it stays down
    const down = after.findIndex((b, i) => i > low && b > 0.999)
    for (const b of after.slice(down)) expect(b).toBeGreaterThan(0.999)
    for (const f of each(0, PAPER_MS)) expect(f.ball).toBeLessThanOrEqual(1)
    expect(at(ms(400)).ball).toBeCloseTo(1, 2)
    expect(at(1).ball).toBe(1)
  })

  it('squishes on landing and stretches a little in the air', () => {
    const most = Math.max(...each(FALL_MS - 10, FALL_MS + 80).map((f) => f.squash))
    expect(most).toBeGreaterThan(0.08)
    expect(most).toBeLessThan(0.2)
    const stretch = Math.min(...each(0, PAPER_MS).map((f) => f.squash))
    expect(stretch).toBeLessThan(-0.01)
    expect(stretch).toBeGreaterThan(-0.06)
    expect(at(1).squash).toBe(0)
  })

  it('is burning before it is fully crumpled, and burns until the last ash is gone', () => {
    expect(IGNITE_MS).toBeLessThan(FALL_MS)
    expect(at(ms(IGNITE_MS)).burn).toBeLessThan(0)
    expect(at(ms(FALL_MS)).burn).toBeGreaterThan(0)
    const burns = each(0, PAPER_MS).map((f) => f.burn)
    for (let i = 1; i < burns.length; i++) expect(burns[i]).toBeGreaterThanOrEqual(burns[i - 1])
    expect(at(1).burn).toBeCloseTo(1 + PAPER_ASH)
  })

  it('flickers the glyphs on twos', () => {
    expect(PAPER_FPS).toBe(12)
    expect(flickerAt(0, PAPER_FPS)).toBe(0)
    expect(flickerAt(80, PAPER_FPS)).toBe(0)
    expect(flickerAt(90, PAPER_FPS)).toBe(1)
  })
})
