import Link from '@/lib/nav'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { Post } from '@/lib/content/types'
import { postPath } from '@/lib/seo'
import { Timeline, type TimelineItem } from '@/components/ui/Timeline'

type Props = {
  parent?: Post
  items: Post[]
  prev?: Post
  next?: Post
  position?: { n: number; of: number }
}

/**
 * Below a project: the list of its children (progress log, selected pieces) in reading order.
 * Below a child: prev/next among siblings and a link back to the parent. Rows, not cards.
 */
export function PostNav({ parent, items, prev, next, position }: Props) {
  if (!parent && !items.length) return null
  if (!parent) {
    const heading = items.find((c) => c.series)?.series ?? 'More from this project'
    return (
      <section aria-labelledby="children-h" className="postnav card surface reading__wide">
        <h2 id="children-h" className="postnav__h">
          {heading}
        </h2>
        {items.length >= 3 ? (
          <Timeline
            label={heading}
            statusLabel={heading}
            initial={0}
            items={items.map<TimelineItem>((c) => ({
              id: c.slug,
              date: c.date,
              title: c.title,
              summary: c.description,
              image: c.cover ? { src: c.cover, alt: c.coverAlt ?? '' } : undefined,
              link: { href: postPath(c), label: 'Read this entry' },
            }))}
          />
        ) : (
          <ol className="postnav__list">
          {items.map((c, i) => (
            <li key={c.slug}>
              <Link href={postPath(c)} className="postnav__row">
                <span className="postnav__n">{String(i + 1).padStart(2, '0')}</span>
                <span className="postnav__t">{c.title}</span>
                <span className="postnav__d">{c.date.slice(0, 4)}</span>
              </Link>
            </li>
          ))}
          </ol>
        )}
      </section>
    )
  }
  return (
    <nav aria-label={`${parent.title} ${position ? 'entries' : 'navigation'}`} className="postnav card surface reading__wide postnav--nav">
      {position ? (
        <p className="postnav__pos">
          Entry {position.n} of {position.of} · <Link href={`/projects/${parent.slug}`} className="link">Back to {parent.title}</Link>
        </p>
      ) : (
        <Link href={`/projects/${parent.slug}`} className="link">Back to {parent.title}</Link>
      )}
      <div className="postnav__pair">
        {prev ? (
          <Link href={postPath(prev)} rel="prev" className="postnav__step">
            <span className="postnav__dir">
              <ArrowLeft size={16} strokeWidth={1.5} aria-hidden /> Previous
            </span>
            <span className="postnav__st">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={postPath(next)} rel="next" className="postnav__step postnav__step--next">
            <span className="postnav__dir">
              Next <ArrowRight size={16} strokeWidth={1.5} aria-hidden />
            </span>
            <span className="postnav__st">{next.title}</span>
          </Link>
        ) : (
          <span />
        )}
      </div>
    </nav>
  )
}
