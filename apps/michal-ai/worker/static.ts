// Serving the prerendered site from Workers static assets: trailing slashes, legacy redirects, share cards, content types, 404.
// Pure routing helpers live here so they can be unit tested; worker/index.ts wires them to `env.ASSETS`.
import { REDIRECTS } from './redirects.generated'

/** Where a path should be redirected (301/308 family), or null. Trailing slash is dropped first, query is kept. */
export function redirectFor(pathname: string, search: string): string | null {
  // Repeated slashes collapse and a trailing slash goes, in one hop (Next did the same).
  const collapsed = pathname.replace(/\/{2,}/g, '/')
  const trimmed = collapsed.length > 1 && collapsed.endsWith('/') ? collapsed.replace(/\/+$/, '') : collapsed
  const dest = REDIRECTS[trimmed]
  if (dest) return dest + search
  if (trimmed !== pathname) return (trimmed || '/') + search
  return null
}

/** Next served `/index.html` and `*.html` as 404 (pages live at their clean URL); the asset binding would 307 them to the clean URL. */
export const isHtmlFilePath = (pathname: string) => /\.html$/.test(pathname)

/** Single `bytes=a-b` / `bytes=a-` / `bytes=-n` range of a body of `size` bytes, or null (no range, unsatisfiable, or multiple ranges). */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '')
  if (!m || (m[1] === '' && m[2] === '') || size <= 0) return null
  let start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1])
  let end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  if (m[1] !== '' && m[2] === '') end = size - 1
  if (start > end || start >= size) return null
  start = Math.max(0, start)
  return { start, end }
}

/** `/writing/x/opengraph-image` (or twitter-image): the prerender step stores the PNG under /_og/ (extensionless URLs keep today's tags valid). */
export function shareCardAsset(pathname: string): string | null {
  const m = /^(.*)\/(opengraph|twitter)-image$/.exec(pathname)
  return m ? `/_og${m[1]}/${m[2]}-image.png` : null
}

const FEED_TYPES: [RegExp, string][] = [
  [/^\/(projects\/[^/]+\/)?feed\.xml$/, 'application/rss+xml; charset=utf-8'],
  [/^\/feed\.json$/, 'application/feed+json; charset=utf-8'],
  [/^\/sitemap\.xml$/, 'application/xml'],
  [/^\/manifest\.webmanifest$/, 'application/manifest+json'],
  [/^\/favicon\.ico$/, 'image/x-icon'],
  // Loader results written at build time. React Router refuses to decode them without this type.
  [/\.data$/, 'text/x-script; charset=utf-8'],
]
/** Content types the previous build sent that the asset binding would guess differently from the file extension. */
export const contentTypeFor = (pathname: string) => FEED_TYPES.find(([re]) => re.test(pathname))?.[1]

/** Client navigations request `<path>.data` (loader results written at build time); they must never get the HTML 404 page. */
export const isDataRequest = (pathname: string) => pathname.endsWith('.data')
