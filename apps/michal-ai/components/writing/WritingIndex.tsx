import Link from '@/lib/nav'
import type { Post } from '@/lib/content/types'
import type { SeriesGroup } from '@/lib/content'
import { ProjectCard } from '@/components/work/Showcase'
import { Disclosure } from '@/components/ui/Disclosure'
import { IndexEntry } from '@/components/ui/IndexEntry'
import { IndexSection } from '@/components/ui/IndexSection'
import { postPath } from '@/lib/seo'
import { monthYear } from '@/lib/dates'
import './writing.css'

/** Posts as index entries (the home page shows the newest as cards instead: CardGrid, components/work/Showcase.tsx). */
export function WritingRows({ posts, className = '' }: { posts: Post[]; className?: string }) {
  return (
    <ul className={`ix-list ${className}`}>
      {posts.map((p) => (
        <li key={p.slug}>
          <IndexEntry href={postPath(p)} title={p.title} desc={p.description} meta={monthYear(p.date)} dateTime={p.date} ui />
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
        <IndexSection id="featured" title="Featured">
          <ul className="ix-list">
            {featured.map((p) => (
              <li key={p.slug}>
                <ProjectCard post={p} href={postPath(p)} article />
              </li>
            ))}
          </ul>
        </IndexSection>
      ) : null}
      {series.length ? (
        <IndexSection id="series" title="Series">
          <div className="writing__stack">
            {series.map((g) => (
              <SeriesBlock key={g.id} group={g} />
            ))}
          </div>
        </IndexSection>
      ) : null}
      {years.map(({ year, posts }) => (
        <IndexSection key={year} id={`year-${year}`} title={year}>
          <WritingRows posts={posts} />
        </IndexSection>
      ))}
    </div>
  )
}
