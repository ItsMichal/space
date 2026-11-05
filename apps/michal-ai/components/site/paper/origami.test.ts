import { describe, expect, it } from 'vitest'
import { type Fold, MAX_FOLDS, PATTERNS, foldPoint, folded, foldsAt, packet, pieces, place, turns } from './origami'

describe('paper origami', () => {
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    it(`folds a ${w}x${h} sheet into a flower, every fold moving some of it`, () => {
      for (const [name, make] of Object.entries(PATTERNS)) {
        const folds = make(w, h)
        expect(folds.length).toBeLessThanOrEqual(MAX_FOLDS)
        folds.forEach((f, k) => {
          expect(Math.hypot(...f.n)).toBeCloseTo(1, 6)
          // some of the sheet, as it lies after the folds before, is on the moving side
          const before: Fold[] = folds.slice(0, k)
          let moves = false
          for (let j = 0; j <= 20 && !moves; j++)
            for (let i = 0; i <= 20; i++) {
              const [x, y] = folded(before, (i / 20 - 0.5) * w, (j / 20 - 0.5) * h)
              if ((x - f.c[0]) * f.n[0] + (y - f.c[1]) * f.n[1] > 1) moves = true
            }
          expect(moves, `${name} fold ${k}`).toBe(true)
        })
        // a fold made partway over a lifted layer swings that layer out a little, so the flower may spread a bit past the sheet
        const { size } = packet(folds, w, h)
        expect(size[0] * size[1], name).toBeLessThanOrEqual(2 * w * h)
      }
    })
  }

  it('folds a point the way the flat folds do once every fold is made all the way', () => {
    const folds = PATTERNS.lotus(390, 844)
    const turn = turns(folds, folds.map(() => 1))
    for (const [x, y] of [
      [10, 20],
      [-150, 300],
      [120, -380],
    ]) {
      const flat = folded(folds.filter((f) => f.angle >= 1), x, y)
      const [fx, fy] = foldPoint(folds.filter((f) => f.angle >= 1), turns(folds.filter((f) => f.angle >= 1), folds.map(() => 1)), x, y)
      expect(fx).toBeCloseTo(flat[0], 3)
      expect(fy).toBeCloseTo(flat[1], 3)
    }
    expect(turn.length).toBe(folds.length)
  })

  it('cuts the sheet into pieces that cover it whole, each folding as one plate', () => {
    for (const [name, make] of Object.entries(PATTERNS)) {
      const folds = make(390, 844)
      const all = pieces(folds, 390, 844)
      let sum = 0
      for (const p of all) {
        let a = 0
        p.poly.forEach((v, i) => {
          const q = p.poly[(i + 1) % p.poly.length]
          a += v[0] * q[1] - q[0] * v[1]
        })
        sum += Math.abs(a) / 2
        // a point inside the piece folds the way its piece says
        const cx = p.poly.reduce((s, v) => s + v[0], 0) / p.poly.length
        const cy = p.poly.reduce((s, v) => s + v[1], 0) / p.poly.length
        const turn = turns(folds, folds.map(() => 0.6))
        const [x, y, z] = foldPoint(folds, turn, cx, cy)
        const [px, py, pz] = place(folds, p.moves, turn, cx, cy)
        expect(Math.hypot(x - px, y - py, z - pz), name).toBeLessThan(1e-6)
      }
      expect(sum, name).toBeCloseTo(390 * 844, 0)
    }
  })

  it('has thirteen flowers', () => expect(Object.keys(PATTERNS)).toHaveLength(13))

  it('makes the folds one after another, flat at 0 and all made at 1', () => {
    expect(foldsAt(0, 4)).toEqual([0, 0, 0, 0])
    expect(foldsAt(1, 4)).toEqual([1, 1, 1, 1])
    let prev = foldsAt(0, 4)
    for (let t = 0.02; t <= 1; t += 0.02) {
      const now = foldsAt(t, 4)
      now.forEach((f, k) => expect(f).toBeGreaterThanOrEqual(prev[k] - 1e-9))
      // a later fold is never further along than an earlier one
      for (let k = 1; k < 4; k++) expect(now[k]).toBeLessThanOrEqual(now[k - 1])
      prev = now
    }
  })
})
