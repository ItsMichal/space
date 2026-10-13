import type { Post } from '@/lib/content/types'
import { ProjectRow } from './ProjectRow'

/** Hairline-separated rows of work or writing. `base` is the route prefix, e.g. "/projects". */
export function ProjectList({ posts, base, empty = 'Nothing here yet.' }: { posts: Post[]; base: string; empty?: string }) {
  if (posts.length === 0) return <p className="text-ink-muted">{empty}</p>
  return (
    <ul className="plist card surface card--list card__rows">
      {posts.map((p) => (
        <li key={p.slug}>
          <ProjectRow
            title={p.title}
            description={p.description}
            year={p.date.slice(0, 4)}
            tags={p.tags}
            href={`${base}/${p.slug}`}
          />
        </li>
      ))}
    </ul>
  )
}
