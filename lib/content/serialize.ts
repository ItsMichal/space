// Pure helpers for (de)serialising a post file. No fs access, so it is safe in any runtime.
// The key order and flow-style tags match the hand-written files in content/posts.
import matter from 'gray-matter'
import type { PostFrontmatter, PostKind } from './types'

const KEY_ORDER: (keyof PostFrontmatter)[] = [
  'title',
  'slug',
  'kind',
  'description',
  'date',
  'updated',
  'tags',
  'cover',
  'coverAlt',
  'priority',
  'draft',
  'canonical',
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
    case 'date':
    case 'updated':
    case 'priority':
      return `${key}: ${value}`
    case 'draft':
      return value ? 'draft: true' : null
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

export function parsePost(raw: string, fileSlug: string): { frontmatter: PostFrontmatter; body: string } {
  const { data, content } = matter(raw)
  const frontmatter: PostFrontmatter = {
    title: String(data.title ?? fileSlug),
    slug: String(data.slug ?? fileSlug),
    kind: (data.kind === 'article' ? 'article' : 'project') as PostKind,
    description: String(data.description ?? ''),
    date: toIsoDate(data.date),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    ...(data.updated ? { updated: toIsoDate(data.updated) } : {}),
    ...(data.cover ? { cover: String(data.cover) } : {}),
    ...(data.coverAlt ? { coverAlt: String(data.coverAlt) } : {}),
    ...(typeof data.priority === 'number' ? { priority: data.priority } : {}),
    ...(data.draft ? { draft: true } : {}),
    ...(data.canonical ? { canonical: String(data.canonical) } : {}),
  }
  return { frontmatter, body: content.trim() }
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
