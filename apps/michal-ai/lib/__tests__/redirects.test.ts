import { describe, expect, it } from 'vitest'
import { buildRedirects, readPostPaths, readRedirectMap } from '../redirects.mjs'
import { feedIdPath, stableKey } from '../slug-history'
import sitemap from '../../app/sitemap'
import { SITE_URL } from '../seo'

const map = readRedirectMap()
const posts = readPostPaths()
const redirects = buildRedirects(map, posts)

// Every route the build serves for content: the page, its share card, and (for parents) the log feed.
const parents = new Set(posts.filter((p) => p.parent).map((p) => p.parent))
const live = new Set(
  posts.flatMap((p) => [p.path, `${p.path}/opengraph-image`, ...(parents.has(p.slug) && !p.parent ? [`${p.path}/feed.xml`] : [])]),
)
const bySource = new Map(redirects.map((r) => [r.source, r.destination]))

describe('slug redirects', () => {
  it('every old URL resolves in one hop to a route that exists', () => {
    expect(redirects.length).toBeGreaterThan(0)
    for (const r of redirects) {
      expect(live.has(r.destination), `${r.source} -> ${r.destination}`).toBe(true)
      expect(bySource.has(r.destination), `${r.source} chains through ${r.destination}`).toBe(false)
    }
  })

  it('no redirect source is also a live route', () => {
    for (const r of redirects) expect(live.has(r.source), r.source).toBe(false)
  })

  it('every entry points at a current post and a source is claimed once', () => {
    const seen = new Set<string>()
    for (const [to, { from }] of Object.entries(map)) {
      expect(posts.some((p) => p.path === to), `${to} is not a post`).toBe(true)
      for (const f of from) {
        expect(seen.has(f), `duplicate source ${f}`).toBe(false)
        seen.add(f)
      }
    }
  })

  it('keeps the pre-nesting and legacy URLs working', () => {
    expect(bySource.get('/projects/barcode-game')).toBe('/projects/office-wizards')
    expect(bySource.get('/writing/mountaintop-week-5-6-spaaaaace')).toBe('/projects/project-mountaintop/week-5-6-space')
    expect(bySource.get('/projects/spacex-starlink-general-projects/feed.xml')).toBe('/projects/starlink/feed.xml')
    expect(bySource.get('/projects/spacex-starlink-order-flow')).toBe('/projects/starlink/order-flow')
  })

  it('feed ids and tint keys survive a rename', () => {
    expect(feedIdPath('/projects/starlink')).toBe('/projects/spacex-starlink-general-projects')
    expect(feedIdPath('/writing/hello-unrenamed')).toBe('/writing/hello-unrenamed')
    expect(stableKey('ai-crofty')).toBe('realtime-ai-f1-comentator')
    expect(stableKey('isat-dashboard')).toBe('isat-dashboard')
  })

  it('the sitemap lists only current URLs', () => {
    const urls = new Set(sitemap().map((s) => s.url))
    for (const r of redirects) expect(urls.has(`${SITE_URL}${r.source}`), r.source).toBe(false)
    for (const p of posts) expect(urls.has(`${SITE_URL}${p.path}`), p.path).toBe(true)
  })
})
