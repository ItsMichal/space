// Pure SEO + document statistics. Mirrors how components/content/PostPage.tsx builds <title>/OG tags.
import type { PostFrontmatter, PostKind } from '@/lib/content/types'
import type { JSONContent } from './types'

export const SITE_URL = 'https://michal.ai'
export const TITLE_SUFFIX = ' — Michał Bodzianowski' // lib/seo postTitle() appends this to <title>
export const FALLBACK_OG_IMAGE = '/michal.png'
export const BASE_PATH: Record<PostKind, string> = { project: '/projects', article: '/writing' }

export type Level = 'error' | 'warn' | 'ok'
export type SeoCheck = { id: string; level: Level; message: string }

export type DocStats = {
  words: number
  readingMinutes: number
  headings: { level: number; text: string }[]
  images: { src: string; alt: string }[]
}

const textOf = (n: JSONContent): string =>
  n.type === 'text' ? (n.text ?? '') : (n.content ?? []).map(textOf).join(n.type === 'paragraph' || n.type === 'heading' ? '' : ' ')

export function docStats(doc: JSONContent): DocStats {
  const headings: DocStats['headings'] = []
  const images: DocStats['images'] = []
  let text = ''
  const walk = (n: JSONContent) => {
    if (n.type === 'heading') headings.push({ level: Number(n.attrs?.level ?? 2), text: textOf(n) })
    if (n.type === 'image') images.push({ src: String(n.attrs?.src ?? ''), alt: String(n.attrs?.alt ?? '') })
    if (n.type === 'text') text += (n.text ?? '') + ' '
    else if (n.type === 'paragraph' || n.type === 'heading') text += ' '
    n.content?.forEach(walk)
  }
  walk(doc)
  const words = text.split(/\s+/).filter(Boolean).length
  return { words, readingMinutes: Math.max(1, Math.round(words / 220)), headings, images }
}

export function postUrl(fm: Pick<PostFrontmatter, 'kind' | 'slug'>): string {
  return `${SITE_URL}${BASE_PATH[fm.kind]}/${fm.slug}`
}

export function fullTitle(title: string): string {
  return `${title || 'Untitled'}${TITLE_SUFFIX}`
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`
}

export function analyzeSeo(fm: PostFrontmatter, stats: DocStats): SeoCheck[] {
  const checks: SeoCheck[] = []
  const add = (id: string, level: Level, message: string) => checks.push({ id, level, message })

  // <title>
  const titleLen = fullTitle(fm.title).length
  if (!fm.title.trim()) add('title', 'error', 'Add a title.')
  else if (titleLen > 60) add('title', 'warn', `Page title is ${titleLen} characters including the name suffix; Google cuts it off after about 60.`)
  else add('title', 'ok', `Page title is ${titleLen}/60 characters.`)

  // description
  const dLen = fm.description.trim().length
  if (dLen === 0) add('description', 'error', 'Add a description: it is the snippet under your title in search results.')
  else if (dLen < 120) add('description', 'warn', `Description is ${dLen} characters; aim for 120 to 160.`)
  else if (dLen > 160) add('description', 'warn', `Description is ${dLen} characters; Google truncates after about 160.`)
  else add('description', 'ok', `Description is ${dLen} characters.`)

  // images
  const missing = stats.images.filter((i) => !i.alt.trim())
  if (missing.length) add('alt', 'error', `${missing.length} image${missing.length > 1 ? 's' : ''} without alt text.`)
  else if (stats.images.length) add('alt', 'ok', 'All images have alt text.')
  if (fm.cover && !fm.coverAlt?.trim()) add('coverAlt', 'error', 'The cover image needs alt text.')
  if (!fm.cover) add('cover', 'warn', 'No cover image: link previews will use the default picture.')

  // headings
  const h1 = stats.headings.filter((h) => h.level === 1)
  if (h1.length) add('h1', 'warn', 'The title is the H1. Use H2 for sections inside the article.')
  let prev = 1
  const skipped: string[] = []
  for (const h of stats.headings) {
    if (h.level > prev + 1) skipped.push(h.text || `H${h.level}`)
    prev = h.level
  }
  if (skipped.length) add('headings', 'warn', `Heading levels skip a step at: ${skipped.slice(0, 3).join(', ')}.`)
  else if (stats.headings.some((h) => h.level >= 2)) add('headings', 'ok', 'Heading structure is clean.')
  else if (stats.words > 400) add('headings', 'warn', 'Long article without any headings; add H2 sections.')

  // slug
  if (!fm.slug) add('slug', 'error', 'Missing slug.')
  else if (fm.slug.length > 60) add('slug', 'warn', `Slug is ${fm.slug.length} characters; shorter reads better in a URL.`)
  else if (/^untitled(-\d+)?$/.test(fm.slug)) add('slug', 'warn', 'Slug is still the placeholder; edit it before publishing.')
  else if (/-(a|an|the|of|and|to|in|is)-/.test(`-${fm.slug}-`) && fm.slug.split('-').length > 6)
    add('slug', 'warn', 'Slug has filler words; trim it to the keywords.')
  else add('slug', 'ok', 'Slug looks fine.')

  // canonical
  if (fm.canonical && !/^https:\/\/\S+$/.test(fm.canonical)) add('canonical', 'error', 'Canonical must be an absolute https URL.')

  if (stats.words < 150) add('length', 'warn', `Only ${stats.words} words; very short pages rarely rank.`)
  return checks
}

export function worstLevel(checks: SeoCheck[]): Level {
  if (checks.some((c) => c.level === 'error')) return 'error'
  if (checks.some((c) => c.level === 'warn')) return 'warn'
  return 'ok'
}
