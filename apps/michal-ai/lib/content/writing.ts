// Pure grouping for the /writing index (no fs access): featured, then series, then everything else by year.
import type { Post } from './types'

export type SeriesLike = { name: string; id: string; parent?: Post; posts: Post[] }
export type WritingGroups = {
  featured: Post[]
  series: SeriesLike[]
  years: { year: string; posts: Post[] }[]
}

const newest = (a: Post, b: Post) => b.date.localeCompare(a.date)

/**
 * `blog` is the top-level articles; `series` the article series and project logs. Featured posts are listed first
 * (by priority, then newest). Posts that belong to a series appear in that series' group, not again under their year.
 */
export function groupWriting(blog: Post[], series: SeriesLike[]): WritingGroups {
  const inSeries = new Set(series.flatMap((g) => g.posts.map((p) => p.slug)))
  const featured = blog.filter((p) => p.featured).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || newest(a, b))
  const shown = new Set(featured.map((p) => p.slug))
  const rest = blog.filter((p) => !shown.has(p.slug) && !inSeries.has(p.slug)).sort(newest)
  const years = [...new Set(rest.map((p) => p.date.slice(0, 4)))].sort().reverse().map((year) => ({ year, posts: rest.filter((p) => p.date.startsWith(year)) }))
  const last = (g: SeriesLike) => g.posts.map((p) => p.date).sort().pop() ?? ''
  return { featured, series: [...series].sort((a, b) => last(b).localeCompare(last(a))), years }
}
