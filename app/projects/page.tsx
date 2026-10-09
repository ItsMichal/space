import type { Metadata } from 'next'
import { getPostsByKind } from '@/lib/content'
import { PostList } from '@/components/content/PostList'
import { JsonLd } from '@/components/seo/JsonLd'
import { listJsonLd, listMetadata } from '@/lib/seo'

const TITLE = 'Projects — Michal Bodzianowski'
const DESCRIPTION =
  'Games, AI tools and web platforms built by Michal Bodzianowski, from Starlink.com to Unity arcade experiments.'

export const metadata: Metadata = listMetadata('project', TITLE, DESCRIPTION)

export default function Page() {
  const posts = getPostsByKind('project')
  return (
    <main>
      <JsonLd data={listJsonLd('project', TITLE, posts)} />
      <h1>Projects</h1>
      <PostList posts={posts} base="/projects" />
    </main>
  )
}
