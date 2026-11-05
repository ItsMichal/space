// Where the caption overlay gets a cue file when the page did not inline it (the editor's preview and node views; the site
// inlines every cue file at build time, lib/captions/inline.server.ts). Whatever arrives is checked with parseCaptions.
import { parseCaptions, type Cue } from '@/lib/content/rules.mjs'

type Loader = (src: string) => Promise<Uint8Array>

const cache = new Map<string, Cue[]>()
let loader: Loader = async (src) => {
  const res = await fetch(src, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

/** The editor routes loads through its typed client. */
export function setCaptionsLoader(next: Loader) {
  loader = next
}

export const cachedCaptions = (src: string) => cache.get(src) ?? null

export async function loadCaptions(src: string): Promise<Cue[]> {
  const hit = cache.get(src)
  if (hit) return hit
  const parsed = parseCaptions(await loader(src))
  if (!parsed.cues) throw new Error(parsed.problem)
  cache.set(src, parsed.cues)
  return parsed.cues
}
