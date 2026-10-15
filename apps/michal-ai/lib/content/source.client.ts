// Browser twin of ./source: posts (without their markdown bodies) arrive from the root loader and are registered here.
import type { Post } from './types'

let posts: Post[] = []
let last: unknown

export function registerPosts(list: Omit<Post, 'body'>[]) {
  if (list === last) return
  last = list
  posts = list.map((p) => ({ ...p, body: '' }) as Post)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function loadPosts(_includeDrafts: boolean): Post[] {
  return posts
}
