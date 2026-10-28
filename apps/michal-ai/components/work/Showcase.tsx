import Link from '@/lib/nav'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Post } from '@/lib/content/types'
import { getPublication } from '@/lib/publications'
import { Picture } from '@/components/media/Picture'
import { getImageInfo } from '@/lib/media'
import { cardOf, isFeature, siteLayout, type SiteLayout } from '@/lib/content/layout'
import { matchesFilter, PROJECT_FILTERS } from '@/components/ui/segments'
import './cards.css'

/** Filter buckets a post belongs to, for the /projects segmented control (all items stay in the HTML). */
const buckets = (p: Post) => PROJECT_FILTERS.filter((f) => f.value !== 'all' && matchesFilter(p.tags, f.value)).map((f) => f.value).join(' ')

const year = (p: Post) => p.years ?? p.date.slice(0, 4)

/** Meta parts joined with a separator; each part stays on one line so a narrow column wraps at the separator. */
function MetaParts({ parts }: { parts: ReactNode[] }) {
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 ? ' · ' : ''}
          <span className="t-meta__part">{p}</span>
        </span>
      ))}
    </>
  )
}

const monthYear = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

/** A small variant of an entry's cover for the home page's halftone field (CoverField.tsx), or undefined. */
export function coverSrc(post: Post): string | undefined {
  const src = post.cardImage === 'none' ? undefined : (post.cardImage ?? post.cover)
  if (!src) return undefined
  const info = getImageInfo(src)
  if (!info) return src
  const v = info.variants.webp.find((x) => x.w >= 400) ?? info.variants.webp[info.variants.webp.length - 1]
  return v?.src ?? src
}

export type CardVariant = 'newsroom' | 'fill' | 'cap'

/**
 * A project (or a featured piece of writing) as one entry of a text index: title, one line of description, then year and
 * role in quiet secondary text; from 840px the year and role sit in a narrow column to the left (`.ix`, cards.css). The
 * whole entry is one link, named by its title and described by its description. A feature entry (the layout file's
 * `size: "feature"`, else the first entry) is the only one with a picture: one image under its text, at the text column's
 * width. `variant` stays in the layout schema for the editor's Arrange screen; every variant renders the same entry (the
 * class is kept as a marker).
 */
export function ProjectCard({
  post,
  href,
  feature = false,
  priority = false,
  variant = 'newsroom',
  article = false,
  focus,
  backdrop = false,
}: {
  post: Post
  href: string
  feature?: boolean
  priority?: boolean
  /** Kept for the layout schema; no longer changes the look. */
  variant?: CardVariant
  /** No longer used (entries have no surface); accepted so older callers still typecheck. */
  glass?: boolean
  /** A writing post: the date is the tertiary line instead of year and role. */
  article?: boolean
  /** Focal point of the feature image ("50% 30%"), from the layout file. Defaults to the cover's `coverFocus`. */
  focus?: string
  /** The cover shows in the home page's halftone field (CoverField) instead of as a picture under the entry. */
  backdrop?: boolean
}) {
  const src = post.cardImage === 'none' ? undefined : (post.cardImage ?? post.cover)
  const alt = post.cardImage ? (post.cardImageAlt ?? '') : (post.coverAlt ?? '')
  const pub = article ? undefined : post.publications?.map(getPublication).find(Boolean)
  const metaParts: ReactNode[] = article
    ? [<time key="d" dateTime={post.date}>{monthYear(post.date)}</time>, ...(post.series ? [post.series] : [])]
    : ([year(post), post.role, pub ? `Published at ${pub.venueShort}` : ''].filter(Boolean) as string[])
  const id = `pc-${post.slug}`
  return (
    <Link
      href={href}
      className={`tile ix${backdrop ? ' ix--bg' : ''}${feature ? ' tile--feature' : ''}${variant !== 'newsroom' ? ` tile--${variant}` : ''}`}
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-d`}
      data-cover={backdrop ? coverSrc(post) : undefined}
    >
      <h3 id={`${id}-t`} className="ix__title tile__title" data-card-title>
        {post.title}
      </h3>
      <p id={`${id}-d`} className="ix__desc t-text">
        {post.description}
      </p>
      <p className="ix__meta t-meta">
        <MetaParts parts={metaParts} />
      </p>
      {feature && src && !backdrop ? (
        <div className="ix__media tile__media">
          <Picture
            src={src}
            alt={alt}
            sizes="(min-width: 840px) 640px, calc(100vw - 32px)"
            priority={priority}
            className="tile__img"
            aspect="16 / 9"
            focus={focus ?? (post.cardImage ? undefined : post.coverFocus)}
          />
        </div>
      ) : null}
    </Link>
  )
}

/**
 * Selected work as a text index, in the order given (the site's priority order, led by the layout file's pins). The first
 * entry is the feature (with its image) unless the layout file sets a card's size. `variant` and `glass` are accepted for
 * older callers and change nothing: the home page and /projects show the same list.
 */
export function Showcase({
  posts,
  base,
  limit,
  priority = false,
  backdrop = false,
  layout = siteLayout,
}: {
  posts: Post[]
  base: string
  limit?: number
  priority?: boolean
  variant?: 'row' | 'grid'
  glass?: boolean
  /** Covers behind the entries' text (see ProjectCard). */
  backdrop?: boolean
  /** Card presentation (the site's layout file; the editor's Arrange preview passes its draft). */
  layout?: SiteLayout
}) {
  const shown = limit ? posts.slice(0, limit) : posts
  return (
    <div className="work">
      <ul className="tiles ix-list">
        {shown.map((p, i) => {
          const feature = isFeature(p, i, layout)
          const card = cardOf(p.slug, layout)
          return (
            <li key={p.slug} className={feature ? 'tiles__feature' : undefined} data-buckets={buckets(p)}>
              <ProjectCard post={p} href={`${base}/${p.slug}`} feature={feature} priority={priority && feature} variant={card.variant} focus={card.focus} backdrop={backdrop} />
            </li>
          )
        })}
      </ul>
      {limit && posts.length > shown.length ? (
        <Link href={base} className="ix-more link">
          View all {posts.length} projects <ArrowRight size={16} strokeWidth={1.5} aria-hidden className="ml-space-2" />
        </Link>
      ) : null}
    </div>
  )
}
