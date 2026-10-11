export type PostKind = 'project' | 'article'
export type PostLink = { label: string; href: string }
export type GalleryItem = { src: string; alt: string; caption?: string }
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
  /* CSS object-position for cropped covers, e.g. "50% 30%" */
  coverFocus?: string
  priority?: number
  /* Projects only: shown large at the top of Selected work */
  featured?: boolean
  /* Slug of a parent project. The post then lives at /projects/<parent>/<slug>, is listed on the parent's page
     (not in /writing or the project index) and gets prev/next navigation among its siblings. */
  parent?: string
  /* Heading for the parent's list of children, e.g. "Progress log". Taken from the first child that sets it. */
  series?: string
  /* Position among siblings (ascending); falls back to date. */
  order?: number
  role?: string
  /* Display span for the spec line instead of the date's year, e.g. "2024 – present". */
  years?: string
  /* Short noun phrase (<= 48 chars) for the home hero's rotating "Lately I've built ..." line. Posts that set it join the rotation, ordered by priority then date. */
  hook?: string
  links?: PostLink[]
  gallery?: GalleryItem[]
  draft?: boolean
  canonical?: string
}
export type Post = PostFrontmatter & {
  body: string /* markdown source */
  readingMinutes: number
}
