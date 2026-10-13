import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getAllPosts, getArticleSeries, getBlogPosts, getChildren, getProjectLogs, getSeriesOf, getTopLevel } from '@/lib/content'
import { groupWriting } from '@/lib/content/writing'
import { parsePost, serializePost } from '@/lib/content/serialize'
import { originalSite, postMetadata, postPath } from '@/lib/seo'

const posts = getAllPosts({ includeDrafts: true })

describe('content integrity', () => {
  it('every post file survives a parse/serialize round trip', () => {
    for (const p of posts) {
      const raw = fs.readFileSync(path.join(process.cwd(), 'content/posts', `${p.slug}.md`), 'utf8')
      const { frontmatter, body } = parsePost(raw, p.slug)
      expect(parsePost(serializePost(frontmatter, body), p.slug).frontmatter).toEqual(frontmatter)
    }
  })

  it('hero hooks are short noun phrases and survive a round trip', () => {
    const hooked = posts.filter((p) => p.hook)
    expect(hooked.length).toBeGreaterThanOrEqual(7)
    for (const p of hooked) {
      expect(p.hook!.length, p.slug).toBeLessThanOrEqual(48)
    }
    const fm = parsePost(serializePost({ ...hooked[0], hook: 'a thing, with: punctuation' }, 'x'), hooked[0].slug).frontmatter
    expect(fm.hook).toBe('a thing, with: punctuation')
  })

  it('parents are existing top-level projects', () => {
    for (const p of posts.filter((p) => p.parent)) {
      const parent = posts.find((x) => x.slug === p.parent)
      expect(parent, `${p.slug} -> ${p.parent}`).toBeDefined()
      expect(parent!.kind).toBe('project')
      expect(parent!.parent).toBeUndefined()
    }
  })

  it('children are routed under their parent and kept out of the blog and project index', () => {
    const logs = getChildren('project-mountaintop')
    expect(logs).toHaveLength(7)
    expect(logs.map((l) => l.order)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(postPath(logs[0])).toBe('/projects/project-mountaintop/week-1-2-first-steps')
    expect(getBlogPosts().some((p) => p.parent)).toBe(false)
    expect(getTopLevel('project').some((p) => p.parent)).toBe(false)
  })

  it('every image referenced in frontmatter exists', () => {
    for (const p of posts) {
      for (const src of [p.cover, ...(p.gallery ?? []).map((g) => g.src)].filter(Boolean) as string[]) {
        expect(fs.existsSync(path.join(process.cwd(), 'public', src)), `${p.slug}: ${src}`).toBe(true)
      }
    }
  })

  it('published posts that first appeared elsewhere canonicalise to themselves and credit the original', () => {
    const imported = getAllPosts().filter((p) => p.originalUrl)
    expect(imported.length).toBeGreaterThanOrEqual(13)
    for (const p of imported) {
      expect(p.canonical, p.slug).toBeUndefined()
      expect(p.draft, p.slug).toBeUndefined()
      expect(() => new URL(p.originalUrl!), p.slug).not.toThrow()
      const meta = postMetadata(p)
      expect(meta.alternates?.canonical, p.slug).toBe(`https://michal.ai${postPath(p)}`)
    }
  })

  it('published descriptions are 50-160 characters (poznan-low-roar-mv is a one-line post)', () => {
    for (const p of getAllPosts().filter((p) => p.originalUrl && p.slug !== 'poznan-low-roar-mv')) {
      expect(p.description.length, p.slug).toBeGreaterThanOrEqual(50)
      expect(p.description.length, p.slug).toBeLessThanOrEqual(160)
    }
  })

  it('only samples stay drafts', () => {
    expect(posts.filter((p) => p.draft).map((p) => p.slug)).toEqual(['hello-paper'])
  })

  it('top-level series are ordered and have 2+ posts', () => {
    const object = getArticleSeries().find((g) => g.name === 'Object')
    expect(object?.posts.map((p) => p.order)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(getSeriesOf(object!.posts[2])?.id).toBe('series-object')
    expect(getProjectLogs()[0]?.parent?.slug).toBe('project-mountaintop')
  })

  it('groups writing into featured, series and years without repeating a post', () => {
    const g = groupWriting(getBlogPosts(), [...getArticleSeries(), ...getProjectLogs()])
    expect(g.featured.length).toBeGreaterThan(0)
    const years = g.years.flatMap((y) => y.posts)
    for (const p of years) {
      expect(p.series, p.slug).toBeUndefined()
      expect(g.featured.includes(p), p.slug).toBe(false)
    }
    expect(g.years.map((y) => y.year)).toEqual([...g.years.map((y) => y.year)].sort().reverse())
  })

  it('names the original site from its URL', () => {
    expect(originalSite('https://halmic.medium.com/x-123')).toBe('Medium')
    expect(originalSite('https://www.example.org/a')).toBe('Example')
    expect(originalSite('not a url')).toBeUndefined()
  })

  it('covers and gallery images have real alt text', () => {
    for (const p of posts.filter((p) => p.cover)) {
      expect(p.coverAlt, p.slug).toBeTruthy()
      expect(p.coverAlt, p.slug).not.toMatch(/cover image$/i)
    }
    for (const g of posts.flatMap((p) => p.gallery ?? [])) expect(g.alt.length).toBeGreaterThan(10)
  })
})
