import { describe, expect, it } from 'vitest'
import { air, airAt, type Blast, embers, LIFE_MS, seeded, spawn, STEP_MS, step } from './embers'

const scale = 800
const blast = (): Blast => ({ cx: 400, cy: 400, at: 330, scale, waves: air(scale, seeded(7)) })

describe('the embers', () => {
  it('ride an air with no sources or sinks', () => {
    const w = air(scale, seeded(3))
    const e = 0.01
    for (const [x, y] of [
      [10, 20],
      [400, 300],
      [777, 51],
    ]) {
      const div = (airAt(w, x + e, y, 1)[0] - airAt(w, x - e, y, 1)[0] + airAt(w, x, y + e, 1)[1] - airAt(w, x, y - e, 1)[1]) / (2 * e)
      expect(Math.abs(div)).toBeLessThan(1e-3)
    }
  })

  it('are thrown out from the ball and blown wider by the landing', () => {
    const b = blast()
    const run = (withBlast: boolean) => {
      const e = embers(10)
      spawn(e, b, 500, 400, 300, 3000, [1, 1, 1], 0, () => 0.5)
      const bb = withBlast ? b : { ...b, at: 1e9 }
      for (let t = 300; t < 600; t += STEP_MS) step(e, bb, t, STEP_MS)
      return e.x[0]
    }
    expect(run(false)).toBeGreaterThan(500)
    expect(run(true)).toBeGreaterThan(run(false))
  })

  it('go out when their life is over, and never outlive the end', () => {
    const b = blast()
    const e = embers(100)
    const rand = seeded(1)
    for (let i = 0; i < 100; i++) spawn(e, b, 400 + i, 400, 300, 1500, [1, 1, 1], 0, rand)
    expect(e.n).toBe(100)
    for (let i = 0; i < e.n; i++) expect(e.life[i]).toBeLessThanOrEqual(1200)
    for (let t = 300; t <= 300 + LIFE_MS[1]; t += STEP_MS) step(e, b, t, STEP_MS)
    expect(e.n).toBe(0)
  })

  it('stop at the cap', () => {
    const e = embers(3)
    for (let i = 0; i < 5; i++) spawn(e, blast(), 0, 0, 0, 2000, [0, 0, 0], 0, Math.random)
    expect(e.n).toBe(3)
  })

  it('replay the same from the same seed', () => {
    const a = seeded(42)
    const b = seeded(42)
    for (let i = 0; i < 5; i++) expect(a()).toBe(b())
  })
})
