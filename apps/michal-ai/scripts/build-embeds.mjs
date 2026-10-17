// Build-time embed check. Finds every video / iframe embed used in content/posts (::youtube{id}, ::embed{url}),
// asks the provider whether it can be embedded, and writes content/embed-status.json (committed) for the components:
//   youtube: { "<id>": { embeddable, title?, thumbnail? } }     urls: { "<url>": { ok, status? } }
// A private, deleted or embed-disabled video answers 401/403/404 to oEmbed and is marked not embeddable, so the page
// renders nothing for it. When the video goes public/unlisted the next build flips it back on by itself.
//
// Never fails the build: on a network error, timeout, 429 or 5xx the previous answer (disk cache, then the committed
// manifest) is kept, and an id we have never seen defaults to embeddable. Each id is requested at most once per run;
// answers are cached in .cache/embeds so repeat builds do not hit the network (embeddable: 24h, otherwise 30 min).
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { SAFE_MATTER } from '../lib/content/rules.mjs'
process.chdir(new URL('..', import.meta.url).pathname)

const POSTS = path.join('content', 'posts')
const MANIFEST = path.join('content', 'embed-status.json')
const CACHE_DIR = path.join('.cache', 'embeds')
const CACHE = path.join(CACHE_DIR, 'cache.json')
const TTL_OK = 24 * 3600e3
const TTL_BAD = 30 * 60e3
const TIMEOUT = 8000
const readJson = (f, d) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch {
    return d
  }
}
const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))

// 1. collect embeds from published posts
const ids = new Set()
const urls = new Set()
for (const f of fs.readdirSync(POSTS).filter((x) => x.endsWith('.md'))) {
  const { data, content } = matter(fs.readFileSync(path.join(POSTS, f), 'utf8'), SAFE_MATTER)
  if (data.draft) continue
  for (const m of content.matchAll(/^::youtube\{[^}]*\bid="([^"]+)"/gm)) ids.add(m[1])
  for (const m of content.matchAll(/^::embed\{[^}]*\burl="([^"]+)"/gm)) urls.add(m[1])
}

const previous = readJson(MANIFEST, { youtube: {}, urls: {} })
const cache = readJson(CACHE, {})
const now = Date.now()
const stats = { network: 0, cached: 0, kept: 0 }

async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), headers: { 'user-agent': 'michal.ai-build-embed-check' }, redirect: 'follow' })
  return res
}

/** Returns the new entry, or null when the answer is unknown (network trouble). */
async function checkYoutube(id) {
  const res = await get(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`)
  if (res.ok) {
    const j = await res.json()
    return { embeddable: true, title: j.title, thumbnail: j.thumbnail_url }
  }
  if ([401, 403, 404].includes(res.status)) return { embeddable: false }
  return null
}

async function checkUrl(url) {
  if (/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(url) || /^https?:\/\/(www\.)?vimeo\.com\//.test(url)) {
    const api = /vimeo/.test(url) ? 'https://vimeo.com/api/oembed.json?url=' : 'https://www.youtube.com/oembed?format=json&url='
    const res = await get(api + encodeURIComponent(url))
    if (res.ok) return { ok: true, status: res.status }
    return [401, 403, 404].includes(res.status) ? { ok: false, status: res.status } : null
  }
  const res = await get(url)
  const blocked = /deny|sameorigin/i.test(res.headers.get('x-frame-options') ?? '')
  if (res.status >= 500 || res.status === 429) return null
  return { ok: res.status < 400 && !blocked, status: res.status }
}

async function resolve(kind, key, check) {
  const ck = `${kind}:${key}`
  const hit = cache[ck]
  const ok = kind === 'youtube' ? hit?.entry.embeddable : hit?.entry.ok
  if (hit && now - hit.at < (ok ? TTL_OK : TTL_BAD)) {
    stats.cached++
    return hit.entry
  }
  try {
    stats.network++
    const entry = await check(key)
    if (entry) {
      cache[ck] = { at: now, entry }
      return entry
    }
  } catch (e) {
    console.warn(`build-embeds: ${ck}: ${e.name === 'TimeoutError' ? 'timeout' : e.message}`)
  }
  stats.kept++
  return hit?.entry ?? previous[kind === 'youtube' ? 'youtube' : 'urls'][key] ?? (kind === 'youtube' ? { embeddable: true } : { ok: true })
}

async function pool(items, n, fn) {
  const queue = [...items]
  await Promise.all(Array.from({ length: n }, async () => { for (let k; (k = queue.shift()) !== undefined; ) await fn(k) }))
}

const youtube = {}
const urlStatus = {}
await pool([...ids], 4, async (id) => (youtube[id] = await resolve('youtube', id, checkYoutube)))
await pool([...urls], 4, async (u) => (urlStatus[u] = await resolve('url', u, checkUrl)))

const out = JSON.stringify({ youtube: sorted(youtube), urls: sorted(urlStatus) }, null, 2) + '\n'
if (!fs.existsSync(MANIFEST) || fs.readFileSync(MANIFEST, 'utf8') !== out) fs.writeFileSync(MANIFEST, out)
fs.mkdirSync(CACHE_DIR, { recursive: true })
fs.writeFileSync(CACHE, JSON.stringify(cache))

const dead = [...Object.entries(youtube).filter(([, v]) => !v.embeddable).map(([k]) => `youtube:${k}`), ...Object.entries(urlStatus).filter(([, v]) => !v.ok).map(([k]) => k)]
console.log(`build-embeds: ${ids.size} videos, ${urls.size} other embeds; ${stats.network} requests, ${stats.cached} cached, ${stats.kept} kept; not embeddable: ${dead.length ? dead.join(', ') : 'none'}`)
