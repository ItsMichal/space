// Where the handwriting player gets an ink file when the page did not inline it (the editor's preview and node views; the
// site inlines every ink file at build time, lib/ink/inline.server.ts). Whatever arrives is checked with parseInk.
import { parseInk, type Ink } from '@/lib/content/rules.mjs'

type Loader = (src: string) => Promise<Uint8Array>

const cache = new Map<string, Ink>()
let loader: Loader = async (src) => {
  const res = await fetch(src, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

/** The editor routes loads through its typed client. */
export function setInkLoader(next: Loader) {
  loader = next
}

/** Keep a drawing the editor already holds (a fresh pad, or one waiting to upload) under its src. */
export function rememberInk(src: string, ink: Ink) {
  cache.set(src, ink)
}

export const cachedInk = (src: string) => cache.get(src) ?? null

export async function loadInk(src: string): Promise<Ink> {
  const hit = cache.get(src)
  if (hit) return hit
  const parsed = parseInk(await loader(src))
  if (!parsed.ink) throw new Error(parsed.problem)
  cache.set(src, parsed.ink)
  return parsed.ink
}
