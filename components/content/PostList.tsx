import Link from 'next/link'
import type { Post } from '@/lib/content/types'

export function PostList({ posts, base }: { posts: Post[]; base: string }) {
  if (posts.length === 0) return <p>Nothing here yet.</p>
  return (
    <ul>
      {posts.map((p) => (
        <li key={p.slug}>
          <article>
            <h2>
              <Link href={`${base}/${p.slug}`}>{p.title}</Link>
            </h2>
            <p>{p.description}</p>
            <p className="meta">
              <time dateTime={p.date}>{p.date}</time>
            </p>
          </article>
        </li>
      ))}
    </ul>
  )
}
