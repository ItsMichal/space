// Custom Worker entry: OpenNext handler + Durable Objects.
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
    if (url.pathname === '/api/presence') {
      // WebSocket only; origin allowlist + admission are enforced inside the DO.
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426, headers: { Upgrade: 'websocket' } })
      }
      const stub = env.PRESENCE.get(env.PRESENCE.idFromName('global'))
      return stub.fetch(request)
    }
    return handler.fetch(request, env, ctx)
  },
} satisfies ExportedHandler<Env>

export { PresenceRoom } from './presence-room'
