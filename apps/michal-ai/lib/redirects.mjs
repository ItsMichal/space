// The one place old URLs are mapped to new ones. Consumed by next.config.mjs (-> 308 redirects at the edge),
// scripts/check-slugs.mjs and the unit tests. Data lives in content/redirects.json:
//   { "<current path>": { "from": ["<former paths, newest first>"], "key": "<slug the post had before its first rename>" } }
// from[0] is the URL feeds last published, so it stays the item GUID. `key` keeps the per-slug tint (and, should reactions
// ever go live, the Durable Object room name) stable across renames. Every `from` goes straight to the current path: no chains.
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { SAFE_MATTER } from './content/rules.mjs'

export function readRedirectMap(root = process.cwd()) {
  return JSON.parse(fs.readFileSync(path.join(root, 'content', 'redirects.json'), 'utf8'))
}

/** Live (non-draft) posts as { slug, kind, parent, path } straight from the frontmatter. */
export function readPostPaths(root = process.cwd()) {
  const dir = path.join(root, 'content', 'posts')
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ f, data: matter(fs.readFileSync(path.join(dir, f), 'utf8'), SAFE_MATTER).data }))
    .filter(({ data }) => !data.draft)
    .map(({ f, data }) => {
      const slug = String(data.slug ?? f.replace(/\.md$/, ''))
      const kind = data.kind === 'article' ? 'article' : 'project'
      const parent = data.parent ? String(data.parent) : undefined
      return { slug, kind, parent, path: parent ? `/projects/${parent}/${slug}` : `${kind === 'article' ? '/writing' : '/projects'}/${slug}` }
    })
}

/**
 * Next.js `redirects()` entries. Every old page also redirects its share-card route, and an old project that
 * has children also redirects its per-project feed.
 */
export function buildRedirects(map = readRedirectMap(), posts = readPostPaths()) {
  const parents = new Set(posts.filter((p) => p.parent).map((p) => p.parent))
  const out = []
  for (const [to, { from }] of Object.entries(map)) {
    const slug = to.split('/').pop()
    const suffixes = ['', '/opengraph-image', ...(parents.has(slug) ? ['/feed.xml'] : [])]
    for (const src of from) for (const s of suffixes) out.push({ source: src + s, destination: to + s, permanent: true })
  }
  return out
}
