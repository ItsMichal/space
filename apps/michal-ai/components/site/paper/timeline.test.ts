import { describe, expect, it } from 'vitest'
import { PAPER_ASH, PAPER_FPS, PAPER_MS } from './config'
import { DROPS, FALL_MS, IGNITE_MS, flickerAt, frameAt } from './timeline'

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
      expect(Math.abs(at(T + step).ball - at(T).ball)).toBeLessThan(0.12)
      // the landing snaps from stretched to squished over about two frames, as a ball hitting the floor does
      expect(Math.abs(at(T + step).squash - at(T).squash)).toBeLessThan(0.14)
    }
  })

  it('leaves gently and gathers speed, like a dropped ball', () => {
    const early = at(ms(FALL_MS * 0.25)).ball
    const late = at(ms(FALL_MS * 0.9)).ball
    expect(early).toBeLessThan(0.1 * DROPS[0].ball)
    expect(late).toBeGreaterThan(0.7 * DROPS[0].ball)
  })

  it('lands each drop, rebounds a little way back and settles, never past the ball', () => {
    const first = each(FALL_MS, DROPS[1].at).map((f) => f.ball)
    const back = DROPS[0].ball - Math.min(...first.slice(30))
    expect(back).toBeGreaterThan(0.02 * DROPS[0].ball)
    expect(back).toBeLessThan(0.2 * DROPS[0].ball)
    for (const f of each(0, PAPER_MS)) expect(f.ball).toBeLessThanOrEqual(1)
    expect(at(ms(DROPS[1].at + 500)).ball).toBeCloseTo(1, 2)
    expect(at(1).ball).toBe(1)
  })

  it('squishes on each landing and stretches a little in the air', () => {
    for (const d of DROPS) {
      const most = Math.max(...each(d.at + FALL_MS - 10, d.at + FALL_MS + 80).map((f) => f.squash))
      expect(most).toBeGreaterThan(0.08)
      expect(most).toBeLessThan(0.2)
    }
    const stretch = Math.min(...each(0, PAPER_MS).map((f) => f.squash))
    expect(stretch).toBeLessThan(-0.01)
    expect(stretch).toBeGreaterThan(-0.06)
    expect(at(1).squash).toBe(0)
  })

  it('lights between the drops and burns until the last ash is gone', () => {
    expect(IGNITE_MS).toBeGreaterThan(DROPS[0].at)
    expect(IGNITE_MS).toBeLessThan(DROPS[1].at)
    expect(at(ms(IGNITE_MS)).burn).toBeLessThan(0)
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
