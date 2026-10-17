#!/usr/bin/env node
// Content validator: every post and media file against lib/content/rules.mjs. Exits 1 on any problem.
// Runs in three places with the same code:
//   - here, from prebuild: node scripts/content/validate.mjs (content/posts and the post folders of public/media)
//   - here, by hand: npm run content:check, or with --posts <dir> --media <dir> against any checkout
//   - in ItsMichal/space-content CI, where make-seed.mjs copies this file and rules.mjs (defaults: posts/ and media/)
// Needs Node 22 and gray-matter, nothing else. No network, no secrets.
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { SAFE_MATTER, bodyProblems, dashLines, frontmatterProblem, mediaProblem, rawPostProblem, slugProblem } from '../../lib/content/rules.mjs'

// Media folders that belong to the site, not to posts (they stay in the space repo).
const SITE_MEDIA = new Set(['about', '_v', '_og'])
const SITE_MEDIA_FILES = new Set(['CREDITS.md'])

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : fallback
}
const inApp = fs.existsSync(path.join(process.cwd(), 'content', 'posts')) && fs.existsSync(path.join(process.cwd(), 'public', 'media'))
const postsDir = path.resolve(arg('--posts', inApp ? 'content/posts' : 'posts'))
const mediaDir = path.resolve(arg('--media', inApp ? 'public/media' : 'media'))

/** Frontmatter as the site sees it: the same normalisation as lib/content/serialize.ts frontmatterFromData, for the checked fields. */
function normalise(data, id) {
  const str = (v) => (v === undefined || v === null ? undefined : String(v))
  const date = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : str(v))
  const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
  return {
    ...data,
    title: str(data.title) ?? id,
    slug: str(data.slug) ?? id,
    kind: data.kind === 'article' ? 'article' : data.kind === 'project' || data.kind === undefined ? 'project' : String(data.kind),
    description: str(data.description) ?? '',
    date: date(data.date) ?? '',
    updated: data.updated ? date(data.updated) : undefined,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : data.tags === undefined ? [] : data.tags,
    links: Array.isArray(data.links) ? data.links.filter((l) => isObj(l) && l.label && l.href).map((l) => ({ label: String(l.label), href: String(l.href) })) : [],
    gallery: Array.isArray(data.gallery) ? data.gallery.filter((g) => isObj(g) && g.src).map((g) => ({ src: String(g.src) })) : [],
    publications: Array.isArray(data.publications) ? data.publications.map(String) : [],
  }
}

const problems = []
const report = (file, msg) => problems.push(`${file}: ${msg}`)
const ids = new Map()

if (!fs.existsSync(postsDir)) {
  console.error(`content: no posts folder at ${postsDir}. Run npm run content:pull (see docs/write.md).`)
  process.exit(1)
}

for (const e of fs.readdirSync(postsDir, { withFileTypes: true })) {
  const rel = path.join(path.basename(postsDir), e.name)
  if (e.name.startsWith('.')) continue
  if (!e.isFile() || !e.name.endsWith('.md')) {
    report(rel, 'only <slug>.md files belong in the posts folder')
    continue
  }
  const id = e.name.slice(0, -3)
  const sp = slugProblem(id)
  if (sp) report(rel, `file name: ${sp}`)
  const raw = fs.readFileSync(path.join(postsDir, e.name), 'utf8')
  const rp = rawPostProblem(raw)
  if (rp) {
    report(rel, rp)
    continue
  }
  let parsed
  try {
    parsed = matter(raw, SAFE_MATTER)
  } catch (err) {
    report(rel, `front matter does not parse: ${err.message}`)
    continue
  }
  const fm = normalise(parsed.data, id)
  const fp = frontmatterProblem(id, fm)
  if (fp) report(rel, fp)
  const postId = String(parsed.data.id ?? id)
  if (ids.has(postId)) report(rel, `id "${postId}" is also used by ${ids.get(postId)}`)
  ids.set(postId, rel)
  for (const b of bodyProblems(parsed.content)) report(rel, b)
  for (const d of dashLines(raw)) report(`${rel}:${d.line}`, `em or en dash: ${d.text}`)
}

if (fs.existsSync(mediaDir)) {
  for (const e of fs.readdirSync(mediaDir, { withFileTypes: true })) {
    if (SITE_MEDIA.has(e.name) || SITE_MEDIA_FILES.has(e.name) || e.name === '.DS_Store' || e.name === '.gitkeep') continue
    const rel = path.join(path.basename(mediaDir), e.name)
    if (!e.isDirectory()) {
      report(rel, 'media files go in media/<post slug>/')
      continue
    }
    for (const f of fs.readdirSync(path.join(mediaDir, e.name), { withFileTypes: true })) {
      if (f.name === '.DS_Store') continue
      const frel = `${rel}/${f.name}`
      if (!f.isFile() || f.isSymbolicLink()) {
        report(frel, 'only plain files, one level deep')
        continue
      }
      const mp = mediaProblem(e.name, f.name, new Uint8Array(fs.readFileSync(path.join(mediaDir, e.name, f.name))))
      if (mp) report(frel, mp)
    }
  }
}

if (problems.length) {
  console.error(`content: ${problems.length} problem${problems.length > 1 ? 's' : ''}\n${problems.map((p) => `  ${p}`).join('\n')}`)
  process.exit(1)
}
console.log(`content: ${ids.size} posts and their media pass the content rules`)
