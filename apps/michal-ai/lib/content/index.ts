// Content queries. The data comes from ./source: it reads content/posts at build time on the server; the browser build swaps in
// ./source.client (a registry the root loader fills, see vite.config.ts), so the same query code runs in both places.
import { loadPosts } from './source'
export { registerPosts } from './source'
import type { Post, PostKind } from './types'
import { homeWork, indexWork } from './layout'

export * from './types'

export function getAllPosts({ includeDrafts = false }: { includeDrafts?: boolean } = {}): Post[] {
  return loadPosts(includeDrafts)
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

/**
 * Top-level projects without the `minor` flag, in the layout file's order and without the ones it keeps off the home page:
 * what the home page ("Selected work") and the menu previews show. The sitemap, feeds and static params use
 * getTopLevel('project'), which lists minor projects last; /projects uses getProjectIndex.
 */
export const getMainProjects = (opts: { includeDrafts?: boolean } = {}) => homeWork(getTopLevel('project', opts).filter((p) => !p.minor))

/** Every top-level project for /projects: the layout file's order first, minor projects still last among the rest. */
export const getProjectIndex = (opts: { includeDrafts?: boolean } = {}) => indexWork(getTopLevel('project', opts))

/** The owner's own blog: articles without a parent project. */
export const getBlogPosts = () => getTopLevel('article')

/** Children of a project in reading order (`order`, then date). */
export function getChildren(parentSlug: string, opts: { includeDrafts?: boolean } = {}): Post[] {
  return getAllPosts(opts)
    .filter((p) => p.parent === parentSlug)
    .sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.date.localeCompare(b.date))
}

export type SeriesGroup = {
  /** The series' own name, e.g. "Object" or "Progress log". */
  name: string
  /** Anchor id on /writing, so a post can link back to its series. */
  id: string
  /** Set when the series is a project's progress log (the entries are that project's children). */
  parent?: Post
  posts: Post[]
}

export const seriesId = (name: string, parent?: string) =>
  `series-${[parent, name].filter(Boolean).join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`

const byOrder = (a: Post, b: Post) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.date.localeCompare(b.date)

/** Series of top-level articles: posts without a `parent` that share a `series`, in reading order. Needs 2+ posts. */
export function getArticleSeries(opts: { includeDrafts?: boolean } = {}): SeriesGroup[] {
  const map = new Map<string, Post[]>()
  for (const p of getTopLevel('article', opts)) if (p.series) map.set(p.series, [...(map.get(p.series) ?? []), p])
  return [...map]
    .filter(([, posts]) => posts.length > 1)
    .map(([name, posts]) => ({ name, id: seriesId(name), posts: posts.sort(byOrder) }))
}

/** Progress logs: article children of a project, grouped by their parent project. */
export function getProjectLogs(opts: { includeDrafts?: boolean } = {}): SeriesGroup[] {
  return getTopLevel('project', opts).flatMap((parent) => {
    const posts = getChildren(parent.slug, opts).filter((c) => c.kind === 'article')
    if (!posts.length) return []
    const name = posts.find((c) => c.series)?.series ?? 'Progress log'
    return [{ name, id: seriesId(name, parent.slug), parent, posts }]
  })
}

/** The series a top-level article belongs to, if any. */
export const getSeriesOf = (post: Post): SeriesGroup | undefined =>
  post.parent || !post.series ? undefined : getArticleSeries().find((g) => g.name === post.series)
