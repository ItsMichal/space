import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { Post } from '@/lib/content/types'
import { tintFor } from '@/lib/tints'
import { Picture } from '@/components/media/Picture'
import { matchesFilter, PROJECT_FILTERS } from '@/components/ui/segments'
import { CardGlow } from './CardGlow'
import './cards.css'

/** Filter buckets a post belongs to, for the /projects segmented control (all items stay in the HTML). */
const buckets = (p: Post) => PROJECT_FILTERS.filter((f) => f.value !== 'all' && matchesFilter(p.tags, f.value)).map((f) => f.value).join(' ')

const year = (p: Post) => p.years ?? p.date.slice(0, 4)

export type CardSize = 'l' | 'm' | 's'

const SIZES: Record<CardSize, string> = {
  l: '(min-width: 900px) 440px, calc(100vw - 56px)',
  m: '(min-width: 900px) 480px, calc(100vw - 56px)',
  s: '300px',
}

/**
 * A project as a card, one real link. The surface is tinted paper with a hairline edge and layered shadow, so it reads as
 * finished with no image at all; the image, when there is one, is an inset, rounded, fixed-ratio plate cropped with
 * `coverFocus`. Large and medium cards carry a plate, small ones are type only.
 */
export function ProjectCard({ post, href, size, priority = false }: { post: Post; href: string; size: CardSize; priority?: boolean }) {
  const tint = tintFor(post.slug)
  const meta = [year(post), post.role].filter(Boolean).join(' · ')
  const src = post.cardImage === 'none' ? undefined : (post.cardImage ?? post.cover)
  const alt = post.cardImage ? (post.cardImageAlt ?? '') : (post.coverAlt ?? '')
  const plate = size !== 's' && src
  return (
    <Link href={href} className={`pcard pcard--${size}${plate ? '' : ' pcard--bare'}`} style={{ '--card-tint': `var(--tint-${tint.name})` } as CSSProperties}>
      <div className="pcard__body">
        <p className="pcard__meta">{meta}</p>
        <h3 className="pcard__title">{post.title}</h3>
        <p className="pcard__desc">{post.description}</p>
        <span className="pcard__cta">
          View project <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden />
        </span>
      </div>
      {plate ? (
        <div className="pcard__plate">
          <Picture src={src!} alt={alt} sizes={SIZES[size]} priority={priority} className="pcard__img" focus={post.cardImage ? undefined : post.coverFocus} />
        </div>
      ) : null}
      <CardGlow />
    </Link>
  )
}

/**
 * Selected work as cards, in the order given (best first, the site's own priority order).
 *  - `bento`: the first four are a bento (large and medium cards, one column on phones); the rest follow as a row of
 *    small cards that scrolls sideways on phones. `limit` caps the total and adds an "All projects" link.
 *  - `grid`: every project in a responsive grid (the /projects index, which filters it).
 */
export function Showcase({
  posts,
  base,
  limit,
  priority = false,
  variant = 'grid',
}: {
  posts: Post[]
  base: string
  limit?: number
  priority?: boolean
  variant?: 'bento' | 'grid'
}) {
  const shown = limit ? posts.slice(0, limit) : posts
  const cell = (p: Post, size: CardSize, i: number, span?: number) => (
    <li key={p.slug} className="reveal" data-buckets={buckets(p)} style={{ ['--i' as string]: i, ...(span ? { ['--span' as string]: span } : {}) }}>
      <ProjectCard post={p} href={`${base}/${p.slug}`} size={size} priority={priority && i === 0} />
    </li>
  )
  if (variant === 'grid') {
    return (
      <div className="work">
        <ul className="work-grid">{shown.map((p, i) => cell(p, p.cover ? 'm' : 's', i))}</ul>
      </div>
    )
  }
  // Bento in two rows of 12 columns. The DOM stays in priority order. In each row the card that has an image takes the
  // wide cell (7) and a type-only card the narrow one (5), so a type-only card never fills the biggest slot; when both or
  // neither have an image the rows alternate (wide first, then wide last).
  const top = shown.slice(0, 4)
  const rest = shown.slice(4)
  const hasPlate = (p: Post) => (p.cardImage === 'none' ? false : Boolean(p.cardImage ?? p.cover))
  const spans: number[] = []
  for (let r = 0; r < top.length; r += 2) {
    const a = top[r]
    const b = top[r + 1]
    if (b && hasPlate(a) !== hasPlate(b)) spans.push(hasPlate(a) ? 7 : 5, hasPlate(b) ? 7 : 5)
    else spans.push(r === 0 ? 7 : 5, r === 0 ? 5 : 7)
  }
  return (
    <div className="work">
      <ul className="work-bento">{top.map((p, i) => cell(p, spans[i] === 7 ? 'l' : 'm', i, spans[i]))}</ul>
      {rest.length > 0 ? (
        <ul className="work-row" aria-label="More projects">
          {rest.map((p, i) => cell(p, 's', i))}
        </ul>
      ) : null}
      {limit && posts.length > shown.length ? (
        <Link href={base} className="work-more link">
          All {posts.length} projects <ArrowRight size={16} strokeWidth={1.5} aria-hidden className="ml-space-2" />
        </Link>
      ) : null}
    </div>
  )
}
