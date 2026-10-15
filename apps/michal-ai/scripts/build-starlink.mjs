// Refreshes public/globe/starlink.bin (the committed Starlink snapshot for the hero globe) from CelesTrak's SupGP file.
// Never fails the build: offline, rate-limited or any error keeps the committed snapshot. Rules:
//   - CI (process.env.CI) never fetches; it uses the committed snapshot.
//   - Only refreshes when the committed snapshot's reference epoch is older than 12 h.
//   - CelesTrak asks for at most one download of a file per 2 h: the raw response is cached in .cache/ (ignored by git) and
//     reused; a fetch is never attempted when that copy is younger than 2 h. Force a refresh with STARLINK_REFRESH=1 (still
//     subject to the 2 h rule).
import fs from 'node:fs'
import path from 'node:path'
import { packOmm, unpack } from '../lib/starlink/orbit.mjs'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const out = path.join(root, 'public', 'globe', 'starlink.bin')
const cache = path.join(root, '.cache', 'celestrak-starlink.json')
const URL_SUPGP = 'https://celestrak.org/NORAD/elements/supplemental/sup-gp.php?FILE=starlink&FORMAT=json'
const FRESH_S = 12 * 3600
const MIN_FETCH_GAP_MS = 2 * 3600 * 1000

function snapshotAge() {
  try {
    const p = unpack(fs.readFileSync(out))
    return p ? Date.now() / 1000 - p.refEpoch : Infinity
  } catch {
    return Infinity
  }
}

async function main() {
  const age = snapshotAge()
  if (process.env.CI) return console.log(`starlink: CI, using committed snapshot (${Math.round(age / 3600)} h old)`)
  if (age < FRESH_S && !process.env.STARLINK_REFRESH) return console.log(`starlink: snapshot is ${(age / 3600).toFixed(1)} h old, keeping it`)

  let text = null
  let cacheAge = Infinity
  try {
    cacheAge = Date.now() - fs.statSync(cache).mtimeMs
  } catch {}
  if (cacheAge < MIN_FETCH_GAP_MS) {
    text = fs.readFileSync(cache, 'utf8')
    console.log(`starlink: reusing cached download (${Math.round(cacheAge / 60000)} min old, CelesTrak allows one per 2 h)`)
  } else {
    const res = await fetch(URL_SUPGP, { signal: AbortSignal.timeout(60_000), headers: { 'User-Agent': 'michal.ai build (hero globe snapshot)' } })
    if (!res.ok) return console.warn(`starlink: CelesTrak answered ${res.status}, keeping the committed snapshot`)
    text = await res.text()
    fs.mkdirSync(path.dirname(cache), { recursive: true })
    fs.writeFileSync(cache, text)
  }
  const list = JSON.parse(text)
  if (!Array.isArray(list) || list.length < 1000) return console.warn('starlink: unexpected payload, keeping the committed snapshot')
  const { bytes, count, refEpoch } = packOmm(list)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, bytes)
  console.log(`starlink: wrote ${count} satellites, ${bytes.length} bytes, epoch ${new Date(refEpoch * 1000).toISOString()}`)
}

main().catch((e) => console.warn(`starlink: ${e?.message ?? e}; keeping the committed snapshot`))
