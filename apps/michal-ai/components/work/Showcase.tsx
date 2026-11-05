import Link from '@/lib/nav'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Post } from '@/lib/content/types'
import { cardPicture } from '@/lib/content/picture'
import { Picture } from '@/components/media/Picture'
import { hasDemo, ProjectDemo } from '@/components/demos/ProjectDemo'
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
   *  separate card block, and no year (the home page). */
  thumb?: boolean
  /** With `thumb`, still show the secondary line under the description (the /projects timeline shows a span of years). */
  dated?: boolean
}) {
  const picture = cardPicture(post)
  const src = picture?.src
  const alt = picture?.alt ?? ''
  // dates only: no eyebrows (role, series, venue) over the title
  const metaParts: ReactNode[] = article ? [<time key="d" dateTime={post.date}>{monthYear(post.date)}</time>] : [year(post)]
  const id = `pc-${post.slug}`
  // A project with a preview (real footage or its own code, see ProjectDemo) plays it in the picture's place; the picture stays as its fallback (prerender, no JS)
  const withDemo = (picture: ReactNode) => (hasDemo(post.slug) ? <ProjectDemo slug={post.slug} label={alt || post.title} fallback={picture} /> : picture)
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
      <p id={`${id}-d`} className="ix__desc t-text">
        {post.description}
      </p>
      {thumb && src && !dated ? null : (
        <p className="ix__meta t-meta">
          <MetaParts parts={metaParts} />
        </p>
      )}
      {thumb && src ? (
        <div className="ix__media ix__thumb">
          {withDemo(
            <Picture
              src={src}
              alt={alt}
              sizes="(min-width: 840px) 240px, calc(100vw - 32px)"
              priority={priority}
              aspect="16 / 10"
              focus={focus ?? picture?.focus}
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
              focus={focus ?? picture?.focus}
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
 * older callers and change nothing. /projects shows the same entries as a timeline (ProjectTimeline, below).
 */
export function Showcase({
  posts,
  base,
  limit,
  priority = false,
  textOnly = false,
  thumbs = false,
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
  /** Every entry's picture inside its row (see ProjectCard `thumb`). */
  thumbs?: boolean
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
              <ProjectCard post={p} href={`${base}/${p.slug}`} feature={feature} priority={priority && (feature || thumbs)} variant={card.variant} focus={card.focus} textOnly={textOnly} thumb={thumbs} />
            </li>
          )
        })}
      </ul>
      {limit && posts.length > shown.length ? (
        <Link href={base} className="ix-more link">
          View {posts.length - shown.length} more {posts.length - shown.length === 1 ? 'project' : 'projects'} <ArrowRight size={16} strokeWidth={1.5} aria-hidden className="ml-space-2" />
        </Link>
      ) : null}
    </div>
  )
}

/** The year a project starts: the first year of its `years` span, else of its date. */
const startYear = (p: Post) => (/\d{4}/.exec(p.years ?? '') ?? [p.date.slice(0, 4)])[0]

/**
 * /projects as a vertical timeline in the Experience list's language (components/site/about.css `.xp--timeline`): a hairline
 * rail on the left, a round node with the year where a new year starts and a small one at each project, and every project
 * with its picture in the row (and its span of years when it has one). Newest first by start year, then date. A year row
 * carries the filter buckets of its projects, so the /projects filter hides a year with nothing left in it.
 */
export function ProjectTimeline({ posts, base, priority = false }: { posts: Post[]; base: string; priority?: boolean }) {
  const sorted = [...posts].sort((a, b) => startYear(b).localeCompare(startYear(a)) || b.date.localeCompare(a.date))
  const years = [...new Set(sorted.map(startYear))].map((y) => [y, sorted.filter((p) => startYear(p) === y)] as const)
  return (
    <div className="work">
      <ol className="tl">
        {years.flatMap(([y, ps]) => [
          <li key={y} className="tl__year" data-buckets={[...new Set(ps.flatMap((p) => buckets(p).split(' ').filter(Boolean)))].join(' ')}>
            <h2 className="tl__node t-meta">{y}</h2>
          </li>,
          ...ps.map((p) => (
            <li key={p.slug} className="tl__item" data-buckets={buckets(p)}>
              <ProjectCard post={p} href={`${base}/${p.slug}`} priority={priority && p === sorted[0]} thumb dated={Boolean(p.years) && p.years !== startYear(p)} />
            </li>
          )),
        ])}
      </ol>
    </div>
  )
}
