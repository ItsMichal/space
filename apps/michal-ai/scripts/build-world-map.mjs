// Bakes Natural Earth country shapes (public domain, via the world-atlas TopoJSON redistribution) into lib/maps/world.gen.ts
// for the ::map directive (components/mdx/WorldMap.tsx): a raster of the world in an Equal Earth projection where each pixel
// holds the country it falls in. The map draws its dot matrix by sampling this raster at each dot, and hit-tests the pointer
// against it, so dots and hover agree at any width.
//   ids     the raster's palette: index 0 is outside the map, 1 is sea, 2 on are ISO 3166-1 numeric codes (XK for Kosovo)
//   names   Natural Earth's English name per code (for hovering a country no map lists)
//   rows    per raster row, run-length pairs [palette index, run length]
//   points  a marker point per country (the centre of its largest 10m polygon), for the ones too small to catch a dot
// Run manually (`node scripts/build-world-map.mjs`); the output is committed so builds need no dev dependency.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { feature } from 'topojson-client'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const load = (res) => {
  const topo = JSON.parse(fs.readFileSync(require.resolve(`world-atlas/countries-${res}.json`), 'utf8'))
  return feature(topo, topo.objects.countries).features
}
// Natural Earth gives a few places no ISO number; the one a map can name is Kosovo (XK, a user-assigned code)
const idOf = (f) => f.id ?? (f.properties.name === 'Kosovo' ? 'XK' : null)

// Equal Earth (Šavrič, Patterson, Jenny 2018), W pixels wide
const W = 720
const [A1, A2, A3, A4] = [1.340264, -0.081106, 0.000893, 0.003796]
const M = Math.sqrt(3) / 2
const D = Math.PI / 180
const yOf = (t) => {
  const t2 = t * t
  const t6 = t2 * t2 * t2
  return t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))
}
const raw = (lon, lat) => {
  const t = Math.asin(M * Math.sin(lat * D))
  const t2 = t * t
  const t6 = t2 * t2 * t2
  return [(lon * D * Math.cos(t)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))), yOf(t)]
}
const [xMax] = raw(180, 0)
const [, yMax] = raw(0, 90)
const k = W / (2 * xMax)
const H = Math.round(2 * yMax * k)
/** Pixel centre to [lon, lat] in degrees, or null off the map. */
function invert(px, py) {
  const x = (px + 0.5) / k - xMax
  const y = yMax - (py + 0.5) / k
  let t = y / A1
  for (let i = 0; i < 12; i++) {
    const t2 = t * t
    const t6 = t2 * t2 * t2
    const f = yOf(t) - y
    t -= f / (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))
  }
  const s = Math.sin(t) / M
  if (Math.abs(s) > 1) return null
  const t2 = t * t
  const t6 = t2 * t2 * t2
  const lon = (x * M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))) / Math.cos(t) / D
  return Math.abs(lon) > 180 ? null : [lon, Math.asin(s) / D]
}

const polygons = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [])

/** A ring that crosses the antimeridian (Fiji, Chukotka) is unwrapped east; points west of it are then tested 360 degrees on. */
function unwrap(ring) {
  // a step from +180 to -180 is Antarctica's edge along the bottom of the map, not a crossing
  const crosses = ring.some(([lon], i) => i && Math.abs(lon - ring[i - 1][0]) > 180 && !(Math.abs(lon) === 180 && Math.abs(ring[i - 1][0]) === 180))
  return crosses ? { ring: ring.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat]), wrapped: true } : { ring, wrapped: false }
}
function inRing(ring, x, y) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const bboxOf = (ring) => ring.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity])

// every polygon of every country at 50m, with its holes and bounding box
const ids = ['', 'sea']
const names = {}
const polys = []
for (const f of load('50m')) {
  const id = idOf(f)
  if (!id) continue
  names[id] = f.properties.name
  const at = ids.includes(id) ? ids.indexOf(id) : ids.push(id) - 1
  for (const p of polygons(f.geometry)) {
    const rings = p.map(unwrap)
    polys.push({ at, rings: rings.map((r) => r.ring), wrapped: rings[0].wrapped, box: bboxOf(rings[0].ring) })
  }
}
const hit = (lon, lat) => {
  for (const p of polys) {
    for (const x of p.wrapped && lon < 0 ? [lon, lon + 360] : [lon]) {
      if (x < p.box[0] || x > p.box[2] || lat < p.box[1] || lat > p.box[3]) continue
      if (inRing(p.rings[0], x, lat) && !p.rings.slice(1).some((h) => inRing(h, x, lat))) return p.at
    }
  }
  return 1
}

const rows = []
const seen = new Set()
for (let py = 0; py < H; py++) {
  const runs = []
  for (let px = 0; px < W; px++) {
    const ll = invert(px, py)
    const v = ll ? hit(ll[0], ll[1]) : 0
    seen.add(v)
    if (runs.length && runs[runs.length - 2] === v) runs[runs.length - 1]++
    else runs.push(v, 1)
  }
  rows.push(runs)
}

/** Area and centroid of a ring in degrees (shoelace; fine for picking the biggest piece of a small country). */
function ringStats(ring) {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i]
    const [x1, y1] = ring[i + 1]
    const c = x0 * y1 - x1 * y0
    a += c
    cx += (x0 + x1) * c
    cy += (y0 + y1) * c
  }
  return a ? { area: Math.abs(a / 2), at: [cx / (3 * a), cy / (3 * a)] } : { area: 0, at: ring[0] }
}
const r2 = (n) => Math.round(n * 100) / 100
const toPx = ([lon, lat]) => {
  const [x, y] = raw(lon > 180 ? lon - 360 : lon, lat)
  return [r2((x + xMax) * k), r2((yMax - y) * k)]
}
const points = {}
for (const f of load('10m')) {
  const id = idOf(f)
  if (!id) continue
  names[id] ??= f.properties.name
  const biggest = polygons(f.geometry)
    .map((p) => ringStats(unwrap(p[0]).ring))
    .sort((a, b) => b.area - a.area)[0]
  if (biggest) points[id] = toPx(biggest.at)
}

const out = `// Generated by scripts/build-world-map.mjs from Natural Earth (public domain) via world-atlas. Do not edit by hand.
// A ${W}x${H} Equal Earth raster of countries: WORLD_IDS[0] is off the map, [1] the sea, the rest ISO 3166-1 numeric codes (XK
// for Kosovo); WORLD_ROWS holds each row as run-length pairs [index, length]; WORLD_POINTS a marker point per country in pixels.
export const WORLD_W = ${W}
export const WORLD_H = ${H}
export const WORLD_IDS: string[] = ${JSON.stringify(ids)}
export const WORLD_NAMES: Record<string, string> = ${JSON.stringify(names)}
export const WORLD_ROWS: number[][] = ${JSON.stringify(rows)}
export const WORLD_POINTS: Record<string, [number, number]> = ${JSON.stringify(points)}
`
fs.writeFileSync(path.join(root, 'lib/maps/world.gen.ts'), out)
console.log(`lib/maps/world.gen.ts: ${W}x${H}, ${ids.length - 2} countries (${seen.size - 2} in the raster), ${Object.keys(points).length} points, ${(out.length / 1024).toFixed(1)} KB`)
