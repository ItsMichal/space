import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { Post } from '@/lib/content/types'
import { postPath } from '@/lib/seo'

/**
 * End of a post in a top-level series (e.g. "Object"): position, a link back to the series list on /writing, and
 * previous/next. Uses the same `postnav` classes as the project log navigation.
 */
export function SeriesNav({ name, id, posts, current }: { name: string; id: string; posts: Post[]; current: string }) {
  const at = posts.findIndex((p) => p.slug === current)
  if (at < 0) return null
  const prev = posts[at - 1]
  const next = posts[at + 1]
  return (
    <nav aria-label={`${name} series`} className="postnav card surface postnav--nav">
      <p className="postnav__pos">
        {name} {at + 1} of {posts.length} ·{' '}
        <Link href={`/writing#${id}`} className="link">
          All {name} posts
        </Link>
      </p>
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
