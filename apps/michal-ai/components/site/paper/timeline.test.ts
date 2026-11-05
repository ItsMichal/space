import { describe, expect, it } from 'vitest'
import { CRUMPLE_MS, FIRE_MS, FRONT_MS, LEAD_MS, PAPER_ASH, PAPER_FPS, PAPER_MS } from './config'
import { FALL_MS, IGNITE_MS, STILL, flickerAt, frameAt, randomCrumple } from './timeline'

const at = (T: number) => frameAt(T)
const ms = (m: number) => m / PAPER_MS
const each = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => at(ms(from + i)))

describe('paper transition timeline', () => {
  it('crumples in 780ms and burns for two seconds, overlapping', () => {
    expect(CRUMPLE_MS).toBe(780)
    expect(FIRE_MS).toBe(2000)
    expect(PAPER_MS).toBeLessThan(LEAD_MS + CRUMPLE_MS + FIRE_MS)
  })

  it('starts on the flat page exactly where it is, not yet lit', () => {
    expect(at(0)).toMatchObject({ ball: 0, fold: 0, squash: 0, lift: 0, spin: [0, 0, 0] })
    expect(at(0).burn).toBeLessThan(0)
  })

  it('slowly starts to crumple through the lead-in, before the drop', () => {
    expect(LEAD_MS).toBe(150)
    expect(at(ms(LEAD_MS / 2)).ball).toBeGreaterThan(0.01)
    expect(at(ms(LEAD_MS)).ball).toBeLessThan(0.2)
    expect(at(ms(LEAD_MS)).burn).toBeLessThan(0)
  })

  it('lifts the page toward the camera in the lead-in, and drops it back down with the ball', () => {
    expect(at(ms(LEAD_MS)).lift).toBeCloseTo(1, 5)
    expect(at(ms(LEAD_MS / 2)).lift).toBeGreaterThan(0.3)
    expect(at(ms(LEAD_MS + FALL_MS)).lift).toBeLessThan(0.01)
    expect(at(1).lift).toBe(0)
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
    const early = at(ms(LEAD_MS + FALL_MS * 0.25)).ball
    const late = at(ms(LEAD_MS + FALL_MS * 0.9)).ball
    expect(early).toBeLessThan(0.2)
    expect(late).toBeGreaterThan(0.7)
  })

  it('lands, springs back once and settles without a second bounce, never past the ball', () => {
    const after = each(LEAD_MS + FALL_MS + 30, PAPER_MS).map((f) => f.ball)
    const low = after.indexOf(Math.min(...after))
    expect(1 - after[low]).toBeGreaterThan(0.08)
    expect(1 - after[low]).toBeLessThan(0.25)
    // once it is back down it stays down
    const down = after.findIndex((b, i) => i > low && b > 0.999)
    for (const b of after.slice(down)) expect(b).toBeGreaterThan(0.999)
    for (const f of each(0, PAPER_MS)) expect(f.ball).toBeLessThanOrEqual(1)
    expect(at(ms(LEAD_MS + CRUMPLE_MS)).ball).toBeCloseTo(1, 2)
    expect(Math.abs(at(ms(LEAD_MS + CRUMPLE_MS)).squash)).toBeLessThan(0.01)
    expect(at(1).ball).toBe(1)
  })

  it('is wrung back and forth from the landing, still by the end of the crumple', () => {
    const turns = each(LEAD_MS + FALL_MS, LEAD_MS + CRUMPLE_MS).map((f) => f.spin[2] - 0.5 * f.ball - 0.1)
    let flips = 0
    for (let i = 1; i < turns.length; i++) if (Math.sign(turns[i]) !== Math.sign(turns[i - 1]) && turns[i] !== 0) flips++
    expect(flips).toBeGreaterThanOrEqual(2)
    expect(Math.max(...turns.map(Math.abs))).toBeGreaterThan(0.05)
    expect(Math.abs(turns[turns.length - 1])).toBeLessThan(0.01)
  })

  it('squishes on landing and stretches a little in the air', () => {
    const most = Math.max(...each(LEAD_MS + FALL_MS - 10, LEAD_MS + FALL_MS + 60).map((f) => f.squash))
    expect(most).toBeGreaterThan(0.08)
    expect(most).toBeLessThan(0.2)
    const stretch = Math.min(...each(0, PAPER_MS).map((f) => f.squash))
    expect(stretch).toBeLessThan(-0.01)
    expect(stretch).toBeGreaterThan(-0.06)
    expect(at(1).squash).toBe(0)
  })

  it('is burning before it is fully crumpled, and burns until the last ash is gone', () => {
    expect(IGNITE_MS).toBeLessThan(LEAD_MS + FALL_MS)
    expect(at(ms(IGNITE_MS)).burn).toBeLessThan(0)
    // lit in the fall, the front still crossing the sheet as it lands and across it as the impact ends
    expect(IGNITE_MS).toBeGreaterThan(LEAD_MS)
    expect(IGNITE_MS).toBeLessThan(LEAD_MS + FALL_MS)
    expect(at(ms(LEAD_MS + FALL_MS)).burn).toBeGreaterThan(0)
    expect(at(ms(LEAD_MS + FALL_MS)).burn).toBeLessThan(1)
    expect(at(ms(FRONT_MS)).burn).toBeCloseTo(1, 5)
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
  it('crumples a little differently each time, from the same flat sheet and with the same fire', () => {
    let k = 0
    const seq = [0.1, 0.9, 0.3, 0.7, 0.5, 0.2, 0.8, 0.4, 0.6, 0.05, 0.95, 0.35, 0.65]
    const c = randomCrumple(() => seq[k++ % seq.length])
    expect(frameAt(0.3)).toEqual(frameAt(0.3, STILL))
    for (const T of [0, 0.4, 1]) {
      expect(frameAt(T, c).ball).toBe(frameAt(T).ball)
      expect(frameAt(T, c).burn).toBe(frameAt(T).burn)
    }
    expect(frameAt(0, c).spin).toEqual([0, 0, 0])
    expect(frameAt(0.6, c).spin).not.toEqual(frameAt(0.6).spin)
    for (let i = 0; i < 50; i++) {
      const r = randomCrumple()
      expect(Math.abs(r.spin[1])).toBeGreaterThanOrEqual(0.35)
      expect(Math.abs(r.spin[1])).toBeLessThanOrEqual(0.7)
      expect(Math.hypot(...r.lead)).toBeLessThanOrEqual(0.35 + 1e-9)
      expect(Math.abs(r.twirl)).toBeGreaterThanOrEqual(0.7)
    }
  })
})
