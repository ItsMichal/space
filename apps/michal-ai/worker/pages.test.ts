import { beforeEach, describe, expect, it } from 'vitest'
import { eventIgnored, handlePageEvent, isPrivatePath, MANIFEST_PATH, openLink, resetManifestCache, servePrivatePage, type PageManifest, type PagesEnv } from './pages'

const T1 = 'AAAAAAAAAAAAAAAAAAAAAA'
const T2 = 'BBBBBBBBBBBBBBBBBBBBBB'
const T3 = 'CCCCCCCCCCCCCCCCCCCCCC'
const KEY = '0123456789abcdef01234567'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const MANIFEST: PageManifest = {
  links: { [T1]: { page: 'acme', key: KEY, until: '' }, [T2]: { page: 'acme', key: KEY, until: '2020-01-01' } },
  pages: ['acme'],
}

function fakeEnv(manifest = MANIFEST) {
  const recorded: unknown[] = []
  const assets: string[] = []
  const env = {
    ASSETS: {
      fetch: async (req: Request) => {
        const u = new URL(req.url)
        assets.push(u.pathname + u.search)
        if (u.pathname === MANIFEST_PATH) return Response.json(manifest)
        if (u.pathname === `/p/${KEY}`) return new Response('<html>page</html>', { headers: { 'Content-Type': 'text/html', ETag: '"x"' } })
        if (u.pathname === `/p/${KEY}.data`) return new Response('data', { headers: { 'Content-Type': 'text/x-script' } })
        return new Response(null, { status: 404 })
      },
    },
    PAGE_STATS: {
      idFromName: (n: string) => n,
      get: (id: string) => ({
        record: async (ev: unknown) => {
          recorded.push({ id, ev })
          return 'ok'
        },
      }),
    },
    LIVE_SALT: 'test',
  } as unknown as PagesEnv
  return { env, recorded, assets }
}

const pending: Promise<unknown>[] = []
const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p) } as unknown as ExecutionContext

const event = (body: unknown, headers: Record<string, string> = {}, host = 'michal.ai') =>
  new Request(`https://${host}/api/pages/event`, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { Origin: `https://${host}`, 'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': UA, 'CF-Connecting-IP': '203.0.113.9', 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Dest': 'empty', ...headers },
  })

beforeEach(() => {
  resetManifestCache()
  pending.length = 0
})

describe('private paths', () => {
  it('claims /p and /_private and nothing else', () => {
    for (const p of ['/p', '/p/', `/p/${T1}`, `/p/${KEY}`, '/p/x/y', '/_private/pages.json', '/_private']) expect(isPrivatePath(p)).toBe(true)
    for (const p of ['/projects', '/press', '/private', '/writing/p']) expect(isPrivatePath(p)).toBe(false)
  })

  it('opens a link only while it is in date', () => {
    expect(openLink(MANIFEST, T1)).toEqual({ page: 'acme', key: KEY })
    expect(openLink(MANIFEST, T2)).toBeNull()
    expect(openLink(MANIFEST, T3)).toBeNull()
    expect(openLink(MANIFEST, 'constructor')).toBeNull()
    expect(openLink(MANIFEST, T2, new Date('2019-12-31T23:00:00Z'))).toEqual({ page: 'acme', key: KEY })
  })
})

describe('serving /p/<token>', () => {
  it('serves the page for an open token, never cached or indexed', async () => {
    const { env, assets } = fakeEnv()
    const res = await servePrivatePage(new Request(`https://michal.ai/p/${T1}`), env)
    expect(res?.status).toBe(200)
    expect(await res!.text()).toContain('page')
    expect(res!.headers.get('X-Robots-Tag')).toContain('noindex')
    expect(res!.headers.get('Cache-Control')).toBe('private, no-store')
    expect(res!.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(res!.headers.get('ETag')).toBeNull()
    expect(assets).toContain(`/p/${KEY}`)
  })

  it('serves the loader data at /p/<token>.data for client navigation back to the page', async () => {
    const { env, assets } = fakeEnv()
    const res = await servePrivatePage(new Request(`https://michal.ai/p/${T1}.data?_routes=routes%2Fprivate-page`), env)
    expect(res?.status).toBe(200)
    expect(res!.headers.get('Content-Type')).toBe('text/x-script')
    expect(assets).toContain(`/p/${KEY}.data?_routes=routes%2Fprivate-page`)
  })

  it.each([`/p/${T2}`, `/p/${T3}`, `/p/${KEY}`, `/p/${KEY}.data`, `/p/${T1}/`, `/p/${T1}/x`, '/p/'])('refuses %s', async (p) => {
    const { env } = fakeEnv()
    expect(await servePrivatePage(new Request(`https://michal.ai${p}`), env)).toBeNull()
  })

  it('refuses writes', async () => {
    const { env } = fakeEnv()
    expect(await servePrivatePage(new Request(`https://michal.ai/p/${T1}`, { method: 'POST' }), env)).toBeNull()
  })
})

describe('the beacon endpoint', () => {
  const V = 'abcdefghijklmnop'

  it('records a view for an open link, with a hashed visitor, country and device, and no IP', async () => {
    const { env, recorded } = fakeEnv()
    const req = event({ t: T1, v: V, e: 'view', ref: 'https://www.linkedin.com/' })
    Object.defineProperty(req, 'cf', { value: { country: 'PL' } })
    const res = await handlePageEvent(req, env, ctx)
    await Promise.all(pending)
    expect(res.status).toBe(204)
    expect(recorded).toHaveLength(1)
    const r = recorded[0] as { id: string; ev: Record<string, unknown> }
    expect(r.id).toBe('acme')
    expect(r.ev).toMatchObject({ t: T1, v: V, e: 'view', ref: 'linkedin.com', country: 'PL', device: 'desktop' })
    expect(String(r.ev.visitor)).toMatch(/^[0-9a-f]{16}$/)
    expect(JSON.stringify(r.ev)).not.toContain('203.0.113.9')
  })

  it('drops events for closed or unknown links, bots, other hosts and speculative loads, still answering 204', async () => {
    for (const req of [
      event({ t: T2, v: V, e: 'view' }),
      event({ t: T3, v: V, e: 'view' }),
      event({ t: T1, v: V, e: 'view' }, { 'User-Agent': 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)' }),
      event({ t: T1, v: V, e: 'view' }, { 'Sec-Purpose': 'prefetch' }),
      event({ t: T1, v: V, e: 'view' }, {}, 'pr-12.space.workers.dev'),
    ]) {
      const { env, recorded } = fakeEnv()
      const res = await handlePageEvent(req, env, ctx)
      await Promise.all(pending)
      expect(res.status).toBe(204)
      expect(recorded).toEqual([])
    }
  })

  it('refuses cross-site posts, bad bodies and big bodies', async () => {
    const { env } = fakeEnv()
    expect((await handlePageEvent(event({ t: T1, v: V, e: 'view' }, { Origin: 'https://evil.example' }), env, ctx)).status).toBe(403)
    expect((await handlePageEvent(event({ t: T1, v: V, e: 'view' }, { 'Sec-Fetch-Site': 'cross-site' }), env, ctx)).status).toBe(403)
    expect((await handlePageEvent(event('not json'), env, ctx)).status).toBe(400)
    expect((await handlePageEvent(event({ t: T1, v: V, e: 'nope' }), env, ctx)).status).toBe(400)
    expect((await handlePageEvent(event({ t: T1, v: V, e: 'view', ref: 'x'.repeat(2000) }), env, ctx)).status).toBe(413)
    expect((await handlePageEvent(event({ t: T1, v: V, e: 'view' }, { 'Content-Type': 'application/x-www-form-urlencoded' }), env, ctx)).status).toBe(415)
    expect((await handlePageEvent(new Request('https://michal.ai/api/pages/event'), env, ctx)).status).toBe(405)
  })

  it('explains why an event is ignored', () => {
    const { env } = fakeEnv()
    const u = new URL('https://michal.ai/api/pages/event')
    expect(eventIgnored(event({}), u, env)).toBeNull()
    expect(eventIgnored(event({}, { 'Sec-Fetch-Dest': 'document' }), u, env)).toBe('dest')
    expect(eventIgnored(event({}), new URL('http://localhost:8787/api/pages/event'), env)).toBe('host')
    expect(eventIgnored(event({}), new URL('http://localhost:8787/api/pages/event'), { ...env, PAGES_CANONICAL_HOST: 'localhost:8787' })).toBeNull()
  })
})
