// Build-time only: reads the filesystem. Never call from a request-time code path
// (Workers have no fs). Use from generateStaticParams / statically rendered pages.
import fs from 'node:fs'
import path from 'node:path'
import { parsePost } from './serialize'
import type { Post, PostKind } from './types'

export * from './types'

const POSTS_DIR = path.join(process.cwd(), 'content', 'posts')

function readPost(file: string): Post {
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8')
  const { frontmatter, body } = parsePost(raw, file.replace(/\.md$/, ''))
  const words = body.split(/\s+/).filter(Boolean).length
  return { ...frontmatter, body, readingMinutes: Math.max(1, Math.round(words / 220)) }
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

/** Top-level posts of a kind: children (posts with a `parent`) are excluded. Use for index pages and static params. */
export function getTopLevel(kind: PostKind, opts: { includeDrafts?: boolean } = {}): Post[] {
  return getAllPosts(opts).filter((p) => p.kind === kind && !p.parent)
}

/** The owner's own blog: articles without a parent project. */
export const getBlogPosts = () => getTopLevel('article')

/** Children of a project in reading order (`order`, then date). */
export function getChildren(parentSlug: string, opts: { includeDrafts?: boolean } = {}): Post[] {
  return getAllPosts(opts)
    .filter((p) => p.parent === parentSlug)
    .sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.date.localeCompare(b.date))
}
