// Prints the sub-satellite point of a few named satellites from the packed model and from satellite.js (SGP4) at "now".
// Reads the dev copy of the CelesTrak file (.cache/celestrak-starlink.json, written by build-starlink.mjs); never fetches.
// Usage: node scripts/starlink-sanity.mjs [STARLINK-1007 STARLINK-3000 ...]
import fs from 'node:fs'
import path from 'node:path'
import * as sat from 'satellite.js'
import { packOmm, subPoint, unpack } from '../lib/starlink/orbit.mjs'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const all = JSON.parse(fs.readFileSync(path.join(root, '.cache', 'celestrak-starlink.json'), 'utf8'))
const names = process.argv.slice(2)
const picks = names.length ? names.map((n) => all.find((o) => o.OBJECT_NAME === n)).filter(Boolean) : [all[10], all[4000], all[9000]]
const D2R = Math.PI / 180
const now = Date.now() / 1000
for (const o of picks) {
  const { bytes } = packOmm([o])
  const p = unpack(bytes)
  const mine = subPoint(p.data, 0, p.refEpoch, now)
  const d = new Date(now * 1000)
  const pv = sat.propagate(sat.json2satrec(o), d)
  const ecf = sat.eciToEcf(pv.position, sat.gstime(d))
  const lat = Math.atan2(ecf.z, Math.hypot(ecf.x, ecf.y)) / D2R
  const lon = Math.atan2(ecf.y, ecf.x) / D2R
  const c = Math.sin(mine.lat * D2R) * Math.sin(lat * D2R) + Math.cos(mine.lat * D2R) * Math.cos(lat * D2R) * Math.cos((mine.lon - lon) * D2R)
  console.log(`${o.OBJECT_NAME}  model ${mine.lat.toFixed(2)}, ${mine.lon.toFixed(2)}   SGP4 ${lat.toFixed(2)}, ${lon.toFixed(2)}   diff ${(Math.acos(Math.min(1, c)) / D2R).toFixed(3)} deg`)
}
