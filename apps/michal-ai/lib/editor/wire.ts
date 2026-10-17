// Request and response shapes of /api/write/*, shared by the local dev API (lib/editor/server), the hosted Worker
// (write/worker) and the browser client (lib/editor/client/api.ts). Types only.
import type { PostFrontmatter, PostKind } from '../content/types'

/** Where a post's editable copy lives in the hosted editor. Absent in local dev, where the working tree is the only copy. */
export type PostSource = {
  /** The post's file exists on the base branch (main). */
  onMain: boolean
  /** The editor branch (write/<slug>) when one exists. */
  branch: string | null
  pr: { number: number; url: string } | null
}

export type PostSummary = {
  id: string
  title: string
  slug: string
  kind: PostKind
  date: string
  updated?: string
  draft: boolean
  tags: string[]
  description: string
  words: number
  mtimeMs: number
  source?: PostSource
}

export type PostFile = {
  id: string
  frontmatter: PostFrontmatter
  body: string
  hash: string
  mtimeMs: number
  source?: PostSource
}

export type SaveInput = { frontmatter: PostFrontmatter; body: string; baseHash?: string; force?: boolean }
export type SaveResult = { hash: string; mtimeMs: number }
export type UploadResult = { src: string; width: number; height: number; bytes: number; converted: boolean }

export type PostStatus = PostSource & { branchUrl: string | null; compareUrl: string | null }
export type ShipResult = { url: string; number: number; created: boolean }
