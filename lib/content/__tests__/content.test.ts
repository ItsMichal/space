import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getAllPosts, getBlogPosts, getChildren, getTopLevel } from '@/lib/content'
import { parsePost, serializePost } from '@/lib/content/serialize'
import { postPath } from '@/lib/seo'

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
    expect(postPath(logs[0])).toBe('/projects/project-mountaintop/mountaintop-first-steps-week-1-2-recap')
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

  it('covers and gallery images have real alt text', () => {
    for (const p of posts.filter((p) => p.cover)) {
      expect(p.coverAlt, p.slug).toBeTruthy()
      expect(p.coverAlt, p.slug).not.toMatch(/cover image$/i)
    }
    for (const g of posts.flatMap((p) => p.gallery ?? [])) expect(g.alt.length).toBeGreaterThan(10)
  })
})
