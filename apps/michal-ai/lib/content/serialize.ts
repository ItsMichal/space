// Pure helpers for (de)serialising a post file. No fs access, so it is safe in any runtime.
// The key order and flow-style tags match the hand-written files in content/posts.
import matter from 'gray-matter'
import type { GalleryItem, PostFrontmatter, PostKind, PostLink } from './types'

const KEY_ORDER: (keyof PostFrontmatter)[] = [
  'title',
  'slug',
  'kind',
  'id',
  'description',
  'date',
  'updated',
  'tags',
  'cover',
  'coverAlt',
  'coverFocus',
  'cardImage',
  'cardImageAlt',
  'priority',
  'featured',
  'minor',
  'parent',
  'series',
  'order',
  'role',
  'years',
  'hook',
  'links',
  'gallery',
  'draft',
  'canonical',
  'originalUrl',
  'publications',
]

function toIsoDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v ?? '').slice(0, 10)
}

/** Quote a YAML scalar only when it would otherwise be mis-parsed. */
function scalar(value: string, flow = false): string {
  const plain =
    value.length > 0 &&
    (flow ? /^[A-Za-z0-9_./(][^:#\n"'[\]{},&*!|>%@`]*$/ : /^[A-Za-z0-9_./(][^:#\n"'[\]{}&*!|>%@`]*$/).test(value) &&
    !/^(true|false|null|yes|no|on|off|~|[-+]?[0-9.]+)$/i.test(value) &&
    !/\s$/.test(value)
  return plain ? value : JSON.stringify(value)
}

function entry(key: keyof PostFrontmatter, value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  switch (key) {
    case 'tags':
      return (value as string[]).length ? `tags: [${(value as string[]).map((t) => scalar(t, true)).join(', ')}]` : 'tags: []'
    case 'publications':
      return (value as string[]).length ? `publications: [${(value as string[]).map((t) => scalar(t, true)).join(', ')}]` : null
    case 'date':
    case 'updated':
    case 'priority':
    case 'order':
      return `${key}: ${value}`
    case 'draft':
    case 'featured':
    case 'minor':
      return value ? `${key}: true` : null
    case 'links':
      return (value as PostLink[]).length
        ? `links:\n${(value as PostLink[]).map((l) => `  - label: ${scalar(l.label)}\n    href: ${scalar(l.href)}`).join('\n')}`
        : null
    case 'gallery':
      return (value as GalleryItem[]).length
        ? `gallery:\n${(value as GalleryItem[])
            .map(
              (g) =>
                `  - src: ${scalar(g.src)}\n    alt: ${scalar(g.alt)}` + (g.caption ? `\n    caption: ${scalar(g.caption)}` : '')
            )
            .join('\n')}`
        : null
    default:
      return `${key}: ${scalar(String(value))}`
  }
}

export function serializeFrontmatter(fm: PostFrontmatter): string {
  const lines = KEY_ORDER.map((k) => entry(k, fm[k])).filter((l): l is string => l !== null)
  return `---\n${lines.join('\n')}\n---\n`
}

/** Full file text: frontmatter + blank line + body (always ends with a newline). */
export function serializePost(fm: PostFrontmatter, body: string): string {
  return `${serializeFrontmatter(fm)}\n${body.trim()}\n`
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Normalises gray-matter `data` into typed frontmatter. Shared by the site loader and the writing tool. */
export function frontmatterFromData(data: Record<string, unknown>, fileSlug: string): PostFrontmatter {
  const links = (Array.isArray(data.links) ? data.links : [])
    .filter((l) => isObj(l) && l.label && l.href)
    .map((l) => ({ label: String((l as Record<string, unknown>).label), href: String((l as Record<string, unknown>).href) }))
  const gallery = (Array.isArray(data.gallery) ? data.gallery : [])
    .filter((g) => isObj(g) && g.src)
    .map((g) => {
      const o = g as Record<string, unknown>
      return { src: String(o.src), alt: String(o.alt ?? ''), ...(o.caption ? { caption: String(o.caption) } : {}) }
    })
  return {
    title: String(data.title ?? fileSlug),
    slug: String(data.slug ?? fileSlug),
    ...(data.id ? { id: String(data.id) } : {}),
    kind: (data.kind === 'article' ? 'article' : 'project') as PostKind,
    description: String(data.description ?? ''),
    date: toIsoDate(data.date),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    ...(data.updated ? { updated: toIsoDate(data.updated) } : {}),
    ...(data.cover ? { cover: String(data.cover) } : {}),
    ...(data.coverAlt ? { coverAlt: String(data.coverAlt) } : {}),
    ...(data.coverFocus ? { coverFocus: String(data.coverFocus) } : {}),
    ...(data.cardImage ? { cardImage: String(data.cardImage) } : {}),
    ...(data.cardImageAlt ? { cardImageAlt: String(data.cardImageAlt) } : {}),
    ...(typeof data.priority === 'number' ? { priority: data.priority } : {}),
    ...(data.featured ? { featured: true } : {}),
    ...(data.minor ? { minor: true } : {}),
    ...(data.parent ? { parent: String(data.parent) } : {}),
    ...(data.series ? { series: String(data.series) } : {}),
    ...(typeof data.order === 'number' ? { order: data.order } : {}),
    ...(data.role ? { role: String(data.role) } : {}),
    ...(data.years ? { years: String(data.years) } : {}),
    ...(data.hook ? { hook: String(data.hook) } : {}),
    ...(links.length ? { links } : {}),
    ...(gallery.length ? { gallery } : {}),
    ...(data.draft ? { draft: true } : {}),
    ...(data.canonical ? { canonical: String(data.canonical) } : {}),
    ...(data.originalUrl ? { originalUrl: String(data.originalUrl) } : {}),
    ...(Array.isArray(data.publications) && data.publications.length ? { publications: data.publications.map(String) } : {}),
  }
}

export function parsePost(raw: string, fileSlug: string): { frontmatter: PostFrontmatter; body: string } {
  const { data, content } = matter(raw)
  return { frontmatter: frontmatterFromData(data, fileSlug), body: content.trim() }
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '')
}

export const SLUG_RE = /^[a-z0-9-]+$/
