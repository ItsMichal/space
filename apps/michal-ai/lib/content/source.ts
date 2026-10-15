// Build-time only: reads the filesystem. Never call from a request-time code path (Workers have no fs).
import fs from 'node:fs'
import path from 'node:path'
import { parsePost } from './serialize'
import type { Post } from './types'

const POSTS_DIR = path.join(process.cwd(), 'content', 'posts')

function readPost(file: string): Post {
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8')
  const { frontmatter, body } = parsePost(raw, file.replace(/\.md$/, ''))
  const words = body.split(/\s+/).filter(Boolean).length
  return { ...frontmatter, body, readingMinutes: Math.max(1, Math.round(words / 220)) }
}

export function loadPosts(includeDrafts: boolean): Post[] {
  if (!fs.existsSync(POSTS_DIR)) return []
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map(readPost)
    .filter((p) => includeDrafts || !p.draft)
    .sort((a, b) => Number(Boolean(a.minor)) - Number(Boolean(b.minor)) || (b.priority ?? 0) - (a.priority ?? 0) || b.date.localeCompare(a.date))
}

/** Browser-only hook (see source.client.ts); nothing to do where posts are read straight from disk. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerPosts(_list: Omit<Post, 'body'>[]) {}
