// Private pages (docs/private-pages.md): link-only pages served at /p/<token>, and their analytics beacon.
//
//   GET  /p/<token>          the page, when the token is a link of a page that is open today (not disabled, revoked or expired)
//   POST /api/pages/event    {t, v, e, ms?, href?, ref?} from the page: a view, a visible-time beat, a hide, a link click (always 204)
//
// The page HTML is prerendered at /p/<key> (key: lib/pages/build.mjs, a hash nobody can work back to a token) and the link table at
// /_private/pages.json. The Worker runs first for every request, so neither is reachable from outside: everything under /p/ that is not
// an open token, and everything under /_private/, answers like a page that does not exist. No cookies, no raw IPs: the visitor key is a
// salted hash of IP and user agent that changes every UTC day.
import { linkOpen } from '../lib/content/pages.mjs'
import { createLimiter, ipKey } from '../lib/presence/ratelimit'
import { isBotUserAgent, isSpeculative, originAllowed } from '../lib/presence/validate'
import { deviceOf, parsePageEvent, type PageEvent } from '../lib/pages/stats'
import type { PageStatsRoom } from './page-stats-room'

export type PageManifest = {
  /** token -> the page it opens, where its HTML is, and until when (yyyy-mm-dd; '' no end; null never). */
  links: Record<string, { page: string; key: string; until: string | null }>
  pages: string[]
}

export interface PagesEnv {
  ASSETS: Fetcher
  PAGE_STATS: DurableObjectNamespace<PageStatsRoom>
  /** Optional secret salt for the visitor hash. Without it the live salt or a fixed one is used, with the UTC day. */
  LIVE_SALT?: string
  /** Host on which page events are recorded. Default michal.ai; previews and local development are not, unless set. */
  PAGES_CANONICAL_HOST?: string
}

export const MANIFEST_PATH = '/_private/pages.json'
// The page, or its loader data (a client navigation back to the page from elsewhere on the site fetches /p/<token>.data).
const TOKEN_PATH_RE = /^\/p\/([A-Za-z0-9_-]{22,64})(\.data)?$/
const MAX_BODY = 1024

export const isPrivatePath = (pathname: string) => pathname === '/p' || pathname.startsWith('/p/') || pathname.startsWith('/_private/') || pathname === '/_private'
export const isPageEventPath = (pathname: string) => pathname === '/api/pages/event'

/** Headers every private page response carries: never indexed, never cached by anyone, never a referrer with the token in it. */
export const PRIVATE_HEADERS: Record<string, string> = {
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
}

let cached: { at: number; manifest: PageManifest } | null = null

/** The link table from the build. Kept per isolate for a minute; a deploy replaces the isolates anyway. */
export async function manifestOf(env: Pick<PagesEnv, 'ASSETS'>, origin: string, now = Date.now()): Promise<PageManifest> {
  if (cached && now - cached.at < 60_000) return cached.manifest
  let manifest: PageManifest = { links: {}, pages: [] }
  try {
    const res = await env.ASSETS.fetch(new Request(new URL(MANIFEST_PATH, origin)))
    if (res.ok) {
      const m = (await res.json()) as PageManifest
      if (m && typeof m.links === 'object' && Array.isArray(m.pages)) manifest = m
    }
  } catch {}
  cached = { at: now, manifest }
  return manifest
}

export const resetManifestCache = () => {
  cached = null
}

/** The page a token opens right now, or null. */
export function openLink(manifest: PageManifest, token: string, now = new Date()): { page: string; key: string } | null {
  const l = Object.hasOwn(manifest.links, token) ? manifest.links[token] : undefined
  if (!l || !linkOpen(l.until, now)) return null
  return { page: l.page, key: l.key }
}

/** GET /p/<token> (or /p/<token>.data): the page, or null for "no such page" (the caller answers with the site's 404). */
export async function servePrivatePage(request: Request, env: PagesEnv): Promise<Response | null> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const url = new URL(request.url)
  const m = TOKEN_PATH_RE.exec(url.pathname)
  if (!m) return null
  const hit = openLink(await manifestOf(env, url.origin), m[1])
  if (!hit) return null
  const data = m[2] === '.data'
  const res = await env.ASSETS.fetch(new Request(new URL(`/p/${hit.key}${data ? '.data' : ''}${data ? url.search : ''}`, url), { headers: request.headers }))
  if (!res.ok) return null
  const out = new Response(request.method === 'HEAD' ? null : res.body, { status: 200, headers: res.headers })
  if (!data) out.headers.set('Content-Type', 'text/html; charset=utf-8')
  for (const [k, v] of Object.entries(PRIVATE_HEADERS)) out.headers.set(k, v)
  out.headers.delete('ETag')
  return out
}

/** Why an event is dropped without being recorded (the page always gets 204). */
export function eventIgnored(request: Request, url: URL, env: PagesEnv): string | null {
  if (url.host !== (env.PAGES_CANONICAL_HOST ?? 'michal.ai')) return 'host'
  if (isBotUserAgent(request.headers.get('User-Agent'))) return 'bot'
  if (isSpeculative((n) => request.headers.get(n))) return 'speculative'
  const dest = request.headers.get('Sec-Fetch-Dest')
  if (dest && dest !== 'empty') return 'dest'
  return null
}

/** The visitor key: a hash of the IP and user agent, salted, per page and per UTC day. Not linkable across days or pages. */
export async function visitorKey(ip: string, ua: string, page: string, salt: string, now = Date.now()): Promise<string> {
  return ipKey(`${ip}|${ua}|${page}`, `${salt}|pages`, now)
}

const eventLimit = createLimiter(60, 60_000)
const globalEvents = createLimiter(600, 60_000, 4)

const noContent = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } })
const refuse = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })

/** POST /api/pages/event. Same-origin JSON only; anything that is not a live link of a page is dropped. */
export async function handlePageEvent(request: Request, env: PagesEnv, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } })
  const url = new URL(request.url)
  if (!originAllowed(request.headers.get('Origin'), url.host)) return refuse(403)
  const sfs = request.headers.get('Sec-Fetch-Site')
  if (sfs && sfs !== 'same-origin' && sfs !== 'none') return refuse(403)
  const type = (request.headers.get('Content-Type') ?? '').toLowerCase()
  if (!type.startsWith('application/json') && !type.startsWith('text/plain')) return refuse(415)
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY) return refuse(413)
  const text = await request.text()
  if (text.length > MAX_BODY) return refuse(413)
  let ev: PageEvent | null = null
  try {
    ev = parsePageEvent(JSON.parse(text))
  } catch {}
  if (!ev) return refuse(400)
  if (eventIgnored(request, url, env)) return noContent()
  const hit = openLink(await manifestOf(env, url.origin), ev.t)
  if (!hit) return noContent()
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const ua = request.headers.get('User-Agent') ?? ''
  const salt = env.LIVE_SALT ?? 'space-pages'
  const limitKey = await ipKey(ip, salt)
  if (!eventLimit.hit(limitKey).ok || !globalEvents.hit('all').ok) return noContent()
  const cf = (request.cf ?? {}) as { country?: unknown }
  const country = typeof cf.country === 'string' && /^[A-Z]{2}$/.test(cf.country) ? cf.country : ''
  const visitor = await visitorKey(ip, ua, hit.page, salt)
  const stub = env.PAGE_STATS.get(env.PAGE_STATS.idFromName(hit.page))
  ctx.waitUntil(stub.record({ ...ev, visitor, country, device: deviceOf(ua), now: Date.now() }).catch(() => undefined))
  return noContent()
}
