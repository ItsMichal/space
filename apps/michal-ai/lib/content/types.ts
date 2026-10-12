export type PostKind = 'project' | 'article'
export type PostLink = { label: string; href: string }
export type GalleryItem = { src: string; alt: string; caption?: string }
export type PostFrontmatter = {
  title: string
  slug: string
  /* Stable id for per-post state (views, reactions). Never changes, even when the slug is renamed. Falls back to the slug. */
  id?: string
  kind: PostKind
  description: string
  date: string /* ISO yyyy-mm-dd */
  updated?: string
  tags: string[]
  cover?: string /* path under /media/... */
  coverAlt?: string
  /* CSS object-position for cropped covers, e.g. "50% 30%" */
  coverFocus?: string
  /* Image for the project card on the home page and /projects: a path under /media/..., or "none" for the type-only card. Defaults to `cover`. */
  cardImage?: string
  cardImageAlt?: string
  priority?: number
  /* Projects: shown large at the top of Selected work. Articles: listed first on /writing. */
  featured?: boolean
  /* Slug of a parent project. The post then lives at /projects/<parent>/<slug>, is listed on the parent's page
     (not in /writing or the project index) and gets prev/next navigation among its siblings. */
  parent?: string
  /* Heading for the parent's list of children, e.g. "Progress log". Taken from the first child that sets it.
     Top-level articles that share a `series` (no `parent`) form a series on their own: grouped on /writing and
     linked with previous/next at the end of each post. */
  series?: string
  /* Position among siblings (ascending); falls back to date. */
  order?: number
  role?: string
  /* Display span for the spec line instead of the date's year, e.g. "2024 to now". */
  years?: string
  /* Short noun phrase (<= 48 chars) for the home hero's rotating "Lately I've built ..." line. Posts that set it join the rotation, ordered by priority then date. */
  hook?: string
  links?: PostLink[]
  gallery?: GalleryItem[]
  draft?: boolean
  canonical?: string
  /* Where the post first appeared elsewhere (e.g. a Medium article). Shown as a quiet "Originally published on ..."
     link at the end of the post and emitted as `sameAs` in the JSON-LD. The page still canonicalises to itself. */
  originalUrl?: string
  /* Ids of entries in profile.publications that this project is the home of; shown as a Publication block with the citation. */
  publications?: string[]
}
export type Post = PostFrontmatter & {
  body: string /* markdown source */
  readingMinutes: number
}
