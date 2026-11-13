// Private pages at build time (docs/private-pages.md). Plain Node, used by react-router.config.ts (which paths to prerender), the
// private page route's loader, and scripts/build-pages-manifest.mjs (the link table the Worker reads).
//
// A page's HTML is prerendered at /p/<key>, never at /p/<token>: react-router prints every prerendered path in the build log, and
// the space repo's Actions logs are public. The key is a hash of the page id and all its tokens, so it says nothing about either,
// and it changes whenever a link is added or revoked. The Worker answers 404 at /p/<key>; only /p/<token> of an open link is served.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { SAFE_MATTER } from '../content/rules.mjs'
import { linkUntil, pageIdProblem, parsePageData } from '../content/pages.mjs'

export const pagesDir = (root = process.cwd()) => path.join(root, 'content', 'pages')

/** The key a page's HTML is built under: 24 hex characters of sha256 over its id and every token. */
export function pageKey(id, page) {
  return crypto
    .createHash('sha256')
    .update(['space-private-page', id, ...page.links.map((l) => l.token)].join('\n'))
    .digest('hex')
    .slice(0, 24)
}

/** Every page in content/pages that passes the rules, as { id, key, page, body }. Bad files are skipped (validate.mjs fails the build on them first). */
export function readPages(root = process.cwd()) {
  const dir = pagesDir(root)
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue
    const id = e.name.slice(0, -3)
    if (pageIdProblem(id)) continue
    let parsed
    try {
      parsed = matter(fs.readFileSync(path.join(dir, e.name), 'utf8'), SAFE_MATTER)
    } catch {
      continue
    }
    const r = parsePageData(parsed.data)
    if (!r.page) continue
    out.push({ id, key: pageKey(id, r.page), page: r.page, body: parsed.content.trim() })
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * The link table the Worker reads at /_private/pages.json: token -> { page, key, until }. A page that is disabled, and a link
 * that is revoked, are left out entirely; dates are checked by the Worker on every request.
 */
export function pagesManifest(pages) {
  const links = {}
  for (const p of pages) {
    for (const l of p.page.links) {
      const until = linkUntil(p.page, l)
      if (until === null) continue
      links[l.token] = { page: p.id, key: p.key, until }
    }
  }
  return { links, pages: pages.map((p) => p.id) }
}
