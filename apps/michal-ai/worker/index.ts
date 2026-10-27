// Worker entry: host redirects, legacy redirects, live features (reactions, views, presence), the Starlink binary, then the
// prerendered site from the static assets binding. Durable Objects and the cron handler are unchanged from before the migration.
import { canonicalRedirect, isPreviewHost } from './host'
import { handleLive, isLivePath, type LiveEnv } from './live'
import { handleStarlinkRead, refreshStarlink, STARLINK_LIVE_IDS_PATH, STARLINK_LIVE_PATH } from './starlink'
import { contentTypeFor, isDataRequest, isHtmlFilePath, parseRange, redirectFor, shareCardAsset } from './static'

export interface Env extends LiveEnv {
  ASSETS: Fetcher
  [key: string]: unknown
}

async function site(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const to = redirectFor(url.pathname, url.search)
  if (to) return new Response(null, { status: 308, headers: { Location: to } })

  const card = shareCardAsset(url.pathname)
  let res: Response
  if (isHtmlFilePath(url.pathname)) res = new Response(null, { status: 404 })
  else {
    res = await env.ASSETS.fetch(new Request(new URL(card ?? url.pathname, url), request))
  }
  if (res.status === 404) {
    // The prerendered not-found page, with the right status. Data and asset requests get a bare 404.
    if (isDataRequest(url.pathname) || /\.[a-z0-9]{2,5}$/i.test(url.pathname) || card) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    const page = await env.ASSETS.fetch(new Request(new URL('/404', url), { headers: request.headers }))
    const out = new Response(request.method === 'HEAD' ? null : page.body, { status: 404, headers: page.headers })
    out.headers.set('Cache-Control', 'no-store')
    return out
  }
  const type = card ? 'image/png' : contentTypeFor(url.pathname)
  let out = res
  if (type) {
    out = new Response(res.body, res)
    out.headers.set('Content-Type', type)
  }
  return withRange(request, out)
}

/** The asset binding ignores `Range` locally and may for some paths; honour a single range on small non-HTML files (PDFs, images) so downloads resume. */
async function withRange(request: Request, res: Response): Promise<Response> {
  const range = request.headers.get('Range')
  if (!range || request.method !== 'GET' || res.status !== 200 || res.headers.has('Content-Range')) return res
  if (/text\/html/.test(res.headers.get('Content-Type') ?? '')) return res
  const body = await res.arrayBuffer()
  const r = parseRange(range, body.byteLength)
  const headers = new Headers(res.headers)
  headers.set('Accept-Ranges', 'bytes')
  headers.delete('Content-Length')
  if (!r) return new Response(body, { status: 200, headers })
  headers.set('Content-Range', `bytes ${r.start}-${r.end}/${body.byteLength}`)
  return new Response(body.slice(r.start, r.end + 1), { status: 206, headers })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    // michal.ai is canonical: the old domain and www hosts permanently redirect, keeping path and query.
    const to = canonicalRedirect(request.url)
    if (to) return Response.redirect(to, 308)
    // Hero globe constellation (not part of the live features, so LIVE_KILL does not apply).
    if (url.pathname === STARLINK_LIVE_PATH || url.pathname === STARLINK_LIVE_IDS_PATH) return handleStarlinkRead(request, env)
    // Live features (presence socket, reactions). The site itself never depends on them.
    if (isLivePath(url.pathname)) {
      try {
        return await handleLive(request, env, ctx)
      } catch {
        return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } })
      }
    }
    const res = await site(request, env)
    if (!isPreviewHost(url.hostname)) return res
    // Preview deployments are never indexed.
    const out = new Response(res.body, res)
    out.headers.set('X-Robots-Tag', 'noindex')
    return out
  },
  // Cron Trigger (wrangler.jsonc triggers.crons): refresh the Starlink elements every 6 hours.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refreshStarlink(env).then((m) => console.log(`starlink refresh: ${m}`)))
  },
} satisfies ExportedHandler<Env>

export { PresenceRoom } from './presence-room'
export { ReactionsRoom } from './reactions-room'
