import type { Metadata } from 'next'
import { getPostsByKind } from '@/lib/content'
import { PostList } from '@/components/content/PostList'

export const metadata: Metadata = {
  title: 'Writing by Michal Bodzianowski',
  description: 'Articles and notes by Michal Bodzianowski',
}

export default function Page() {
  return (
    <main>
      <h1>Writing</h1>
      <PostList posts={getPostsByKind('article')} base="/writing" />
    </main>
  )
}
