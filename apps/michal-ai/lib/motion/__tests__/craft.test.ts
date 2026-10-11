import { describe, expect, it } from 'vitest'
import { mulberry32, noise1 } from '../rng'
import { catmullRom, cumulative, makeStroke, resample, strokeOutline, widthAt, wobble } from '../handStroke'
import { linearSpring, overshoot, sampledLinear } from '../linearSpring'
import { createChain } from '../springChain'
import { alignClosed, blob, centroid, closedPath, morph, resampleClosed } from '../pathMorph'
import { settleLine, settleTotal } from '../settle'
import { createPetal, petalScaleX, stepPetal } from '../petalPhysics'

describe('rng', () => {
  it('is deterministic per seed and bounded', () => {
    const a = mulberry32(5)
    const b = mulberry32(5)
    for (let i = 0; i < 20; i++) expect(a()).toBe(b())
    for (let x = 0; x < 20; x += 0.37) expect(Math.abs(noise1(x, 3))).toBeLessThanOrEqual(1)
  })
})

describe('handStroke', () => {
  const ctrl = [
    { x: 0, y: 0 },
    { x: 40, y: 6 },
    { x: 80, y: -2 },
    { x: 120, y: 4 },
  ]
  it('resamples equally in arclength', () => {
    const pts = resample(catmullRom(ctrl, 12), 30)
    const c = cumulative(pts)
    const steps = c.slice(1).map((v, i) => v - c[i])
    const mean = steps.reduce((a, b) => a + b) / steps.length
    for (const s of steps) expect(Math.abs(s - mean) / mean).toBeLessThan(0.05)
  })
  it('wobble is zero at the ends and deterministic', () => {
    const pts = resample(catmullRom(ctrl, 12), 40)
    const w1 = wobble(pts, 9, 3)
    const w2 = wobble(pts, 9, 3)
    expect(w1).toEqual(w2)
    expect(Math.hypot(w1[0].x - pts[0].x, w1[0].y - pts[0].y)).toBeLessThan(1e-9)
    expect(Math.hypot(w1[39].x - pts[39].x, w1[39].y - pts[39].y)).toBeLessThan(0.5)
    expect(w1.some((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y) > 0.3)).toBe(true)
  })
  it('width swells in the belly and is never negative', () => {
    expect(widthAt(0.5)).toBeGreaterThan(widthAt(0))
    for (let u = 0; u <= 1; u += 0.05) expect(widthAt(u)).toBeGreaterThanOrEqual(0)
  })
  it('draws a prefix: empty at 0, growing outline, tapering tip', () => {
    const { pts } = makeStroke(ctrl, { size: 4 })
    expect(strokeOutline(pts, { size: 4 }, 0, 0)).toBe('')
    const a = strokeOutline(pts, { size: 4 }, 0, 0.3)
    const b = strokeOutline(pts, { size: 4 }, 0, 0.8)
    expect(a.length).toBeGreaterThan(20)
    expect(b.length).toBeGreaterThan(a.length)
    expect(strokeOutline(pts, { size: 4 }, 0.5, 1)).toMatch(/^M/)
  })
})

describe('linearSpring', () => {
  it('critically damped never overshoots and ends at 1', () => {
    const e = linearSpring({ response: 0.5, damping: 1 })
    expect(overshoot(e.samples)).toBeLessThan(0.002)
    expect(e.samples.at(-1)).toBe(1)
    expect(e.easing.startsWith('linear(0')).toBe(true)
  })
  it('underdamped overshoots and takes longer than the critical one', () => {
    const soft = linearSpring({ response: 0.5, damping: 1 })
    const bouncy = linearSpring({ response: 0.5, damping: 0.55 })
    expect(overshoot(bouncy.samples)).toBeGreaterThan(0.05)
    expect(bouncy.duration).toBeGreaterThan(soft.duration)
  })
  it('samples arbitrary easings', () => {
    expect(sampledLinear((t) => t * t, 4)).toBe('linear(0, 0.0625, 0.25, 0.5625, 1)')
  })
})

describe('springChain', () => {
  it('keeps segment lengths and the pinned root', () => {
    const ch = createChain({ x: 50, y: 100 }, { length: 70, nodes: 8, wind: 4000 })
    for (let i = 0; i < 240; i++) ch.step(1 / 60, i / 60)
    expect(ch.pos[0]).toEqual({ x: 50, y: 100 })
    const seg = 70 / 7
    for (let i = 0; i < 7; i++) {
      const d = Math.hypot(ch.pos[i + 1].x - ch.pos[i].x, ch.pos[i + 1].y - ch.pos[i].y)
      expect(Math.abs(d - seg) / seg).toBeLessThan(0.08)
    }
  })
  it('returns to rest without wind and a gust travels up the stem with lag', () => {
    const ch = createChain({ x: 0, y: 0 }, { length: 70, nodes: 8 })
    ch.impulse(400)
    const peakAt: number[] = Array(8).fill(0)
    const peak: number[] = Array(8).fill(0)
    for (let i = 0; i < 90; i++) {
      ch.step(1 / 60, i / 60)
      for (let n = 1; n < 8; n++) {
        const dx = Math.abs(ch.pos[n].x - ch.rest[n].x)
        if (dx > peak[n]) {
          peak[n] = dx
          peakAt[n] = i
        }
      }
    }
    expect(peak[7]).toBeGreaterThan(peak[2])
    for (let i = 0; i < 600; i++) ch.step(1 / 60, 2 + i / 60)
    for (let n = 0; n < 8; n++) expect(Math.abs(ch.pos[n].x - ch.rest[n].x)).toBeLessThan(0.6)
  })
})

describe('pathMorph', () => {
  it('blobs are deterministic and closed-resampling keeps point count', () => {
    expect(blob(3, 10)).toEqual(blob(3, 10))
    expect(resampleClosed(blob(3, 10), 24)).toHaveLength(24)
  })
  it('align minimises travel; morph hits both ends and never collapses mid-way', () => {
    const a = blob(1, 20)
    const b = blob(2, 30, 0.3)
    const [A, B] = alignClosed(a, b, 48)
    const m0 = morph(A, B, 0)
    const m1 = morph(A, B, 1)
    m0.forEach((p, i) => expect(Math.hypot(p.x - A[i].x, p.y - A[i].y)).toBeLessThan(1e-6))
    m1.forEach((p, i) => expect(Math.hypot(p.x - B[i].x, p.y - B[i].y)).toBeLessThan(1e-6))
    const mid = morph(A, B, 0.5)
    const c = centroid(mid)
    const minR = Math.min(...mid.map((p) => Math.hypot(p.x - c.x, p.y - c.y)))
    expect(minR).toBeGreaterThan(8)
    expect(closedPath(mid)).toMatch(/^M.*C.*Z$/)
  })
})

describe('settle', () => {
  it('lines arrive in order with bounded, seeded offsets within design limits', () => {
    const lines = [0, 1, 2, 3].map((i) => settleLine(i))
    for (let i = 1; i < lines.length; i++) expect(lines[i].delay).toBeGreaterThan(lines[i - 1].delay)
    for (const l of lines) {
      expect(l.fromY).toBeLessThanOrEqual(12)
      expect(Math.abs(l.fromRot)).toBeLessThanOrEqual(1)
      expect(l.opacityMs).toBeLessThan(l.moveMs)
    }
    expect(settleLine(2)).toEqual(settleLine(2))
    expect(settleTotal(4)).toBeGreaterThan(lines[3].delay)
  })
})

describe('petal physics', () => {
  it('falls on an arc: bounded speed, finite, swings both ways, tumbles', () => {
    let s = createPetal(0, 0, 4)
    let signChanges = 0
    let prev = 0
    let maxV = 0
    let minScale = 1
    let maxScale = 0
    for (let i = 0; i < 60 * 12; i++) {
      s = stepPetal(s, 1 / 60)
      expect(Number.isFinite(s.x + s.y + s.theta)).toBe(true)
      maxV = Math.max(maxV, Math.hypot(s.vx, s.vy))
      if (Math.sign(s.vx) !== prev && Math.abs(s.vx) > 3) {
        if (prev !== 0) signChanges++
        prev = Math.sign(s.vx)
      }
      const sc = petalScaleX(s.theta)
      minScale = Math.min(minScale, sc)
      maxScale = Math.max(maxScale, sc)
    }
    expect(s.y).toBeGreaterThan(150)
    expect(maxV).toBeLessThan(400)
    expect(signChanges).toBeGreaterThanOrEqual(2)
    expect(maxScale - minScale).toBeGreaterThan(0.6)
  })
  it('wind pushes it downwind', () => {
    let a = createPetal(0, 0, 2)
    let b = createPetal(0, 0, 2)
    for (let i = 0; i < 300; i++) {
      a = stepPetal(a, 1 / 60)
      b = stepPetal(b, 1 / 60, { x: 60, y: 0 })
    }
    expect(b.x).toBeGreaterThan(a.x + 20)
  })
})
