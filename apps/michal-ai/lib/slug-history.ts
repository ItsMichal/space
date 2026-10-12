// Runtime-safe view of content/redirects.json (no fs): GUID and tint continuity across slug renames.
import map from '@/content/redirects.json'

const MAP = map as Record<string, { from: string[]; key?: string }>
const KEYS = new Map(Object.entries(MAP).flatMap(([to, e]) => (e.key ? [[to.split('/').pop()!, e.key] as const] : [])))

/** Path used as the stable feed id: the URL feeds published before a rename, else the current path. Readers key on it, so never change it. */
export const feedIdPath = (path: string) => MAP[path]?.from[0] ?? path

/** The slug a post had before its first rename. Use wherever a slug seeds something visual (tint) so renames do not recolour. */
export const stableKey = (slug: string) => KEYS.get(slug) ?? slug
