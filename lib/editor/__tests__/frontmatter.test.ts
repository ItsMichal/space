import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parsePost, serializePost, slugify } from '@/lib/content/serialize'
import type { PostFrontmatter } from '@/lib/content/types'

const base: PostFrontmatter = {
  title: 'Hello: "quoted", world',
  slug: 'hello-world',
  kind: 'article',
  description: "It's got: colons, #hashes and 'quotes'",
  date: '2026-10-09',
  tags: ['a b', 'c,d', 'plain'],
  priority: 0,
  draft: true,
}

describe('frontmatter serialisation', () => {
  it('round-trips awkward strings through gray-matter', () => {
    const { frontmatter, body } = parsePost(serializePost(base, '## Body\n'), 'x')
    expect(frontmatter).toEqual(base)
    expect(body).toBe('## Body')
  })

  it('reproduces the hand-written sample exactly', () => {
    const raw = fs.readFileSync(path.join(process.cwd(), 'content/posts/hello-paper.md'), 'utf8')
    const { frontmatter, body } = parsePost(raw, 'hello-paper')
    expect(serializePost(frontmatter, body)).toBe(raw)
  })

  it('omits draft when false and empty optionals', () => {
    const out = serializePost({ ...base, draft: false, priority: undefined, tags: [] }, 'x')
    expect(out).not.toMatch(/draft|priority|cover/)
    expect(out).toContain('tags: []')
  })
})

describe('showcase + hierarchy fields', () => {
  const rich: PostFrontmatter = {
    ...base,
    kind: 'project',
    draft: undefined,
    cover: '/media/x/cover.webp',
    coverAlt: 'A thing',
    coverFocus: '50% 30%',
    featured: true,
    parent: 'big-project',
    series: 'Progress log',
    order: 3,
    role: 'Lead developer: "all of it"',
    links: [{ label: 'Live: site', href: 'https://example.com/?a=1&b=2' }],
    gallery: [
      { src: '/media/x/a.webp', alt: 'Alt, with: punctuation' },
      { src: '/media/x/b.png', alt: 'B', caption: 'Caption "quoted"' },
    ],
  }
  it('round-trips every optional field', () => {
    const { frontmatter } = parsePost(serializePost(rich, 'Body'), 'x')
    expect(frontmatter).toEqual(rich)
  })
  it('is stable: serialising twice yields identical text', () => {
    const once = serializePost(rich, 'Body')
    const { frontmatter, body } = parsePost(once, 'x')
    expect(serializePost(frontmatter, body)).toBe(once)
  })
  it('drops malformed links and gallery entries instead of throwing', () => {
    const raw = '---\ntitle: T\nlinks:\n  - label: only label\n  - nope\ngallery:\n  - alt: no src\n---\n\nx\n'
    const { frontmatter } = parsePost(raw, 't')
    expect(frontmatter.links).toBeUndefined()
    expect(frontmatter.gallery).toBeUndefined()
  })
})

describe('slugify', () => {
  it('produces url-safe slugs', () => {
    expect(slugify('Hello, Wörld & Friends!')).toBe('hello-world-and-friends')
    expect(slugify('  --  ')).toBe('')
    expect(slugify('A'.repeat(100)).length).toBeLessThanOrEqual(64)
  })
})
