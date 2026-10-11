import { describe, expect, it } from 'vitest'
import type { PostFrontmatter } from '@/lib/content/types'
import { analyzeSeo, docStats, truncate } from '../seo'
import { markdownToDoc } from '../markdown'

const fm = (over: Partial<PostFrontmatter> = {}): PostFrontmatter => ({
  title: 'A decent title',
  slug: 'a-decent-title',
  kind: 'article',
  description: 'x'.repeat(140),
  date: '2026-10-01',
  tags: [],
  cover: '/media/a/cover.webp',
  coverAlt: 'cover',
  ...over,
})

const stats = (md: string) => docStats(markdownToDoc(md))
const level = (checks: ReturnType<typeof analyzeSeo>, id: string) => checks.find((c) => c.id === id)?.level

describe('docStats', () => {
  it('counts words, headings and images', () => {
    const s = stats('## One\n\nsome words here\n\n### Two\n\n![](/a.png)\n\n![ok](/b.png)')
    expect(s.headings).toEqual([{ level: 2, text: 'One' }, { level: 3, text: 'Two' }])
    expect(s.images.map((i) => i.alt)).toEqual(['', 'ok'])
    expect(s.words).toBe(5)
    expect(s.readingMinutes).toBe(1)
  })
})

describe('analyzeSeo', () => {
  it('flags long titles (suffix included) and bad descriptions', () => {
    const c = analyzeSeo(fm({ title: 'T'.repeat(55), description: 'short' }), stats('x'))
    expect(level(c, 'title')).toBe('warn')
    expect(level(c, 'description')).toBe('warn')
    expect(level(analyzeSeo(fm({ description: '' }), stats('x')), 'description')).toBe('error')
    expect(level(analyzeSeo(fm(), stats('x')), 'description')).toBe('ok')
  })

  it('reports missing alt text and cover alt', () => {
    const c = analyzeSeo(fm({ coverAlt: '' }), stats('![](/a.png)'))
    expect(level(c, 'alt')).toBe('error')
    expect(level(c, 'coverAlt')).toBe('error')
  })

  it('detects skipped heading levels and body H1s', () => {
    expect(level(analyzeSeo(fm(), stats('## a\n\n#### b')), 'headings')).toBe('warn')
    expect(level(analyzeSeo(fm(), stats('# a')), 'h1')).toBe('warn')
    expect(level(analyzeSeo(fm(), stats('## a\n\n### b')), 'headings')).toBe('ok')
  })

  it('flags placeholder and overlong slugs', () => {
    expect(level(analyzeSeo(fm({ slug: 'untitled-2' }), stats('x')), 'slug')).toBe('warn')
    expect(level(analyzeSeo(fm({ slug: 'a'.repeat(70) }), stats('x')), 'slug')).toBe('warn')
  })
})

describe('truncate', () => {
  it('adds an ellipsis only when cutting', () => {
    expect(truncate('abc', 5)).toBe('abc')
    expect(truncate('abcdefgh', 5)).toBe('abcd…')
  })
})
