import Link from 'next/link'
import type { Post } from '@/lib/content/types'

export function PostList({ posts, base }: { posts: Post[]; base: string }) {
  if (posts.length === 0) return <p>Nothing here yet.</p>
  return (
    <ul>
      {posts.map((p) => (
        <li key={p.slug}>
          <Link href={`${base}/${p.slug}`}>{p.title}</Link>
          <p>{p.description}</p>
        </li>
      ))}
    </ul>
  )
}
