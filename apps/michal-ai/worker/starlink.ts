// Fresh Starlink elements for the hero globe. A Cron Trigger (every 6 h) downloads CelesTrak's SupGP file, packs it
// (lib/starlink/orbit.mjs, the same code the build script uses) and keeps the result in the ReactionsRoom Durable Object under a
// fixed name, as one SQLite row. GET /globe/starlink-live.bin serves it, falling back to the static snapshot in the assets.
// Deliberately NOT behind LIVE_KILL (that switch is for presence and reactions); the globe only ever degrades to the snapshot.
import { packOmm, unpack, type Omm } from '../lib/starlink/orbit.mjs'

export interface StarlinkEnv {
  REACTIONS: DurableObjectNamespace
  ASSETS: Fetcher
}

export const STARLINK_LIVE_PATH = '/globe/starlink-live.bin'
const SOURCE = 'https://celestrak.org/NORAD/elements/supplemental/sup-gp.php?FILE=starlink&FORMAT=json'
const OBJECT = '~starlink' // never a valid post slug, so it cannot collide with a reactions room
const KEY = 'starlink'
const MIN_GAP_S = 2 * 3600 // CelesTrak: never fetch the same file more often than every 2 hours
const CACHE_CONTROL = 'public, max-age=3600, s-maxage=21600'

const room = (env: StarlinkEnv) => env.REACTIONS.get(env.REACTIONS.idFromName(OBJECT))
const blobUrl = `https://reactions.internal/blob?k=${KEY}`

export async function handleStarlinkRead(request: Request, env: StarlinkEnv): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
  const base = { 'Content-Type': 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' }
  try {
    const r = await room(env).fetch(blobUrl)
    if (r.ok) return new Response(request.method === 'HEAD' ? null : r.body, { headers: { ...base, 'Cache-Control': CACHE_CONTROL } })
  } catch {
    // fall through to the snapshot
  }
  const url = new URL(request.url)
  const snap = await env.ASSETS.fetch(new Request(new URL('/globe/starlink.bin', url)))
  if (!snap.ok) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  return new Response(request.method === 'HEAD' ? null : snap.body, { headers: { ...base, 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } })
}

/** Cron entry. Returns a short status string (logged). Never throws. */
export async function refreshStarlink(env: StarlinkEnv): Promise<string> {
  try {
    const cur = await room(env).fetch(blobUrl)
    if (cur.ok) {
      const updated = Number(cur.headers.get('x-updated') ?? 0)
      if (Date.now() / 1000 - updated < MIN_GAP_S) return 'skipped: stored copy is younger than 2 h'
    }
    const res = await fetch(SOURCE, { headers: { 'User-Agent': 'michal.ai worker (hero globe, every 6 h)' } })
    if (!res.ok) return `CelesTrak answered ${res.status}`
    const list = (await res.json()) as Omm[]
    if (!Array.isArray(list) || list.length < 1000) return 'unexpected payload'
    const { bytes, count } = packOmm(list)
    if (!unpack(bytes)) return 'pack failed'
    const put = await room(env).fetch(blobUrl, { method: 'PUT', body: bytes })
    return put.ok ? `stored ${count} satellites, ${bytes.length} bytes` : `store failed ${put.status}`
  } catch (e) {
    return `error: ${e instanceof Error ? e.message : 'unknown'}`
  }
}
