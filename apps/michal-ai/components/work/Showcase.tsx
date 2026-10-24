import Link from '@/lib/nav'
import { ArrowRight } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import type { Post } from '@/lib/content/types'
import { tintFor } from '@/lib/tints'
import { getPublication } from '@/lib/publications'
import { Picture } from '@/components/media/Picture'
import { cardOf, isFeature, siteLayout, type SiteLayout } from '@/lib/content/layout'
import { matchesFilter, PROJECT_FILTERS } from '@/components/ui/segments'
import './cards.css'

/** Filter buckets a post belongs to, for the /projects segmented control (all items stay in the HTML). */
const buckets = (p: Post) => PROJECT_FILTERS.filter((f) => f.value !== 'all' && matchesFilter(p.tags, f.value)).map((f) => f.value).join(' ')

const year = (p: Post) => p.years ?? p.date.slice(0, 4)

/**
 * A project as a tile, in the manner of apple.com's newsroom: the image sits on top, flush to the card's edges and clipped
 * by its radius; the text block follows (year and role, title, one or two lines). The whole card is one link, named by its
 * title and described by its description. Projects without a usable image get a designed media area in the same slot: the
 * project's name set large on a barely-there palette tint, the way Apple uses a solid tile with a product name.
 */
/** Meta parts joined with a separator; each part stays on one line so a narrow card wraps at the separator. */
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

export type CardVariant = 'newsroom' | 'fill' | 'cap'

export function ProjectCard({
  post,
  href,
  feature = false,
  priority = false,
  variant = 'newsroom',
  glass = false,
  article = false,
  focus,
}: {
  post: Post
  href: string
  feature?: boolean
  priority?: boolean
  /** newsroom: image on top, text below. fill: text above, image fills the rest. cap: full-bleed image with a glass caption over its foot. */
  variant?: CardVariant
  /** Translucent glass surface (home page only: something sits behind it). Otherwise the same card, near-solid. */
  glass?: boolean
  /** A writing post: the date is the tertiary line instead of year and role. */
  article?: boolean
  /** Focal point of the card image ("50% 30%"), from the layout file. Defaults to the cover's `coverFocus`. */
  focus?: string
}) {
  const src = post.cardImage === 'none' ? undefined : (post.cardImage ?? post.cover)
  const alt = post.cardImage ? (post.cardImageAlt ?? '') : (post.coverAlt ?? '')
  const metaParts: ReactNode[] = article
    ? [<time key="d" dateTime={post.date}>{monthYear(post.date)}</time>, ...(post.series ? [post.series] : [])]
    : ([year(post), post.role].filter(Boolean) as string[])
  const id = `pc-${post.slug}`
  const pub = article ? undefined : post.publications?.map(getPublication).find(Boolean)
  return (
    <Link href={href} className={`tile surface surface--link${glass ? ' surface--glass' : ''}${feature ? ' tile--feature' : ''}${variant !== 'newsroom' ? ` tile--${variant}` : ''}`} aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}>
      {src ? (
        <div className="tile__media">
          <Picture
            src={src}
            alt={alt}
            sizes={feature ? '(min-width: 1160px) 1120px, (min-width: 640px) 94vw, 78vw' : '(min-width: 1100px) 380px, (min-width: 640px) 45vw, 78vw'}
            priority={priority}
            className="tile__img"
            focus={focus ?? (post.cardImage ? undefined : post.coverFocus)}
          />
        </div>
      ) : (
        <div className="tile__media tile__media--word" style={{ '--tile-tint': `var(--tint-${tintFor(post.slug).name})` } as CSSProperties}>
          {/* The large name is the card's heading; the text block below does not repeat it. */}
          <h3 id={`${id}-t`} className="tile__word" data-card-title>
            {post.title}
          </h3>
        </div>
      )}
      <div className="tile__body">
        {src ? (
          <h3 id={`${id}-t`} className="tile__title t-heading" data-card-title>
            {post.title}
          </h3>
        ) : null}
        <p id={`${id}-d`} className="tile__desc t-text">
          {post.description}
        </p>
        <div className="tile__foot">
          <p className="tile__meta t-meta">
            <MetaParts parts={metaParts} />
          </p>
          {pub ? <p className="tile__meta tile__pub t-meta">Published at {pub.venueShort}</p> : null}
        </div>
      </div>
    </Link>
  )
}

/**
 * Selected work as tiles, in the order given (the site's priority order, led by the layout file's pins). The first tile is
 * the feature (full width, image beside the text from 840px up) and the rest are equal tiles, unless the layout file sets a
 * card's size; it can also set a card's variant and image focus. `variant="row"` (home): on phones the tiles are one
 * native, swipeable snap row; `variant="grid"` (/projects): one column on phones. Two columns from 640px, three from 1100px.
 */
export function Showcase({
  posts,
  base,
  limit,
  priority = false,
  variant = 'grid',
  glass = false,
  layout = siteLayout,
}: {
  posts: Post[]
  base: string
  limit?: number
  priority?: boolean
  variant?: 'row' | 'grid'
  glass?: boolean
  /** Card presentation (the site's layout file; the editor's Arrange preview passes its draft). */
  layout?: SiteLayout
}) {
  const shown = limit ? posts.slice(0, limit) : posts
  return (
    <div className="work">
      <ul className={`tiles tiles--${variant}`}>
        {shown.map((p, i) => {
          const feature = isFeature(p, i, layout)
          const card = cardOf(p.slug, layout)
          return (
            <li key={p.slug} className={`reveal${feature ? ' tiles__feature' : ''}`} data-buckets={buckets(p)}>
              <ProjectCard post={p} href={`${base}/${p.slug}`} feature={feature} priority={priority && i === 0} glass={glass} variant={feature ? undefined : card.variant} focus={card.focus} />
            </li>
          )
        })}
      </ul>
      {limit && posts.length > shown.length ? (
        <Link href={base} className="work-more link">
          All {posts.length} projects <ArrowRight size={16} strokeWidth={1.5} aria-hidden className="ml-space-2" />
        </Link>
      ) : null}
    </div>
  )
}
