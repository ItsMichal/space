// The public site must never contain editor code. The editor lives in ItsMichal/space-content and is laid over this app only in
// that repo's CI (editor/scripts/with-site.sh); this walks the static import graph of everything the production build starts
// from (root, production routes, the Worker) and fails if it reaches an editor folder. It holds with or without the overlay.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const app = path.resolve(__dirname, '../..')
const EDITOR = [/^components\/editor\//, /^lib\/editor\//, /^write\//, /^app\/write\//, /^app\/api\//]
const EXT = ['', '.ts', '.tsx', '.mts', '.mjs', '.js', '/index.ts', '/index.tsx']

function resolve(from: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = path.join(app, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec)
  else return null // packages
  for (const e of EXT) {
    const p = base + e
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p
  }
  return null
}

const IMPORT = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g

function graph(entries: string[]): Set<string> {
  const seen = new Set<string>()
  const stack = [...entries]
  while (stack.length) {
    const f = stack.pop()!
    if (seen.has(f)) continue
    seen.add(f)
    if (!/\.(m?[jt]sx?)$/.test(f)) continue
    for (const m of fs.readFileSync(f, 'utf8').matchAll(IMPORT)) {
      const r = resolve(f, m[1] ?? m[2] ?? m[3])
      if (r) stack.push(r)
    }
  }
  return seen
}

describe('public build', () => {
  it('reaches no editor code from root, production routes or the Worker', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.resetModules()
    type Route = { file: string; children?: Route[] }
    const flat = (rs: Route[]): Route[] => rs.flatMap((r) => [r, ...flat(r.children ?? [])])
    const routes = flat((await import('../../app/routes')).default as unknown as Route[])
    vi.unstubAllEnvs()
    const entries = [path.join(app, 'app/root.tsx'), path.join(app, 'worker/index.ts'), ...routes.map((r) => path.join(app, 'app', r.file))]
    const files = [...graph(entries)].map((f) => path.relative(app, f))
    expect(files.length).toBeGreaterThan(50)
    expect(files.filter((f) => EDITOR.some((re) => re.test(f)))).toEqual([])
  })
})
