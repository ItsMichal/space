import Link from 'next/link'
import type { Post } from '@/lib/content/types'
import type { SeriesGroup } from '@/lib/content'
import { Picture } from '@/components/media/Picture'
import { Disclosure } from '@/components/ui/Disclosure'
import { postPath } from '@/lib/seo'
import './writing.css'

const month = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

/** One compact row: optional small thumbnail, title, one-line description, date. */
function Row({ post, thumb = false }: { post: Post; thumb?: boolean }) {
  return (
    <Link href={postPath(post)} className="wrow" data-thumb={thumb && post.cover ? '' : undefined}>
      {thumb && post.cover ? (
        <Picture src={post.cover} alt="" sizes="72px" aspect="1 / 1" focus={post.coverFocus} className="wrow__img" />
      ) : null}
      <span className="wrow__text">
        <span className="wrow__title">{post.title}</span>
        <span className="wrow__desc">{post.description}</span>
      </span>
      <time className="wrow__date" dateTime={post.date}>
        {month(post.date)}
      </time>
    </Link>
  )
}

function Rows({ posts, thumb }: { posts: Post[]; thumb?: boolean }) {
  return (
    <ul className="wlist">
      {posts.map((p) => (
        <li key={p.slug}>
          <Row post={p} thumb={thumb} />
        </li>
      ))}
    </ul>
  )
}

function SeriesBlock({ group }: { group: SeriesGroup }) {
  const first = group.posts[0]
  const last = group.posts[group.posts.length - 1]
  const span = first.date.slice(0, 4) === last.date.slice(0, 4) ? first.date.slice(0, 4) : `${first.date.slice(0, 4)} – ${last.date.slice(0, 4)}`
  const title = group.parent ? group.parent.title : group.name
  return (
    <div id={group.id} className="wseries">
      <Disclosure
        summary={
          <span className="wseries__sum">
            <span className="wseries__name">{title}</span>
            <span className="wseries__meta">
              {group.parent ? `${group.name} · ` : ''}
              {group.posts.length} {group.parent ? 'entries' : 'posts'} · {span}
            </span>
          </span>
        }
      >
        {group.parent ? (
          <p className="wseries__parent">
            <Link href={postPath(group.parent)} className="link">
              {group.parent.title}
            </Link>
          </p>
        ) : null}
        <Rows posts={group.posts} />
      </Disclosure>
    </div>
  )
}

/**
 * The /writing list: featured pieces first (with a thumbnail), then series as collapsed groups with a count,
 * then everything else by year. Sections with nothing in them are not rendered.
 */
export function WritingIndex({ featured, series, years }: { featured: Post[]; series: SeriesGroup[]; years: { year: string; posts: Post[] }[] }) {
  return (
    <div className="writing">
      {featured.length ? (
        <section aria-label="Featured">
          <Rows posts={featured} thumb />
        </section>
      ) : null}
      {series.length ? (
        <section aria-labelledby="w-series">
          <h2 id="w-series" className="writing__h">
            Series
          </h2>
          {series.map((g) => (
            <SeriesBlock key={g.id} group={g} />
          ))}
        </section>
      ) : null}
      {years.map(({ year, posts }) => (
        <section key={year} aria-labelledby={`w-${year}`}>
          <h2 id={`w-${year}`} className="writing__h">
            {year}
          </h2>
          <Rows posts={posts} />
        </section>
      ))}
    </div>
  )
}
