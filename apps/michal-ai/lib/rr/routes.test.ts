import { afterEach, describe, expect, it, vi } from 'vitest'

type Route = { path?: string; file: string; children?: Route[] }
const flatten = (rs: Route[]): Route[] => rs.flatMap((r) => [r, ...flatten(r.children ?? [])])

async function table(env: string) {
  vi.resetModules()
  vi.stubEnv('NODE_ENV', env)
  const mod = await import('../../app/routes')
  return flatten((await mod.default) as unknown as Route[])
}

afterEach(() => vi.unstubAllEnvs())

describe('route table', () => {
  const DEV_ONLY = ['cards', 'glass', 'kitchen-sink', 'micro', 'mood', 'motion', 'presence', 'shaders', 'ui']

  it('has no dev tools in a production (or any non-development) build', async () => {
    for (const env of ['production', 'test']) {
      const paths = (await table(env)).map((r) => r.path ?? '').filter(Boolean)
      for (const dev of DEV_ONLY) expect(paths.filter((p) => p === dev || p.startsWith(`${dev}/`))).toEqual([])
      expect((await table(env)).some((r) => r.file.includes('.dev.') || r.file.startsWith('dev/'))).toBe(false)
    }
  })

  it('adds them under `react-router dev`', async () => {
    const paths = (await table('development')).map((r) => r.path)
    expect(paths).toContain('kitchen-sink')
  })

  it('never serves the writing editor or its API, in any environment (it lives in ItsMichal/space-content)', async () => {
    for (const env of ['development', 'production', 'test']) {
      const rs = await table(env)
      expect(rs.filter((r) => /^(write|api)(\/|$)/.test(r.path ?? ''))).toEqual([])
      expect(rs.some((r) => /write/.test(r.file))).toBe(false)
    }
  })

  it('always has every public route', async () => {
    const paths = (await table('production')).map((r) => r.path)
    for (const p of ['projects', 'projects/:slug', 'projects/:slug/:child', 'writing', 'writing/:slug', 'about', 'resume', 'sitemap.xml', 'robots.txt', 'feed.xml', 'feed.json', '*']) {
      expect(paths).toContain(p)
    }
  })
})
