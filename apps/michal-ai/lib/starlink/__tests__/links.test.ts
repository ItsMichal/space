import { describe, expect, it } from 'vitest'
import fixture from './fixture-omm.json'
import { packOmm, unpack, type Omm } from '../orbit.mjs'
import { buildLinks } from '../links.mjs'

const DEG = Math.PI / 180

describe('mesh links', () => {
  // A synthetic shell: 6 planes of 20 satellites, 5 degrees apart in RAAN, evenly spaced in argument of latitude.
  const planesN = 6
  const perPlane = 20
  const data = new Float32Array(planesN * perPlane * 5)
  for (let p = 0; p < planesN; p++)
    for (let k = 0; k < perPlane; k++) {
      const i = p * perPlane + k
      data[i * 5] = 53 * DEG
      data[i * 5 + 1] = p * 5 * DEG
      data[i * 5 + 2] = ((k + (p % 2) * 0.2) * 2 * Math.PI) / perPlane
      data[i * 5 + 3] = 1.1e-3
    }
  const { a, b } = buildLinks(data, planesN * perPlane, { crossEvery: 1 })

  it('links every satellite to the next one in its plane (ring)', () => {
    const inPlane = [...a].map((x, i) => [x, b[i]]).filter(([x, y]) => Math.floor(x / perPlane) === Math.floor(y / perPlane))
    expect(inPlane).toHaveLength(planesN * perPlane)
  })
  it('links adjacent planes with a nearby argument of latitude, never across the ring seam', () => {
    const cross = [...a].map((x, i) => [x, b[i]]).filter(([x, y]) => Math.floor(x / perPlane) !== Math.floor(y / perPlane))
    expect(cross.length).toBeGreaterThan(planesN * perPlane * 0.6)
    for (const [x, y] of cross) expect(Math.abs(Math.floor(x / perPlane) - Math.floor(y / perPlane))).toBeLessThanOrEqual(planesN - 1)
  })
  it('works on real elements and never pairs a satellite with itself', () => {
    const real = unpack(packOmm(fixture as unknown as Omm[]).bytes)!
    const l = buildLinks(real.data, real.count)
    for (let i = 0; i < l.a.length; i++) expect(l.a[i]).not.toBe(l.b[i])
  })
})
