import type { Metadata } from 'next'
import { getPostsByKind } from '@/lib/content'
import { PostList } from '@/components/content/PostList'

export const metadata: Metadata = {
  title: 'Projects by Michal Bodzianowski',
  description: 'A list of projects built by Michal Bodzianowski',
  openGraph: { title: 'Projects', description: 'A list of projects built by Michal Bodzianowski' },
}

export default function Page() {
  return (
    <main>
      <h1>Projects</h1>
      <PostList posts={getPostsByKind('project')} base="/projects" />
    </main>
  )
}
