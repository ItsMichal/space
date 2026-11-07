import { describe, expect, it } from 'vitest'
import {
  type Fold,
  MAX_FOLDS,
  PATTERNS,
  SQUARING,
  bakedMesh,
  bakedPlace,
  foldPoint,
  folded,
  foldsAt,
  foldsMade,
  mesh,
  packet,
  pieces,
  place,
  pose,
  reaches,
  sides,
} from './origami'

const area = (poly: [number, number][]) => {
  let a = 0
  poly.forEach((v, i) => {
    const q = poly[(i + 1) % poly.length]
    a += v[0] * q[1] - q[0] * v[1]
  })
  return Math.abs(a) / 2
}

describe('paper origami', () => {
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    it(`folds a ${w}x${h} sheet into a flower, every fold moving some of it`, () => {
      for (const [name, make] of Object.entries(PATTERNS)) {
        const { folds } = make(w, h)
        expect(folds.length).toBeLessThanOrEqual(MAX_FOLDS)
        folds.forEach((f, k) => {
          expect(Math.hypot(...f.n)).toBeCloseTo(1, 6)
          // some of the sheet is among what it moves
          const upTo: Fold[] = folds.slice(0, k + 1)
          let moves = false
          for (let j = 0; j <= 40 && !moves; j++)
            for (let i = 0; i <= 40; i++) if (sides(upTo, (i / 40 - 0.5) * w, (j / 40 - 0.5) * h)[k]) moves = true
          expect(moves, `${name} fold ${k}`).toBe(true)
        })
        // folded, the flower is much smaller than the sheet
        const { size } = packet(folds, w, h)
        expect(size[0] * size[1], name).toBeLessThan(w * h)
      }
    })
  }

  it('folds a point the way the flat folds do once every fold is made all the way', () => {
    const folds = PATTERNS.tulip(390, 844).folds.filter((f) => f.angle >= 1)
    const all = pieces(folds, 390, 844)
    const done = pose(
      folds,
      folds.map(() => 1),
      reaches(folds, all),
    )
    for (const [x, y] of [
      [10, 20],
      [-150, 300],
      [120, -380],
    ]) {
      const flat = folded(folds, x, y)
      const [fx, fy] = foldPoint(folds, done, x, y)
      expect(fx).toBeCloseTo(flat[0], 3)
      expect(fy).toBeCloseTo(flat[1], 3)
    }
  })

  it('cuts the sheet into pieces that cover it whole, each folding as one plate', () => {
    for (const [name, make] of Object.entries(PATTERNS)) {
      const { folds } = make(390, 844)
      const all = pieces(folds, 390, 844)
      const at = pose(
        folds,
        folds.map(() => 0.6),
        reaches(folds, all),
      )
      let sum = 0
      for (const p of all) {
        sum += area(p.poly)
        // a point inside the piece folds the way its piece says
        const cx = p.poly.reduce((s, v) => s + v[0], 0) / p.poly.length
        const cy = p.poly.reduce((s, v) => s + v[1], 0) / p.poly.length
        const [x, y, z] = foldPoint(folds, at, cx, cy)
        const [px, py, pz] = place(folds, p.moves, at, cx, cy)
        expect(Math.hypot(x - px, y - py, z - pz), name).toBeLessThan(1e-6)
      }
      expect(sum, name).toBeCloseTo(390 * 844, 0)
    }
  })

  it('meshes every piece whole, in small triangles', () => {
    const { folds } = PATTERNS.tulip(390, 844)
    const all = pieces(folds, 390, 844)
    const m = mesh(folds, all, 8)
    let sum = 0
    for (let i = 0; i < m.index.length; i += 3) {
      const tri = [0, 1, 2].map((j) => [m.flat[2 * m.index[i + j]], m.flat[2 * m.index[i + j] + 1]] as [number, number])
      sum += area(tri)
      // every triangle is of one piece
      expect(new Set([0, 1, 2].map((j) => m.of[m.index[i + j]])).size).toBe(1)
    }
    expect(sum).toBeCloseTo(390 * 844, 0)
  })

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

  it('makes a fold marked with the one before it at the same moment, as a reverse fold is made', () => {
    const { folds } = PATTERNS.swan(390, 844)
    for (let t = 0; t <= 1; t += 0.05) {
      const made = foldsMade(folds, t)
      folds.forEach((f, k) => {
        if (f.with) expect(made[k]).toBe(made[k - 1])
      })
    }
    expect(foldsMade(folds, 1).every((m) => m === 1)).toBe(true)
  })

  it('folds a baked model from the squared page without a jump, its sheet covering the page whole', () => {
    for (const name of ['crane', 'bird'])
      for (const [w, h] of [
        [390, 844],
        [1440, 900],
      ]) {
        const d = PATTERNS[name](w, h)
        const all = pieces(d.folds, w, h)
        const reach = reaches(d.folds, all)
        const m = bakedMesh(d, w, h, 12)
        let sum = 0
        for (let i = 0; i < m.index.length; i += 3)
          sum += area([0, 1, 2].map((j) => [m.flat[2 * m.index[i + j]], m.flat[2 * m.index[i + j] + 1]] as [number, number]))
        expect(sum / (w * h), name).toBeCloseTo(1, 3)
        const before = new Float32Array(m.on.length * 3)
        const after = new Float32Array(m.on.length * 3)
        bakedPlace(d, m, all, reach, SQUARING - 1e-6, before)
        bakedPlace(d, m, all, reach, SQUARING + 1e-6, after)
        let worst = 0
        for (let i = 0; i < before.length; i++) worst = Math.max(worst, Math.abs(before[i] - after[i]))
        expect(worst, `${name} ${w}x${h}`).toBeLessThan(4)
      }
  })
})
