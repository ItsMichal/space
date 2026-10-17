// Build-time only: reads the filesystem. Never call from a request-time code path (Workers have no fs).
import fs from 'node:fs'
import path from 'node:path'
import { frontmatterProblem, rawPostProblem } from './rules.mjs'
import { parsePost } from './serialize'
import type { Post } from './types'

const POSTS_DIR = path.join(process.cwd(), 'content', 'posts')

function readPost(file: string): Post {
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8')
  const id = file.replace(/\.md$/, '')
  // Posts are untrusted input (they come from the space-content repo): refuse to build anything outside the content rules.
  const before = rawPostProblem(raw)
  if (before) throw new Error(`content/posts/${file}: ${before}`)
  const { frontmatter, body } = parsePost(raw, id)
  const problem = frontmatterProblem(id, frontmatter)
  if (problem) throw new Error(`content/posts/${file}: ${problem}`)
  const words = body.split(/\s+/).filter(Boolean).length
  const m = /!\[([^\]]*)\]\((\/media\/[^)\s]+)/.exec(body)
  return { ...frontmatter, body, readingMinutes: Math.max(1, Math.round(words / 220)), ...(m ? { firstImage: { src: m[2], alt: m[1] } } : {}) }
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
