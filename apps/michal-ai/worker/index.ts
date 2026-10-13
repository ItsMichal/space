// Custom Worker entry: OpenNext handler + Durable Objects.
import { canonicalRedirect, isPreviewHost } from './host'
import { handleLive, isLivePath, type LiveEnv } from './live'
import { handleStarlinkRead, refreshStarlink, STARLINK_LIVE_PATH } from './starlink'
// @ts-expect-error `.open-next/worker.js` is generated at build time by `opennextjs-cloudflare build`
import { default as handler } from '../.open-next/worker.js'

// Re-export OpenNext's Durable Object classes so they stay available if the
// incremental cache / queue / tag cache are later switched to DO-backed ones.
// @ts-expect-error generated at build time
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from '../.open-next/worker.js'

export interface Env extends LiveEnv {
  ASSETS: Fetcher
  [key: string]: unknown
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    // michal.ai is canonical: the old domain and www hosts permanently redirect, keeping path and query.
    const to = canonicalRedirect(request.url)
    if (to) return Response.redirect(to, 308)
    // Hero globe constellation (not part of the live features, so LIVE_KILL does not apply).
    if (url.pathname === STARLINK_LIVE_PATH) return handleStarlinkRead(request, env)
    // Live features (presence socket, reactions). Handled here, before OpenNext; the site itself never depends on them.
    if (isLivePath(url.pathname)) {
      try {
        return await handleLive(request, env, ctx)
      } catch {
        return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } })
      }
    }
    const res: Response = await handler.fetch(request, env, ctx)
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
