// Picks ~50 satellites from the dev copy of the CelesTrak file (.cache/celestrak-starlink.json) for the unit-test fixture.
// Spread over inclinations and mean motions: every k-th record of the list sorted by (inclination, RAAN).
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const all = JSON.parse(fs.readFileSync(path.join(root, '.cache', 'celestrak-starlink.json'), 'utf8'))
const keep = ['OBJECT_NAME', 'OBJECT_ID', 'EPOCH', 'MEAN_MOTION', 'ECCENTRICITY', 'INCLINATION', 'RA_OF_ASC_NODE', 'ARG_OF_PERICENTER', 'MEAN_ANOMALY', 'EPHEMERIS_TYPE', 'CLASSIFICATION_TYPE', 'NORAD_CAT_ID', 'ELEMENT_SET_NO', 'REV_AT_EPOCH', 'BSTAR', 'MEAN_MOTION_DOT', 'MEAN_MOTION_DDOT']
const sorted = all.filter((o) => o.MEAN_MOTION > 14.5 && o.MEAN_MOTION < 16.5).sort((a, b) => a.INCLINATION - b.INCLINATION || a.RA_OF_ASC_NODE - b.RA_OF_ASC_NODE)
const step = Math.floor(sorted.length / 50)
const out = []
for (let i = 0; i < 50; i++) out.push(Object.fromEntries(keep.map((k) => [k, sorted[i * step][k]])))
const dest = path.join(root, 'lib', 'starlink', '__tests__', 'fixture-omm.json')
fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.writeFileSync(dest, JSON.stringify(out))
console.log('wrote', dest, out.length, 'records')
