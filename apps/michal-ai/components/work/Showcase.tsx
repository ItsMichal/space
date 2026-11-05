import Link from '@/lib/nav'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Post } from '@/lib/content/types'
import { Picture } from '@/components/media/Picture'
import { hasDemo, ProjectDemo } from '@/components/demos/ProjectDemo'
import { cardOf, isFeature, siteLayout, type SiteLayout } from '@/lib/content/layout'
import { matchesFilter, PROJECT_FILTERS } from '@/components/ui/segments'
import { postPath } from '@/lib/seo'
import { monthYear } from '@/lib/dates'
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
  textOnly = false,
  thumb = false,
  dated = false,
  sizes = '(min-width: 840px) 240px, calc(100vw - 32px)',
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
  /** No picture, even on the feature entry. */
  textOnly?: boolean
  /** Every entry shows its picture as part of the row (left of the text from 840px, above the title on phones), not as a
   *  separate card block, and no year unless `dated`. */
  thumb?: boolean
  /** With `thumb`, still show the year (or the date) under the description. */
  dated?: boolean
  /** The `thumb` picture's `sizes` (a grid column is wider than the row's thumb column). */
  sizes?: string
}) {
  const src = post.cardImage === 'none' ? undefined : (post.cardImage ?? post.cover)
  const alt = post.cardImage ? (post.cardImageAlt ?? '') : (post.coverAlt ?? '')
  // dates only: no eyebrows (role, series, venue) over the title
  const metaParts: ReactNode[] = article ? [<time key="d" dateTime={post.date}>{monthYear(post.date)}</time>] : [year(post)]
  const id = `pc-${post.slug}`
  // A project with a preview (real footage or its own code, see ProjectDemo) plays it in the picture's place; the picture stays as its fallback (prerender, no JS)
  const withDemo = (picture: ReactNode) => (hasDemo(post.slug) ? <ProjectDemo slug={post.slug} label={alt || post.title} fallback={picture} captions /> : picture)
  return (
    <Link
      href={href}
      className={`tile ix${thumb && src ? ' ix--thumb' : ''}${feature ? ' tile--feature' : ''}${variant !== 'newsroom' ? ` tile--${variant}` : ''}`}
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-d`}
    >
      <h3 id={`${id}-t`} className="ix__title tile__title" data-card-title>
        {post.title}
      </h3>
      <p id={`${id}-d`} className="ix__desc">
        {post.description}
      </p>
      {thumb && src && !dated ? null : (
        <p className="ix__meta">
          <MetaParts parts={metaParts} />
        </p>
      )}
      {thumb && src ? (
        <div className="ix__media ix__thumb">
          {withDemo(
            <Picture
              src={src}
              alt={alt}
              sizes={sizes}
              priority={priority}
              aspect="16 / 10"
              focus={focus ?? (post.cardImage ? undefined : post.coverFocus)}
            />,
          )}
        </div>
      ) : feature && src && !textOnly ? (
        <div className="ix__media tile__media">
          {withDemo(
            <Picture
              src={src}
              alt={alt}
              sizes="(min-width: 840px) 640px, calc(100vw - 32px)"
              priority={priority}
              className="tile__img"
              aspect={hasDemo(post.slug) ? '16 / 10' : '16 / 9'}
              focus={focus ?? (post.cardImage ? undefined : post.coverFocus)}
            />,
          )}
        </div>
      ) : null}
    </Link>
  )
}

/**
 * Projects (home) as a text index, in the order given (the site's priority order, led by the layout file's pins). The first
 * entry is the feature (with its image) unless the layout file sets a card's size. `variant` and `glass` are accepted for
 * older callers and change nothing: the home page and /projects show the same list.
 */
export function Showcase({
  posts,
  base,
  limit,
  priority = false,
  textOnly = false,
  layout = siteLayout,
}: {
  posts: Post[]
  base: string
  limit?: number
  priority?: boolean
  variant?: 'row' | 'grid'
  glass?: boolean
  /** No pictures, even on the feature entry (see ProjectCard). */
  textOnly?: boolean
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
              <ProjectCard post={p} href={`${base}/${p.slug}`} feature={feature} priority={priority && feature} variant={card.variant} focus={card.focus} textOnly={textOnly} />
            </li>
          )
        })}
      </ul>
      {limit && posts.length > shown.length ? <MoreLink href={base}>{viewMore(posts.length - shown.length, 'project')}</MoreLink> : null}
    </div>
  )
}

/** The link under a shortened list to the whole of it ("View 4 more projects", "All projects"). */
export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="ix-more link">
      {children} <ArrowRight size={16} strokeWidth={1.5} aria-hidden className="ml-space-2" />
    </Link>
  )
}

const viewMore = (count: number, noun: string) => `View ${count} more ${count === 1 ? noun : `${noun}s`}`

/**
 * The home page's Projects and Writing: the first `limit` posts as the same entry (ProjectCard with its picture above the
 * text, and a project's year under the description; a post shows no date), two across from 640px (`.ix-grid`,
 * app/styles/type.css), then a link to the full list, counting what it holds beyond these (`total`, every post by default).
 */
export function CardGrid({ posts, total = posts.length, limit = 4, more, noun, priority = false }: { posts: Post[]; total?: number; limit?: number; more: string; noun: string; priority?: boolean }) {
  const shown = posts.slice(0, limit)
  return (
    <>
      <ul className="ix-list ix-grid">
        {shown.map((p) => (
          <li key={p.slug}>
            <ProjectCard post={p} href={postPath(p)} priority={priority} article={p.kind === 'article'} thumb dated={p.kind !== 'article'} sizes="(min-width: 1120px) 512px, (min-width: 640px) 50vw, calc(100vw - 32px)" />
          </li>
        ))}
      </ul>
      {total > shown.length ? <MoreLink href={more}>{viewMore(total - shown.length, noun)}</MoreLink> : null}
    </>
  )
}
