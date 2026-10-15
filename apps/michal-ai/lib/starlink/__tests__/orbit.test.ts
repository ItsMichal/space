import { describe, expect, it } from 'vitest'
import * as sat from 'satellite.js'
import fixture from './fixture-omm.json'
import { epochSeconds, isStale, packOmm, positionEcef, subPoint, unpack, type Omm } from '../orbit.mjs'

const omms = fixture as unknown as Omm[]
const D2R = Math.PI / 180

function sgp4Sub(o: Omm, tSec: number) {
  const rec = sat.json2satrec(o as never)
  const d = new Date(tSec * 1000)
  const pv = sat.propagate(rec, d)
  if (!pv || typeof pv.position === 'boolean' || !pv.position) throw new Error('sgp4 failed')
  const ecf = sat.eciToEcf(pv.position, sat.gstime(d))
  return { lat: Math.atan2(ecf.z, Math.hypot(ecf.x, ecf.y)) / D2R, lon: Math.atan2(ecf.y, ecf.x) / D2R }
}

function angularErrorDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const la = a.lat * D2R
  const lb = b.lat * D2R
  const c = Math.sin(la) * Math.sin(lb) + Math.cos(la) * Math.cos(lb) * Math.cos((a.lon - b.lon) * D2R)
  return Math.acos(Math.min(1, c)) / D2R
}

describe('orbit model vs SGP4', () => {
  const packed = unpack(packOmm(omms).bytes)!
  // Compare at offsets from the newest element epoch (the reference epoch), as the page does.
  const base = packed.refEpoch
  const results: Record<number, { max: number; mean: number }> = {}
  for (const h of [0, 1, 24, 72]) {
    it(`+${h}h`, () => {
      const t = base + h * 3600
      const errs: number[] = []
      // packOmm drops nothing in the fixture, so index i matches omms[i]
      expect(packed.count).toBe(omms.length)
      omms.forEach((o, i) => errs.push(angularErrorDeg(subPoint(packed.data, i, packed.refEpoch, t), sgp4Sub(o, t))))
      const max = Math.max(...errs)
      results[h] = { max, mean: errs.reduce((a, b) => a + b, 0) / errs.length }
      console.log(`+${h}h max ${max.toFixed(3)} deg, mean ${results[h].mean.toFixed(3)} deg`)
      const bound = { 0: 0.3, 1: 0.3, 24: 0.5, 72: 1.5 }[h as 0 | 1 | 24 | 72]
      expect(max).toBeLessThan(bound)
    })
  }
})

describe('packer', () => {
  it('round-trips header and elements', () => {
    const { bytes, count, refEpoch } = packOmm(omms)
    expect(bytes.byteLength).toBe(20 + count * 20)
    const p = unpack(bytes)!
    expect(p.count).toBe(count)
    expect(p.refEpoch).toBe(refEpoch)
    expect(refEpoch).toBe(Math.floor(Math.max(...omms.map((o) => epochSeconds(o.EPOCH)))))
    for (let i = 0; i < count; i++) {
      expect(p.data[i * 5]).toBeCloseTo(omms[i].INCLINATION * D2R, 5)
      expect(p.data[i * 5 + 3]).toBeCloseTo((omms[i].MEAN_MOTION * 2 * Math.PI) / 86400, 4)
    }
  })
  it('rejects junk and drops off-station objects', () => {
    expect(unpack(new Uint8Array(30))).toBeNull()
    const bad = { ...omms[0], MEAN_MOTION: 10 }
    expect(packOmm([bad, omms[1]]).count).toBe(1)
  })
  it('keeps a stable ECEF radius near 1.08 for Starlink shells', () => {
    const p = unpack(packOmm(omms).bytes)!
    const r = Math.hypot(...positionEcef(p.data, 0, p.refEpoch, p.refEpoch))
    expect(r).toBeGreaterThan(1.04)
    expect(r).toBeLessThan(1.1)
  })
})

describe('staleness', () => {
  const ref = 1_800_000_000
  it('draws up to 30 days', () => {
    expect(isStale(ref, (ref + 14 * 86400) * 1000)).toBe(false)
    expect(isStale(ref, (ref + 29.9 * 86400) * 1000)).toBe(false)
  })
  it('does not draw after 30 days or for a nonsense epoch', () => {
    expect(isStale(ref, (ref + 30.1 * 86400) * 1000)).toBe(true)
    expect(isStale(NaN, ref * 1000)).toBe(true)
  })
})
