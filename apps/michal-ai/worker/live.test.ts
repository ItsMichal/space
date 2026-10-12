import { beforeEach, describe, expect, it } from 'vitest'
import { handleLive, viewIgnored, type LiveEnv } from './live'
import { LIVE_IDS } from '../lib/presence/slugs.generated'
import { MemoryReactionStore, MemoryViewStore } from '../lib/presence/reactions-core'

const ID = LIVE_IDS[0]
const VID = 'abcdefghijklmnop1234'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const HOST = 'michal.ai'

// A stand-in for the REACTIONS namespace: the same rules as the Durable Object, held in memory, plus a call log.
function fakeEnv(extra: Partial<LiveEnv> = {}) {
  const calls: { path: string; body?: unknown }[] = []
  const rooms = new Map<string, { r: MemoryReactionStore; v: MemoryViewStore }>()
  const room = (id: string) => rooms.get(id) ?? (rooms.set(id, { r: new MemoryReactionStore(), v: new MemoryViewStore() }), rooms.get(id)!)
  const ns = {
    idFromName: (n: string) => n as unknown as DurableObjectId,
    get: (id: unknown) => ({
      fetch: async (input: string, init?: RequestInit) => {
        const u = new URL(input)
        const rm = room(String(id))
        calls.push({ path: u.pathname })
        if (init?.method === 'POST' && u.pathname === '/view') {
          const { vid } = JSON.parse(String(init.body))
          return Response.json({ counted: rm.v.view(vid, '2026-10-12') })
        }
        if (init?.method === 'POST') {
          const b = JSON.parse(String(init.body))
          rm.r.set(b.target, b.emoji, b.sid, b.on)
          return Response.json({ v: 1, target: b.target, counts: rm.r.counts()[b.target] ?? {}, mine: rm.r.mine(b.sid)[b.target] ?? [] })
        }
        return Response.json({ v: 1, id: String(id), views: rm.v.total, post: rm.r.counts().post ?? {}, blocks: {} })
      },
    }),
  }
  const env = { REACTIONS: ns, PRESENCE: ns, LIVE_SALT: 'test', ...extra } as unknown as LiveEnv
  return { env, calls, rooms }
}

const ctx = { waitUntil: (p: Promise<unknown>) => void p.catch(() => {}) } as unknown as ExecutionContext
let ipCounter = 0
const post = (path: string, body: unknown, headers: Record<string, string> = {}, host = HOST) =>
  new Request(`https://${host}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: `https://${host}`,
      'User-Agent': UA,
      'CF-Connecting-IP': `198.51.100.${(ipCounter = (ipCounter % 250) + 1)}`,
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

beforeEach(() => {
  const store = new Map<string, Response>()
  ;(globalThis as unknown as { caches: unknown }).caches = {
    default: {
      match: async (r: Request) => store.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => void store.set(r.url, res),
      delete: async (r: Request) => store.delete(r.url),
    },
  }
})

describe('kill switch', () => {
  it('answers 204 to everything and touches nothing', async () => {
    const { env, calls } = fakeEnv({ LIVE_KILL: '1' })
    for (const req of [post('/api/live/views', { id: ID, vid: VID }), new Request(`https://${HOST}/api/live/reactions?id=${ID}`)]) {
      expect((await handleLive(req, env, ctx)).status).toBe(204)
    }
    expect(calls).toHaveLength(0)
  })
})

describe('views', () => {
  it('counts a visit once per visitor id and reports it in the totals', async () => {
    const { env } = fakeEnv()
    for (let i = 0; i < 3; i++) expect((await handleLive(post('/api/live/views', { id: ID, vid: VID }), env, ctx)).status).toBe(204)
    expect((await handleLive(post('/api/live/views', { id: ID, vid: 'zyxwvutsrqponmlk9876' }), env, ctx)).status).toBe(204)
    const res = await handleLive(new Request(`https://${HOST}/api/live/reactions?id=${ID}`), env, ctx)
    expect(((await res.json()) as { views: number }).views).toBe(2)
  })

  it('hides the number when VIEWS_PUBLIC=0 but still counts', async () => {
    const { env, rooms } = fakeEnv({ VIEWS_PUBLIC: '0' })
    await handleLive(post('/api/live/views', { id: ID, vid: VID }), env, ctx)
    const res = await handleLive(new Request(`https://${HOST}/api/live/reactions?id=${ID}`), env, ctx)
    expect(await res.json()).not.toHaveProperty('views')
    expect(rooms.get(ID)!.v.total).toBe(1)
  })

  it('rejects unknown ids, malformed bodies, other origins, wrong types and oversize payloads', async () => {
    const { env, calls } = fakeEnv()
    expect((await handleLive(post('/api/live/views', { id: 'not-a-post', vid: VID }), env, ctx)).status).toBe(404)
    expect((await handleLive(post('/api/live/views', { id: '../x', vid: VID }), env, ctx)).status).toBe(400)
    expect((await handleLive(post('/api/live/views', { id: ID, vid: 'short' }), env, ctx)).status).toBe(400)
    expect((await handleLive(post('/api/live/views', { id: ID, vid: VID, extra: 1 }), env, ctx)).status).toBe(400)
    expect((await handleLive(post('/api/live/views', '{nope'), env, ctx)).status).toBe(400)
    expect((await handleLive(post('/api/live/views', { id: ID, vid: VID }, { Origin: 'https://evil.example' }), env, ctx)).status).toBe(403)
    expect((await handleLive(post('/api/live/views', { id: ID, vid: VID }, { 'Sec-Fetch-Site': 'cross-site' }), env, ctx)).status).toBe(403)
    expect((await handleLive(post('/api/live/views', { id: ID, vid: VID }, { 'Content-Type': 'text/plain' }), env, ctx)).status).toBe(415)
    expect((await handleLive(post('/api/live/views', 'x'.repeat(600)), env, ctx)).status).toBe(413)
    expect((await handleLive(new Request(`https://${HOST}/api/live/views`), env, ctx)).status).toBe(405)
    expect((await handleLive(new Request(`https://${HOST}/api/live/views`, { method: 'HEAD' }), env, ctx)).status).toBe(405)
    expect(calls).toHaveLength(0)
  })

  it('answers 204 but does not count bots, speculative loads, previews or other hosts', async () => {
    const { env, calls } = fakeEnv()
    const ignored: Request[] = [
      post('/api/live/views', { id: ID, vid: VID }, { 'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' }),
      post('/api/live/views', { id: ID, vid: VID }, { 'User-Agent': 'curl/8.4.0' }),
      post('/api/live/views', { id: ID, vid: VID }, { 'User-Agent': '' }),
      post('/api/live/views', { id: ID, vid: VID }, { 'Sec-Purpose': 'prefetch' }),
      post('/api/live/views', { id: ID, vid: VID }, { 'Sec-Purpose': 'prefetch;prerender' }),
      post('/api/live/views', { id: ID, vid: VID }, { 'Sec-Fetch-Dest': 'document' }),
      post('/api/live/views', { id: ID, vid: VID }, {}, 'space.example.workers.dev'),
      post('/api/live/views', { id: ID, vid: VID }, {}, 'localhost:8787'),
    ]
    for (const r of ignored) expect((await handleLive(r, env, ctx)).status).toBe(204)
    expect(calls).toHaveLength(0)
  })

  it('counts on a configured canonical host (local development)', async () => {
    const { env, rooms } = fakeEnv({ LIVE_CANONICAL_HOST: 'localhost:8787' })
    await handleLive(post('/api/live/views', { id: ID, vid: VID }, {}, 'localhost:8787'), env, ctx)
    expect(rooms.get(ID)!.v.total).toBe(1)
  })

  it('rate limits writes per client', async () => {
    const { env } = fakeEnv()
    const ip = { 'CF-Connecting-IP': '203.0.113.99' }
    const statuses: number[] = []
    for (let i = 0; i < 25; i++) statuses.push((await handleLive(post('/api/live/views', { id: ID, vid: VID }, ip), env, ctx)).status)
    expect(statuses.slice(0, 20).every((s) => s === 204)).toBe(true)
    expect(statuses.slice(20)).toContain(429)
  })

  it('viewIgnored names the reason', () => {
    const r = (h: Record<string, string>) => new Request(`https://${HOST}/api/live/views`, { method: 'POST', headers: { 'User-Agent': UA, ...h } })
    const u = new URL(`https://${HOST}/api/live/views`)
    expect(viewIgnored(r({}), u, {} as LiveEnv)).toBeNull()
    expect(viewIgnored(r({ 'User-Agent': 'facebookexternalhit/1.1' }), u, {} as LiveEnv)).toBe('bot')
    expect(viewIgnored(r({ 'Sec-Purpose': 'prefetch' }), u, {} as LiveEnv)).toBe('speculative')
    expect(viewIgnored(r({}), new URL('https://localhost:8787/x'), {} as LiveEnv)).toBe('host')
  })
})

describe('reactions', () => {
  it('toggles on and off and only accepts known ids', async () => {
    const { env } = fakeEnv()
    const body = { id: ID, target: 'post', emoji: 'heart', sid: VID, on: true }
    const on = await handleLive(post('/api/live/reactions', body), env, ctx)
    expect(await on.json()).toMatchObject({ counts: { heart: 1 }, mine: ['heart'] })
    const dup = await handleLive(post('/api/live/reactions', body), env, ctx)
    expect(await dup.json()).toMatchObject({ counts: { heart: 1 } })
    const off = await handleLive(post('/api/live/reactions', { ...body, on: false }), env, ctx)
    expect(await off.json()).toMatchObject({ counts: {}, mine: [] })
    expect((await handleLive(post('/api/live/reactions', { ...body, id: 'invented-post' }), env, ctx)).status).toBe(404)
    expect((await handleLive(post('/api/live/reactions', { ...body, emoji: 'poop' }), env, ctx)).status).toBe(400)
  })

  it('refuses paragraph targets while LIVE_BLOCK_REACTIONS is off, accepts them when on', async () => {
    const body = { id: ID, target: 'a1b2c', emoji: 'fire', sid: VID, on: true }
    expect((await handleLive(post('/api/live/reactions', body), fakeEnv().env, ctx)).status).toBe(400)
    expect((await handleLive(post('/api/live/reactions', body), fakeEnv({ LIVE_BLOCK_REACTIONS: '1' }).env, ctx)).status).toBe(200)
  })

  it('GET validates the id and caches', async () => {
    const { env, calls } = fakeEnv()
    expect((await handleLive(new Request(`https://${HOST}/api/live/reactions?id=nope`), env, ctx)).status).toBe(404)
    expect((await handleLive(new Request(`https://${HOST}/api/live/reactions`), env, ctx)).status).toBe(404)
    const a = await handleLive(new Request(`https://${HOST}/api/live/reactions?id=${ID}`), env, ctx)
    expect(a.headers.get('Cache-Control')).toContain('s-maxage=30')
    await new Promise((r) => setTimeout(r, 5))
    await handleLive(new Request(`https://${HOST}/api/live/reactions?id=${ID}`), env, ctx)
    expect(calls).toHaveLength(1)
  })

  it('rate limits writes per client', async () => {
    const { env } = fakeEnv()
    const ip = { 'CF-Connecting-IP': '203.0.113.50' }
    const statuses: number[] = []
    for (let i = 0; i < 35; i++) {
      statuses.push((await handleLive(post('/api/live/reactions', { id: ID, target: 'post', emoji: 'clap', sid: VID, on: i % 2 === 0 }, ip), env, ctx)).status)
    }
    expect(statuses).toContain(429)
  })
})
