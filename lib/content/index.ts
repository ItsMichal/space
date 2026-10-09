// Build-time only: reads the filesystem. Never call from a request-time code path
// (Workers have no fs). Use from generateStaticParams / statically rendered pages.
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import type { Post, PostFrontmatter, PostKind } from './types'

export * from './types'

const POSTS_DIR = path.join(process.cwd(), 'content', 'posts')

function toIsoDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v ?? '').slice(0, 10)
}

function readPost(file: string): Post {
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8')
  const { data, content } = matter(raw)
  const slug = String(data.slug ?? file.replace(/\.md$/, ''))
  const words = content.split(/\s+/).filter(Boolean).length
  const fm: PostFrontmatter = {
    title: String(data.title ?? slug),
    slug,
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
  return { ...fm, body: content, readingMinutes: Math.max(1, Math.round(words / 220)) }
}

export function getAllPosts({ includeDrafts = false }: { includeDrafts?: boolean } = {}): Post[] {
  if (!fs.existsSync(POSTS_DIR)) return []
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map(readPost)
    .filter((p) => includeDrafts || !p.draft)
    .sort(
      (a, b) =>
        (b.priority ?? 0) - (a.priority ?? 0) || b.date.localeCompare(a.date)
    )
}

export function getPost(slug: string, opts: { includeDrafts?: boolean } = {}): Post | undefined {
  return getAllPosts(opts).find((p) => p.slug === slug)
}

export function getPostsByKind(kind: PostKind, opts: { includeDrafts?: boolean } = {}): Post[] {
  return getAllPosts(opts).filter((p) => p.kind === kind)
}
