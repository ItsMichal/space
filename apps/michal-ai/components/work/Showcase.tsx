import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { linearSpring } from '@space/motion/linearSpring'
import type { Post } from '@/lib/content/types'
import { tintFor } from '@/lib/tints'
import { Picture } from '@/components/media/Picture'
import { matchesFilter, PROJECT_FILTERS } from '@/components/ui/segments'
import { CardGlow } from './CardGlow'
import './cards.css'

/** Filter buckets a post belongs to, for the /projects segmented control (all items stay in the HTML). */
const buckets = (p: Post) => PROJECT_FILTERS.filter((f) => f.value !== 'all' && matchesFilter(p.tags, f.value)).map((f) => f.value).join(' ')

const year = (p: Post) => p.years ?? p.date.slice(0, 4)

// Hover and press motion: a sampled spring as a CSS linear() easing, so it runs on the compositor and retargets from
// wherever it is when the pointer leaves halfway (transitions are interruptible).
const LIFT = linearSpring({ response: 0.7, damping: 0.78 })
const springVars = { '--lift-e': LIFT.easing, '--lift-d': `${LIFT.duration}ms` } as CSSProperties

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
  const plate = size !== 's' && post.cover
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
          <Picture src={post.cover!} alt={post.coverAlt ?? ''} sizes={SIZES[size]} priority={priority} className="pcard__img" focus={post.coverFocus} />
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
  const cell = (p: Post, size: CardSize, i: number) => (
    <li key={p.slug} className="reveal" data-buckets={buckets(p)} style={{ ['--i' as string]: i }}>
      <ProjectCard post={p} href={`${base}/${p.slug}`} size={size} priority={priority && i === 0} />
    </li>
  )
  if (variant === 'grid') {
    return (
      <div className="work" style={springVars}>
        <ul className="work-grid">{shown.map((p, i) => cell(p, p.cover ? 'm' : 's', i))}</ul>
      </div>
    )
  }
  // Bento: Large, Medium / Medium, Large, so the two bigger cards alternate sides; DOM order stays the priority order.
  const top = shown.slice(0, 4)
  const rest = shown.slice(4)
  const topSizes: CardSize[] = ['l', 'm', 'm', 'l']
  return (
    <div className="work" style={springVars}>
      <ul className="work-bento">{top.map((p, i) => cell(p, topSizes[i], i))}</ul>
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
