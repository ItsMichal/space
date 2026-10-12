#!/usr/bin/env node
// URL-slug guard for apps/michal-ai (exit 1 on any failure).
//   - every post slug is lowercase ASCII words joined by single hyphens, at most 60 characters
//   - no two posts share a slug (slugs also key tints, feeds and reactions) or a public path
//   - every redirect in content/redirects.json points at a live post, goes straight there (no chains)
//     and its source is not itself a live route
// Run: node scripts/check-slugs.mjs   (also: npm run check:slugs)
import path from 'node:path'
import { buildRedirects, readPostPaths, readRedirectMap } from '../apps/michal-ai/lib/redirects.mjs'

const root = path.resolve(import.meta.dirname, '..', 'apps', 'michal-ai')
const map = readRedirectMap(root)
const posts = readPostPaths(root)
const errors = []
const fail = (m) => errors.push(m)

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const seenSlug = new Map()
const seenPath = new Map()
for (const p of posts) {
  if (!SLUG_RE.test(p.slug)) fail(`slug "${p.slug}" must be lowercase a-z, 0-9 and single hyphens`)
  if (p.slug.length > 60) fail(`slug "${p.slug}" is ${p.slug.length} characters (max 60)`)
  if (seenSlug.has(p.slug)) fail(`slug "${p.slug}" is used by more than one post`)
  if (seenPath.has(p.path)) fail(`path ${p.path} is used by more than one post`)
  seenSlug.set(p.slug, p)
  seenPath.set(p.path, p)
}

const parents = new Set(posts.filter((p) => p.parent).map((p) => p.parent))
const live = new Set(posts.flatMap((p) => [p.path, `${p.path}/opengraph-image`, ...(parents.has(p.slug) && !p.parent ? [`${p.path}/feed.xml`] : [])]))
const redirects = buildRedirects(map, posts)
const sources = new Set(redirects.map((r) => r.source))
for (const r of redirects) {
  if (live.has(r.source)) fail(`redirect source ${r.source} is also a live route`)
  if (!live.has(r.destination)) fail(`redirect ${r.source} -> ${r.destination}: destination is not a live route`)
  if (sources.has(r.destination)) fail(`redirect ${r.source} -> ${r.destination}: chain (destination is itself redirected)`)
}
for (const to of Object.keys(map)) if (!seenPath.has(to)) fail(`content/redirects.json: ${to} is not a current post path`)

if (errors.length) {
  console.error(`check-slugs: ${errors.length} problem(s)\n  - ${errors.join('\n  - ')}`)
  process.exit(1)
}
console.log(`check-slugs: ${posts.length} posts, ${redirects.length} redirects OK`)
