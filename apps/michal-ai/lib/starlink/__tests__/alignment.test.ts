import { describe, expect, it } from 'vitest'
import fixture from './fixture-omm.json'
import { packOmm, positionEcef, subPoint, unpack, type Omm } from '../orbit.mjs'
import { toVec } from '../../presence/geo'
import { projectPoint, rotation } from '../../../components/presence/globe/renderer'

// The satellite shader places a satellite at rot * shell * (ecef.y, ecef.z, ecef.x) / |ecef|, and the land shader places a surface point
// (lat, lon) at rot * toVec(lat, lon) (globe frame: x = east at lon 90, y = north, z = lon 0). For the shell to turn rigidly with the globe,
// the sub-point of a satellite must therefore land on the same direction as that lat/lon on the surface, whatever the globe's spin and tilt.
describe('shell aligned with the globe', () => {
  const p = unpack(packOmm(fixture as unknown as Omm[]).bytes)!
  const times = [p.refEpoch, p.refEpoch + 3 * 3600, p.refEpoch + 41 * 3600]
  const views: [number, number][] = [[18, -100], [18, 37], [-20, 170]] // lat0, lon0 of the decorative spin

  it('the globe-frame direction of a satellite equals toVec of its sub-point', () => {
    for (const t of times)
      for (let i = 0; i < p.count; i += 7) {
        const [x, y, z] = positionEcef(p.data, i, p.refEpoch, t)
        const r = Math.hypot(x, y, z)
        const { lat, lon } = subPoint(p.data, i, p.refEpoch, t)
        const [ex, ey, ez] = toVec(lat, lon)
        expect(y / r).toBeCloseTo(ex, 6)
        expect(z / r).toBeCloseTo(ey, 6)
        expect(x / r).toBeCloseTo(ez, 6)
      }
  })

  it('under any spin and tilt the projected satellite direction equals the projected surface point below it', () => {
    for (const [lat0, lon0] of views) {
      const rot = rotation(lat0, lon0)
      for (const t of times)
        for (let i = 0; i < p.count; i += 11) {
          const [x, y, z] = positionEcef(p.data, i, p.refEpoch, t)
          const r = Math.hypot(x, y, z)
          const v = [0, 1, 2].map((k) => rot[k] * (y / r) + rot[k + 3] * (z / r) + rot[k + 6] * (x / r))
          const { lat, lon } = subPoint(p.data, i, p.refEpoch, t)
          const s = projectPoint(lat, lon, rot)
          expect(v[0]).toBeCloseTo(s.x, 6)
          expect(v[1]).toBeCloseTo(s.y, 6)
          expect(v[2]).toBeCloseTo(s.z, 6)
        }
    }
  })

  it('a spin of the globe moves the satellite exactly as it moves the land beneath it', () => {
    const i = 3
    const t = times[1]
    const { lat, lon } = subPoint(p.data, i, p.refEpoch, t)
    const a = projectPoint(lat, lon, rotation(18, -100))
    const b = projectPoint(lat, lon, rotation(18, -80)) // the globe turned 20 degrees: the land point and the shell point turn together
    const rot2 = rotation(18, -80)
    const [x, y, z] = positionEcef(p.data, i, p.refEpoch, t)
    const r = Math.hypot(x, y, z)
    expect(rot2[0] * (y / r) + rot2[3] * (z / r) + rot2[6] * (x / r)).toBeCloseTo(b.x, 6)
    expect(a.x).not.toBeCloseTo(b.x, 3)
  })
})
