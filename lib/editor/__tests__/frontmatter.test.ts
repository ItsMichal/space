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

describe('slugify', () => {
  it('produces url-safe slugs', () => {
    expect(slugify('Hello, Wörld & Friends!')).toBe('hello-world-and-friends')
    expect(slugify('  --  ')).toBe('')
    expect(slugify('A'.repeat(100)).length).toBeLessThanOrEqual(64)
  })
})
