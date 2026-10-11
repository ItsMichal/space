// Host-based behaviour for the Worker, as pure functions so it can be unit tested.
export const CANONICAL_ORIGIN = 'https://michal.ai'

/** Hosts that permanently redirect to the canonical origin (same path and query). */
const REDIRECT_HOSTS = new Set(['michal.us', 'www.michal.us', 'www.michal.ai'])

/** The 308 target for a request URL, or null when the host is canonical, a preview, or local. */
export function canonicalRedirect(requestUrl: string): string | null {
  const url = new URL(requestUrl)
  if (!REDIRECT_HOSTS.has(url.hostname.toLowerCase())) return null
  return `${CANONICAL_ORIGIN}${url.pathname}${url.search}`
}

/** Preview deployments on *.workers.dev must not be indexed. */
export const isPreviewHost = (hostname: string) => hostname.toLowerCase().endsWith('.workers.dev')
