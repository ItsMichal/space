// Loads the packed Starlink elements: the Worker's freshest copy first, then the snapshot committed with the build.
// Anything older than 30 days (reference epoch) is treated as absent, so the globe then simply shows no satellites.
import { isStale, unpack, unpackIds, type Identities, type Packed } from '@/lib/starlink/orbit.mjs'

export type { Identities, Packed }

const SOURCES = [
  { url: '/globe/starlink-live.bin', ids: '/globe/starlink-live-ids.bin' },
  { url: '/globe/starlink.bin', ids: '/globe/starlink-ids.bin' },
]

async function get(url: string): Promise<Packed | null> {
  const r = await fetch(url)
  if (!r.ok) return null
  const p = unpack(await r.arrayBuffer())
  return p && p.count > 0 ? p : null
}

let cache: Promise<Packed | null> | null = null
export function loadStarlink(now = Date.now()): Promise<Packed | null> {
  cache ??= (async () => {
    let best: Packed | null = null
    for (const { url } of SOURCES) {
      try {
        const p = await get(url)
        if (p && !isStale(p.refEpoch, now)) {
          best = p
          break
        }
      } catch {
        // try the next source
      }
    }
    return best
  })()
  return cache
}

/**
 * The same elements plus who each satellite is (identity sidecar), for the character-cell hero's labels. Takes the first source
 * whose constellation file and sidecar belong together (same count and reference epoch); failing that, the first fresh
 * constellation file with `ids: null`, which is what loadStarlink would have returned.
 */
let withIds: Promise<{ sat: Packed; ids: Identities | null } | null> | null = null
export function loadStarlinkWithIds(now = Date.now()): Promise<{ sat: Packed; ids: Identities | null } | null> {
  withIds ??= (async () => {
    let plain: Packed | null = null
    for (const src of SOURCES) {
      try {
        const sat = await get(src.url)
        if (!sat || isStale(sat.refEpoch, now)) continue
        plain ??= sat
        const r = await fetch(src.ids)
        if (!r.ok) continue
        const ids = unpackIds(await r.arrayBuffer(), sat)
        if (ids) return { sat, ids }
      } catch {
        // try the next source
      }
    }
    return plain ? { sat: plain, ids: null } : null
  })()
  return withIds
}
