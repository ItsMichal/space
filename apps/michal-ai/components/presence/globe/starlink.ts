// Loads the packed Starlink elements: the Worker's freshest copy first, then the snapshot committed with the build.
// Anything older than 30 days (reference epoch) is treated as absent, so the globe then simply shows no satellites.
import { isStale, unpack, type Packed } from '@/lib/starlink/orbit.mjs'

export type { Packed }

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
    for (const url of ['/globe/starlink-live.bin', '/globe/starlink.bin']) {
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
