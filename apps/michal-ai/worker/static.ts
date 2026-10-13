// Serving the prerendered site from Workers static assets: trailing slashes, legacy redirects, share cards, content types, 404.
// Pure routing helpers live here so they can be unit tested; worker/index.ts wires them to `env.ASSETS`.
import { REDIRECTS } from './redirects.generated'

/** Where a path should be redirected (301/308 family), or null. Trailing slash is dropped first, query is kept. */
export function redirectFor(pathname: string, search: string): string | null {
  const trimmed = pathname.length > 1 && pathname.endsWith('/') ? pathname.replace(/\/+$/, '') : pathname
  const dest = REDIRECTS[trimmed]
  if (dest) return dest + search
  if (trimmed !== pathname) return (trimmed || '/') + search
  return null
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
  // Loader results written at build time. React Router refuses to decode them without this type.
  [/\.data$/, 'text/x-script; charset=utf-8'],
]
/** Content types the previous build sent that the asset binding would guess differently from the file extension. */
export const contentTypeFor = (pathname: string) => FEED_TYPES.find(([re]) => re.test(pathname))?.[1]

/** Client navigations request `<path>.data` (loader results written at build time); they must never get the HTML 404 page. */
export const isDataRequest = (pathname: string) => pathname.endsWith('.data')
