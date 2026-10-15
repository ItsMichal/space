// Post-deploy check: is what a URL serves what this build produced? Compares live responses with build/client (run it in the job that built).
//   node scripts/parity/prod-smoke.mjs https://michal.ai [--retries 5]
// Per page: status 200, same <title>, canonical, og:image tag and the same set of /assets/ files as the built HTML (so the new deploy is live,
// not a cached older one). Feeds, sitemap, robots, manifest: identical bodies. The 59 legacy redirects: 308 to the right target.
// A share card answers image/png and an unknown path answers 404. About 110 requests, a few seconds.
// For a full before/after comparison of two deployments use snapshot.mjs on both and diff.mjs (see scripts/parity/README.md).
import fs from 'node:fs'
import path from 'node:path'
import { buildRedirects } from '../../lib/redirects.mjs'

const base = (process.argv[2] ?? '').replace(/\/$/, '')
if (!base) {
  console.error('usage: prod-smoke.mjs <base-url>')
  process.exit(2)
}
const root = path.resolve(import.meta.dirname, '..', '..')
process.chdir(root)
const client = path.join(root, 'build', 'client')
const retries = process.argv.includes('--retries') ? Number(process.argv[process.argv.indexOf('--retries') + 1]) : 5
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const pages = []
const walk = (dir, rel = '') => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (['assets', 'media', 'fonts', '_og', 'botanical', 'textures', 'motion', 'icons', 'backdrop', 'globe', '404'].includes(e.name) && !rel) continue
      walk(path.join(dir, e.name), `${rel}/${e.name}`)
    } else if (e.name === 'index.html') pages.push(rel || '/')
  }
}
walk(client)

const head = (html, re) => re.exec(html)?.[1] ?? null
const facts = (html) => ({
  title: head(html, /<title>([^<]*)<\/title>/),
  canonical: head(html, /<link rel="canonical" href="([^"]*)"/),
  ogImage: head(html, /<meta property="og:image" content="([^"]*)"/),
  assets: [...new Set([...html.matchAll(/\/assets\/[A-Za-z0-9._-]+/g)].map((m) => m[0]))].sort().join(','),
})

async function once(fn) {
  let last
  for (let a = 0; a <= retries; a++) {
    last = await fn().catch((e) => String(e))
    if (last === true) return true
    await sleep(2000 * (a + 1))
  }
  return last
}

const jobs = []
for (const p of pages) {
  jobs.push([`page ${p}`, async () => {
    const res = await fetch(base + p, { redirect: 'manual', headers: { 'Cache-Control': 'no-cache' } })
    if (res.status !== 200) return `status ${res.status}`
    const live = facts(await res.text())
    const built = facts(fs.readFileSync(path.join(client, p === '/' ? '' : p, 'index.html'), 'utf8'))
    for (const k of Object.keys(built)) if (live[k] !== built[k]) return `${k} differs: live ${String(live[k]).slice(0, 80)} / built ${String(built[k]).slice(0, 80)}`
    return true
  }])
}
for (const f of ['sitemap.xml', 'feed.xml', 'feed.json', 'robots.txt', 'manifest.webmanifest']) {
  jobs.push([`/${f}`, async () => {
    const res = await fetch(`${base}/${f}`, { headers: { 'Cache-Control': 'no-cache' } })
    return res.status === 200 && (await res.text()).trimEnd() === fs.readFileSync(path.join(client, f), 'utf8').trimEnd() ? true : `status ${res.status} or body differs`
  }])
}
for (const r of buildRedirects()) {
  jobs.push([`redirect ${r.source}`, async () => {
    const res = await fetch(base + r.source, { redirect: 'manual' })
    const loc = (res.headers.get('location') ?? '').replace(/^https?:\/\/[^/]+/, '')
    return res.status === 308 && loc === r.destination ? true : `status ${res.status} location ${loc}`
  }])
}
jobs.push(['share card is image/png', async () => {
  const og = facts(fs.readFileSync(path.join(client, 'index.html'), 'utf8')).ogImage
  const res = await fetch(base + new URL(og).pathname)
  return res.status === 200 && res.headers.get('content-type') === 'image/png' ? true : `status ${res.status} ${res.headers.get('content-type')}`
}])
jobs.push(['unknown path is a real 404', async () => ((await fetch(`${base}/prod-smoke-does-not-exist`)).status === 404 ? true : 'not 404')])

let failed = 0
const queue = [...jobs]
await Promise.all(
  Array.from({ length: 12 }, async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      const r = await once(j[1])
      if (r !== true) {
        failed++
        console.log(`FAIL ${j[0]}: ${r}`)
      }
    }
  })
)
console.log(`${jobs.length - failed}/${jobs.length} checks match the build at ${base}`)
process.exitCode = failed ? 1 : 0
