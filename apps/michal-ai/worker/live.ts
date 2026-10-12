// Router for /api/live/*: presence socket + reactions JSON. Runs before OpenNext; same-origin only (no CORS headers).
import { LIVE_LIMITS } from '../lib/presence/constants'
import { placeFromCf } from '../lib/presence/geo'
import { createLimiter, ipKey } from '../lib/presence/ratelimit'
import { LIVE_SLUGS } from '../lib/presence/slugs.generated'
import { originAllowed, SLUG_RE } from '../lib/presence/validate'

export interface LiveEnv {
  PRESENCE: DurableObjectNamespace
  REACTIONS: DurableObjectNamespace
  /** "1" turns the whole feature off: every /api/live/* request answers 204 and the UI hides itself. */
  LIVE_KILL?: string
  /** Optional secret salt for the IP hash. Without it a fixed public salt plus the UTC day is used. */
  LIVE_SALT?: string
}

const SLUGS = new Set(LIVE_SLUGS)
const MAX_BODY = 512

// Per-isolate guards in front of the Durable Objects. Approximate by design (isolates come and go); the objects enforce
// their own exact limits. A Cloudflare WAF rate rule on /api/live/* is the recommended outer layer.
const connectLimit = createLimiter(20, 60_000)
const readLimit = createLimiter(120, 60_000)
const writeLimit = createLimiter(LIVE_LIMITS.reactWritesPerMin, 60_000)
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

async function reactions(request: Request, env: LiveEnv, ctx: ExecutionContext, url: URL, key: string): Promise<Response> {
  const method = request.method
  if (method !== 'GET' && method !== 'POST') return reply(405, { error: 'method' }, { Allow: 'GET, POST' })

  if (method === 'GET') {
    const slug = url.searchParams.get('slug') ?? ''
    if (!SLUG_RE.test(slug) || !SLUGS.has(slug)) return reply(404, { error: 'not_found' }, { 'Cache-Control': 'no-store' })
    const origin = request.headers.get('Origin')
    if (origin && !originAllowed(origin, url.host)) return reply(403, { error: 'forbidden_origin' })
    const cache = (caches as unknown as { default: Cache }).default
    const ck = new Request(`${url.origin}/api/live/reactions?slug=${slug}`)
    const hit = await cache.match(ck)
    if (hit) return hit
    const lim = readLimit.hit(key)
    if (!lim.ok) return reply(429, { error: 'rate_limited' }, { 'Retry-After': String(lim.retryAfter) })
    try {
      const r = await env.REACTIONS.get(env.REACTIONS.idFromName(slug)).fetch(
        `https://reactions.internal/?slug=${slug}`,
        { headers: { 'x-live-ipk': key } },
      )
      if (!r.ok) return reply(r.status === 429 ? 429 : 503, { error: 'unavailable' }, { 'Retry-After': '10' })
      const out = new Response(r.body, {
        status: 200,
        headers: {
          ...BASE_HEADERS,
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=30',
        },
      })
      ctx.waitUntil(cache.put(ck, out.clone()))
      return out
    } catch {
      return reply(503, { error: 'unavailable' }, { 'Retry-After': '10' })
    }
  }

  // POST: same-origin JSON only.
  if (!originAllowed(request.headers.get('Origin'), url.host)) return reply(403, { error: 'forbidden_origin' })
  const sfs = request.headers.get('Sec-Fetch-Site')
  if (sfs && sfs !== 'same-origin' && sfs !== 'none') return reply(403, { error: 'forbidden_origin' })
  if (!(request.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json')) return reply(415, { error: 'unsupported_media_type' })
  const declared = Number(request.headers.get('Content-Length') ?? 0)
  if (declared > MAX_BODY) return reply(413, { error: 'payload_too_large' })
  const lim = writeLimit.hit(key)
  if (!lim.ok || !globalWrites.hit('all').ok) return reply(429, { error: 'rate_limited' }, { 'Retry-After': String(lim.retryAfter || 30) })

  const text = await request.text()
  if (text.length > MAX_BODY) return reply(413, { error: 'payload_too_large' })
  let body: { slug?: unknown } & Record<string, unknown>
  try {
    body = JSON.parse(text)
  } catch {
    return reply(400, { error: 'bad_request' })
  }
  const slug = body && typeof body.slug === 'string' ? body.slug : ''
  if (!SLUG_RE.test(slug) || !SLUGS.has(slug)) return reply(404, { error: 'not_found' }, { 'Cache-Control': 'no-store' })
  try {
    const r = await env.REACTIONS.get(env.REACTIONS.idFromName(slug)).fetch('https://reactions.internal/', {
      method: 'POST',
      headers: { 'x-live-ipk': key, 'Content-Type': 'application/json' },
      body: text,
    })
    const out = new Response(r.body, { status: r.status, headers: { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
    const ra = r.headers.get('Retry-After')
    if (ra) out.headers.set('Retry-After', ra)
    if (r.ok) {
      const cache = (caches as unknown as { default: Cache }).default
      ctx.waitUntil(cache.delete(new Request(`${url.origin}/api/live/reactions?slug=${slug}`)))
    }
    return out
  } catch {
    return reply(503, { error: 'unavailable' }, { 'Retry-After': '10' })
  }
}
