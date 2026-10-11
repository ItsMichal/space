// Custom Worker entry: OpenNext handler + Durable Objects.
import { canonicalRedirect, isPreviewHost } from './host'
// @ts-expect-error `.open-next/worker.js` is generated at build time by `opennextjs-cloudflare build`
import { default as handler } from '../.open-next/worker.js'

// Re-export OpenNext's Durable Object classes so they stay available if the
// incremental cache / queue / tag cache are later switched to DO-backed ones.
// @ts-expect-error generated at build time
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from '../.open-next/worker.js'

export interface Env {
  PRESENCE: DurableObjectNamespace
  ASSETS: Fetcher
  [key: string]: unknown
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    // michal.ai is canonical: the old domain and www hosts permanently redirect, keeping path and query.
    const to = canonicalRedirect(request.url)
    if (to) return Response.redirect(to, 308)
    if (url.pathname === '/api/presence') {
      // WebSocket only; origin allowlist + admission are enforced inside the DO.
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426, headers: { Upgrade: 'websocket' } })
      }
      const stub = env.PRESENCE.get(env.PRESENCE.idFromName('global'))
      return stub.fetch(request)
    }
    const res: Response = await handler.fetch(request, env, ctx)
    if (!isPreviewHost(url.hostname)) return res
    // Preview deployments are never indexed.
    const out = new Response(res.body, res)
    out.headers.set('X-Robots-Tag', 'noindex')
    return out
  },
} satisfies ExportedHandler<Env>

export { PresenceRoom } from './presence-room'
