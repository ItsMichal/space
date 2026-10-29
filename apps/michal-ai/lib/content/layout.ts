// Card order and presentation from the layout file (content/layout.json, written by the editor's Arrange screen; schema and
// checks in ./rules.mjs). The file is bundled as text and parsed with the content rules, so the site and the editor's preview
// read it the same way; a bad file fails the build (prebuild validates it first, with the posts it points at).
import raw from '../../content/layout.json?raw'
import { parseLayout, type CardLayout, type SiteLayout } from './rules.mjs'
import type { Post } from './types'

export type { CardLayout, SiteLayout }

function load(text: string): SiteLayout {
  const r = parseLayout(text)
  if (r.problem !== undefined) throw new Error(`content/layout.json: ${r.problem}`)
  return r.layout
}

export const siteLayout: SiteLayout = load(raw)

/** `items` with the slugs in `pins` first, in pin order; everything else after them in its original order. */
export function pinned<T extends { slug: string }>(items: T[], pins: readonly string[] = []): T[] {
  const rank = new Map(pins.map((s, i) => [s, i]))
  const head = items.filter((p) => rank.has(p.slug)).sort((a, b) => rank.get(a.slug)! - rank.get(b.slug)!)
  return [...head, ...items.filter((p) => !rank.has(p.slug))]
}

export const cardOf = (slug: string, layout: SiteLayout = siteLayout): CardLayout => layout.cards?.[slug] ?? {}

type Ranked = { slug: string; featured?: boolean; date?: string }

/** Featured entries first, keeping the incoming order within each group (stable sort). */
const featuredFirst = <T extends Ranked>(items: T[]): T[] => [...items].sort((a, b) => Number(!!b.featured) - Number(!!a.featured))

/** Projects for Projects on the home page: the work pins first, then featured projects, then the site's order, without
 * the ones set to stay off the home page. */
export const homeWork = <T extends Ranked>(projects: T[], layout: SiteLayout = siteLayout): T[] =>
  pinned(featuredFirst(projects), layout.work).filter((p) => cardOf(p.slug, layout).home !== false)

/** Projects for /projects: the work pins first (every project stays listed). */
export const indexWork = <T extends { slug: string }>(projects: T[], layout: SiteLayout = siteLayout): T[] => pinned(projects, layout.work)

/** Writing on the home page: the writing pins first, then featured posts, then the newest. */
export const homeWriting = <T extends Ranked>(articles: T[], layout: SiteLayout = siteLayout): T[] =>
  pinned(
    featuredFirst([...articles].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))),
    layout.writing,
  )

export const heroHooks = <T extends { slug: string }>(posts: T[], layout: SiteLayout = siteLayout): T[] => pinned(posts, layout.hooks)

/** Whether a card in a list is the wide feature tile: its own `size`, else only the first card. */
export const isFeature = (post: Pick<Post, 'slug'>, index: number, layout: SiteLayout = siteLayout): boolean => {
  const size = cardOf(post.slug, layout).size
  return size ? size === 'feature' : index === 0
}
