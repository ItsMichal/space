import Link from '@/lib/nav'
import type { Post } from '@/lib/content/types'
import type { SeriesGroup } from '@/lib/content'
import { Backdrop, ProjectCard } from '@/components/work/Showcase'
import { Disclosure } from '@/components/ui/Disclosure'
import { postPath } from '@/lib/seo'
import './writing.css'

const month = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

/** One post as an index entry: title, one-line description, date. */
function Row({ post, backdrop = false }: { post: Post; backdrop?: boolean }) {
  return (
    <Link href={postPath(post)} className={`wrt ix ix--ui${backdrop ? ' ix--bg' : ''}`}>
      {backdrop ? <Backdrop post={post} /> : null}
      <span className="ix__title wrt__title">{post.title}</span>
      <span className="ix__desc wrt__desc">{post.description}</span>
      <time className="ix__meta" dateTime={post.date}>
        {month(post.date)}
      </time>
    </Link>
  )
}

/** Posts as index entries (the home page's Writing section uses the same rows, with `backdrop`). */
export function WritingRows({ posts, className = '', backdrop = false }: { posts: Post[]; className?: string; backdrop?: boolean }) {
  return (
    <ul className={`ix-list wlist ${className}`}>
      {posts.map((p) => (
        <li key={p.slug}>
          <Row post={p} backdrop={backdrop} />
        </li>
      ))}
    </ul>
  )
}

function SeriesBlock({ group }: { group: SeriesGroup }) {
  const first = group.posts[0]
  const last = group.posts[group.posts.length - 1]
  const span = first.date.slice(0, 4) === last.date.slice(0, 4) ? first.date.slice(0, 4) : `${first.date.slice(0, 4)} to ${last.date.slice(0, 4)}`
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
        <WritingRows posts={group.posts} className="ix-list--tight" />
      </Disclosure>
    </div>
  )
}

/**
 * The /writing index, set like a book's contents: featured pieces first, then series as collapsed groups with a count, then
 * everything else by year. Each section's name sits in the left column from 840px. Sections with nothing in them are not
 * rendered.
 */
export function WritingIndex({ featured, series, years }: { featured: Post[]; series: SeriesGroup[]; years: { year: string; posts: Post[] }[] }) {
  return (
    <div className="writing">
      {featured.length ? (
        <section aria-labelledby="w-featured" className="ix-sec">
          <h2 id="w-featured" className="t-heading">
            Featured
          </h2>
          <ul className="ix-list ix-sec__body">
            {featured.map((p) => (
              <li key={p.slug}>
                <ProjectCard post={p} href={postPath(p)} article />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {series.length ? (
        <section aria-labelledby="w-series" className="ix-sec">
          <h2 id="w-series" className="t-heading">
            Series
          </h2>
          <div className="writing__stack ix-sec__body">
            {series.map((g) => (
              <SeriesBlock key={g.id} group={g} />
            ))}
          </div>
        </section>
      ) : null}
      {years.map(({ year, posts }) => (
        <section key={year} aria-labelledby={`w-${year}`} className="ix-sec">
          <h2 id={`w-${year}`} className="t-heading">
            {year}
          </h2>
          <WritingRows posts={posts} className="ix-sec__body" />
        </section>
      ))}
    </div>
  )
}
