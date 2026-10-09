export type PostKind = 'project' | 'article'
export type PostFrontmatter = {
  title: string
  slug: string
  kind: PostKind
  description: string
  date: string /* ISO yyyy-mm-dd */
  updated?: string
  tags: string[]
  cover?: string /* path under /media/... */
  coverAlt?: string
  priority?: number
  draft?: boolean
  canonical?: string
}
export type Post = PostFrontmatter & {
  body: string /* markdown source */
  readingMinutes: number
}
