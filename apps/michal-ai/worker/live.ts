// Router for /api/live/*: presence socket, reactions and views. Runs before OpenNext; same-origin only (no CORS headers).
//
//   GET  /api/live/reactions?id=<post id>   counts (+ views unless VIEWS_PUBLIC=0); edge-cached 30 s
//   POST /api/live/reactions                {id, target, emoji, sid, on}  toggle one reaction
//   POST /api/live/views                    {id, vid}  count a visit (always 204; counted only for real visits, see viewIgnored)
//
// Counts are keyed by the stable post id (frontmatter `id`), never by URL, and ids are checked against the build-time list.
import { LIVE_LIMITS } from '../lib/presence/constants'
import { placeFromCf } from '../lib/presence/geo'
import { createLimiter, ipKey } from '../lib/presence/ratelimit'
import { LIVE_IDS } from '../lib/presence/slugs.generated'
import { ID_RE, isBotUserAgent, isSpeculative, originAllowed, parseReactionBody, parseViewBody } from '../lib/presence/validate'

export interface LiveEnv {
  PRESENCE: DurableObjectNamespace
  REACTIONS: DurableObjectNamespace
  /** "1" turns the whole feature off: every /api/live/* request answers 204 and the UI hides itself. */
  LIVE_KILL?: string
  /** Optional secret salt for the IP hash. Without it a fixed public salt plus the UTC day is used. */
  LIVE_SALT?: string
  /** "0" hides the view count from GET responses. Counting continues either way. Default: public. */
  VIEWS_PUBLIC?: string
  /** "1" lets clients react to single paragraphs (block targets). Default: only the whole-post row. */
  LIVE_BLOCK_REACTIONS?: string
  /** Host on which views are counted. Default michal.ai; previews and local development are never counted. */
  LIVE_CANONICAL_HOST?: string
}

const IDS = new Set(LIVE_IDS)
const MAX_BODY = 512
const CANONICAL = 'michal.ai'

// Per-isolate guards in front of the Durable Objects. Approximate by design (isolates come and go); the objects enforce
// their own exact limits. A Cloudflare WAF rate rule on /api/live/* is the recommended outer layer.
const connectLimit = createLimiter(20, 60_000)
const readLimit = createLimiter(120, 60_000)
const writeLimit = createLimiter(LIVE_LIMITS.reactWritesPerMin, 60_000)
const viewLimit = createLimiter(LIVE_LIMITS.viewWritesPerMin, 60_000)
const globalWrites = createLimiter(1500, 60_000, 4)

const BASE_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow',
}

function reply(status: number, body?: unknown, extra: Record<string, string> = {}): Response {
  const headers = { ...BASE_HEADERS, ...extra }
  if (body === undefined) return new Response(null, { status, headers })
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } })
}

export function isLivePath(pathname: string): boolean {
  return pathname === '/api/live' || pathname.startsWith('/api/live/')
}

export async function handleLive(request: Request, env: LiveEnv, ctx: ExecutionContext): Promise<Response> {
  if (env.LIVE_KILL === '1') return reply(204, undefined, { 'Cache-Control': 'no-store' })
  const url = new URL(request.url)
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const key = await ipKey(ip, env.LIVE_SALT ?? 'space-live')

  if (url.pathname === '/api/live/presence') return presence(request, env, url, key)
  if (url.pathname === '/api/live/reactions') return reactions(request, env, ctx, url, key)
  if (url.pathname === '/api/live/views') return views(request, env, ctx, url, key)
  return reply(404, { error: 'not_found' }, { 'Cache-Control': 'no-store' })
}

async function presence(request: Request, env: LiveEnv, url: URL, key: string): Promise<Response> {
  if (request.method !== 'GET') return reply(405, { error: 'method' }, { Allow: 'GET' })
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return reply(426, { error: 'upgrade_required' }, { Upgrade: 'websocket' })
  }
  if (!originAllowed(request.headers.get('Origin'), url.host)) return reply(403, { error: 'forbidden_origin' })
  const lim = connectLimit.hit(key)
  if (!lim.ok) return reply(429, { error: 'rate_limited' }, { 'Retry-After': String(lim.retryAfter) })

  // Forward only what the room needs. Client-supplied x-live-* headers are discarded by building fresh headers.
  const place = placeFromCf(request.cf as Record<string, unknown> | undefined)
  const h = new Headers({ Upgrade: 'websocket', 'x-live-ipk': key })
  if (place) h.set('x-live-place', JSON.stringify(place))
  const stub = env.PRESENCE.get(env.PRESENCE.idFromName('global'))
  try {
    return await stub.fetch('https://presence.internal/ws', { headers: h })
  } catch {
    return reply(503, { error: 'unavailable' }, { 'Retry-After': '30' })
  }
}

const cacheOf = () => (caches as unknown as { default: Cache }).default
const cacheKey = (url: URL, id: string) => new Request(`${url.origin}/api/live/reactions?id=${id}`)

/** Same-origin JSON POST gate shared by reactions and views. Returns an error response, or the raw body text. */
async function postGate(request: Request, url: URL): Promise<Response | string> {
  if (!originAllowed(request.headers.get('Origin'), url.host)) return reply(403, { error: 'forbidden_origin' })
  const sfs = request.headers.get('Sec-Fetch-Site')
  if (sfs && sfs !== 'same-origin' && sfs !== 'none') return reply(403, { error: 'forbidden_origin' })
  if (!(request.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json')) return reply(415, { error: 'unsupported_media_type' })
  const declared = Number(request.headers.get('Content-Length') ?? 0)
  if (declared > MAX_BODY) return reply(413, { error: 'payload_too_large' })
  const text = await request.text()
  if (text.length > MAX_BODY) return reply(413, { error: 'payload_too_large' })
  return text
}

async function reactions(request: Request, env: LiveEnv, ctx: ExecutionContext, url: URL, key: string): Promise<Response> {
  const method = request.method
  if (method !== 'GET' && method !== 'POST') return reply(405, { error: 'method' }, { Allow: 'GET, POST' })

  if (method === 'GET') {
    const id = url.searchParams.get('id') ?? ''
    if (!ID_RE.test(id) || !IDS.has(id)) return reply(404, { error: 'not_found' }, { 'Cache-Control': 'no-store' })
    const origin = request.headers.get('Origin')
    if (origin && !originAllowed(origin, url.host)) return reply(403, { error: 'forbidden_origin' })
    const cache = cacheOf()
    const ck = cacheKey(url, id)
    const hit = await cache.match(ck)
    if (hit) return hit
    const lim = readLimit.hit(key)
    if (!lim.ok) return reply(429, { error: 'rate_limited' }, { 'Retry-After': String(lim.retryAfter) })
    try {
      const r = await env.REACTIONS.get(env.REACTIONS.idFromName(id)).fetch(`https://reactions.internal/?id=${id}`, { headers: { 'x-live-ipk': key } })
      if (!r.ok) return reply(r.status === 429 ? 429 : 503, { error: 'unavailable' }, { 'Retry-After': '10' })
      const data = (await r.json()) as Record<string, unknown>
      if (env.VIEWS_PUBLIC === '0') delete data.views
      const out = new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          ...BASE_HEADERS,
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60',
        },
      })
      ctx.waitUntil(cache.put(ck, out.clone()))
      return out
    } catch {
      return reply(503, { error: 'unavailable' }, { 'Retry-After': '10' })
    }
  }

  // POST: same-origin JSON only.
  const gate = await postGate(request, url)
  if (typeof gate !== 'string') return gate
  const lim = writeLimit.hit(key)
  if (!lim.ok || !globalWrites.hit('all').ok) return reply(429, { error: 'rate_limited' }, { 'Retry-After': String(lim.retryAfter || 30) })
  let parsed: unknown
  try {
    parsed = JSON.parse(gate)
  } catch {
    return reply(400, { error: 'bad_request' })
  }
  const b = parseReactionBody(parsed)
  if (!b) {
    const idMaybe = parsed && typeof parsed === 'object' ? (parsed as { id?: unknown }).id : undefined
    return typeof idMaybe === 'string' && ID_RE.test(idMaybe) && !IDS.has(idMaybe)
      ? reply(404, { error: 'not_found' }, { 'Cache-Control': 'no-store' })
      : reply(400, { error: 'bad_request' })
  }
  if (!IDS.has(b.id)) return reply(404, { error: 'not_found' }, { 'Cache-Control': 'no-store' })
  // Paragraph reactions are built but off: refuse block targets unless explicitly enabled.
  if (b.target !== 'post' && env.LIVE_BLOCK_REACTIONS !== '1') return reply(400, { error: 'bad_request' })
  try {
    const r = await env.REACTIONS.get(env.REACTIONS.idFromName(b.id)).fetch('https://reactions.internal/', {
      method: 'POST',
      headers: { 'x-live-ipk': key, 'Content-Type': 'application/json' },
      body: gate,
    })
    const out = new Response(r.body, { status: r.status, headers: { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
    const ra = r.headers.get('Retry-After')
    if (ra) out.headers.set('Retry-After', ra)
    if (r.ok) ctx.waitUntil(cacheOf().delete(cacheKey(url, b.id)))
    return out
  } catch {
    return reply(503, { error: 'unavailable' }, { 'Retry-After': '10' })
  }
}

/**
 * Why a well-formed view is dropped without being counted (the client always gets 204, so nothing can probe the rules):
 * not the canonical host (previews, workers.dev, local development), a crawler / unfurler / automation user agent, a
 * speculative load (prefetch / prerender), or a fetch that is not a same-origin script request.
 */
export function viewIgnored(request: Request, url: URL, env: LiveEnv): string | null {
  if (url.host !== (env.LIVE_CANONICAL_HOST ?? CANONICAL)) return 'host'
  if (isBotUserAgent(request.headers.get('User-Agent'))) return 'bot'
  if (isSpeculative((n) => request.headers.get(n))) return 'speculative'
  const dest = request.headers.get('Sec-Fetch-Dest')
  if (dest && dest !== 'empty') return 'dest'
  return null
}

async function views(request: Request, env: LiveEnv, ctx: ExecutionContext, url: URL, key: string): Promise<Response> {
  if (request.method !== 'POST') return reply(405, { error: 'method' }, { Allow: 'POST' })
  const gate = await postGate(request, url)
  if (typeof gate !== 'string') return gate
  let parsed: unknown
  try {
    parsed = JSON.parse(gate)
  } catch {
    return reply(400, { error: 'bad_request' })
  }
  const b = parseViewBody(parsed)
  if (!b) return reply(400, { error: 'bad_request' })
  if (!IDS.has(b.id)) return reply(404, { error: 'not_found' }, { 'Cache-Control': 'no-store' })
  if (viewIgnored(request, url, env)) return reply(204, undefined, { 'Cache-Control': 'no-store' })
  const lim = viewLimit.hit(key)
  if (!lim.ok || !globalWrites.hit('all').ok) return reply(429, { error: 'rate_limited' }, { 'Retry-After': String(lim.retryAfter || 30) })
  try {
    const r = await env.REACTIONS.get(env.REACTIONS.idFromName(b.id)).fetch('https://reactions.internal/view', {
      method: 'POST',
      headers: { 'x-live-ipk': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ vid: b.vid }),
    })
    if (r.status === 429) return reply(429, { error: 'rate_limited' }, { 'Retry-After': r.headers.get('Retry-After') ?? '30' })
    if (r.ok && ((await r.json()) as { counted?: boolean }).counted) ctx.waitUntil(cacheOf().delete(cacheKey(url, b.id)))
    return reply(204, undefined, { 'Cache-Control': 'no-store' })
  } catch {
    return reply(503, { error: 'unavailable' }, { 'Retry-After': '10' })
  }
}
