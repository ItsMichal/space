// Records how a served build answers every URL the site is known for.
//   node scripts/parity/snapshot.mjs <base-url> <out-dir> [--worker]
// Writes <out-dir>/index.json (status, key headers, extracted HTML facts or body hash per URL) and the raw bodies of text
// resources under <out-dir>/bodies/. Compare two snapshots with scripts/parity/diff.mjs.
import fs from 'node:fs'
import path from 'node:path'
import { appRoot, extractFacts, fetchOne, isBuildAsset, sha, slugFile, writeJson } from './lib.mjs'

const [base0, outDir0, ...flags] = process.argv.slice(2)
const outDir = outDir0 && path.resolve(outDir0)
if (!base0 || !outDir0) {
  console.error('usage: snapshot.mjs <base-url> <out-dir> [--worker]')
  process.exit(2)
}
const base = base0.replace(/\/$/, '')
const withWorker = flags.includes('--worker')
fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(path.join(outDir, 'bodies'), { recursive: true })

const { buildRedirects } = await import(path.join(appRoot, 'lib/redirects.mjs'))
process.chdir(appRoot)

// 1. Page list = the sitemap (the site's own claim of what exists), plus the fixed extras.
const sm = await fetchOne(base, '/sitemap.xml')
const sitemapPaths = [...sm.body.toString().matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname)
const pagePaths = [...new Set(sitemapPaths.map((p) => (p === '' ? '/' : p)))]

const redirects = buildRedirects()
const parentsWithFeeds = [...new Set(redirects.filter((r) => r.source.endsWith('/feed.xml')).map((r) => r.destination))]
const fixed = [
  '/sitemap.xml', '/robots.txt', '/manifest.webmanifest', '/feed.xml', '/feed.json',
  '/favicon.ico', '/icon.svg', '/apple-icon.png', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-512-maskable.png',
  '/michal.png', '/logo.svg', '/BodzianowskiResume.pdf', '/resume.pdf', '/globe/fallback.png',
  ...parentsWithFeeds,
]
const redirectSources = redirects.map((r) => r.source)
const notFound = ['/nope', '/writing/nope', '/projects/starlink/nope', '/projects/nope/nope', '/write', '/api/write/posts', '/opengraph-image/x', '/_next/static/nope.js', '/assets/nope.js']
const slashVariants = ['/about/', '/projects/', '/writing/', '/projects/starlink/', '/feed.xml/']
const workerRoutes = withWorker ? ['/api/live/reactions?post=parity', '/api/live/views?post=parity', '/globe/starlink-live.bin'] : []

const entries = new Map() // path -> kind
for (const p of pagePaths) entries.set(p, 'page')
for (const p of fixed) if (!entries.has(p)) entries.set(p, 'resource')
for (const p of redirectSources) entries.set(p, 'redirect')
for (const p of notFound) entries.set(p, 'missing')
for (const p of slashVariants) entries.set(p, 'slash')
for (const p of workerRoutes) entries.set(p, 'worker')

const index = {}
const pending = new Set() // internal refs discovered in pages: checked for status/type afterwards
async function record(p, kind) {
  let r
  try {
    r = await fetchOne(base, p)
  } catch (e) {
    index[p] = { kind, error: String(e) }
    return
  }
  const rec = { kind, status: r.status, headers: r.headers, bytes: r.body.length, hash: sha(r.body) }
  const ct = r.headers['content-type'] ?? ''
  if (/text\/html/.test(ct) && r.status < 400 && kind !== 'slash') {
    const facts = extractFacts(r.body.toString('utf8'), p)
    rec.facts = facts
    for (const u of facts.internalRefs) pending.add(u)
  } else if (/html/.test(ct)) {
    rec.facts = extractFacts(r.body.toString('utf8'), p)
  } else if (/xml|json|text|manifest/.test(ct) && r.body.length < 3_000_000) {
    fs.writeFileSync(path.join(outDir, 'bodies', slugFile(p)), r.body)
    rec.body = slugFile(p)
  }
  index[p] = rec
}

const queue = [...entries]
const worker = async () => {
  for (let it = queue.shift(); it; it = queue.shift()) await record(it[0], it[1])
}
await Promise.all(Array.from({ length: 6 }, worker))

// 2. Every same-origin reference the pages make (links, images, srcsets, icons): does it resolve, and to what.
const refs = [...pending].filter((u) => u.startsWith('/') && !isBuildAsset(u) && !(u in index))
const refQueue = [...refs]
const refWorker = async () => {
  for (let u = refQueue.shift(); u; u = refQueue.shift()) {
    try {
      const r = await fetchOne(base, u)
      index[u] = { kind: 'ref', status: r.status, headers: r.headers, bytes: r.body.length, hash: sha(r.body) }
      // Share cards are kept as files so scripts/parity/shotdiff.mjs can compare them pixel by pixel.
      if (/-image\?/.test(u) && r.status === 200) {
        fs.mkdirSync(path.join(outDir, 'cards'), { recursive: true })
        fs.writeFileSync(path.join(outDir, 'cards', `${slugFile(u.split('?')[0])}.png`), r.body)
      }
    } catch (e) {
      index[u] = { kind: 'ref', error: String(e) }
    }
  }
}
await Promise.all(Array.from({ length: 8 }, refWorker))

writeJson(path.join(outDir, 'index.json'), { base, takenAt: new Date().toISOString(), count: Object.keys(index).length, index })
const by = {}
for (const v of Object.values(index)) by[v.kind] = (by[v.kind] ?? 0) + 1
console.log(`snapshot ${base}: ${Object.keys(index).length} urls`, by)
