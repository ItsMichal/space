import type { Metadata } from 'next'
import { getPostsByKind } from '@/lib/content'
import { PostList } from '@/components/content/PostList'
import { JsonLd } from '@/components/seo/JsonLd'
import { listJsonLd, listMetadata } from '@/lib/seo'

const TITLE = 'Writing — Michal Bodzianowski'
const DESCRIPTION = 'Articles, dev logs and notes by Michal Bodzianowski.'

export const metadata: Metadata = listMetadata('article', TITLE, DESCRIPTION)

export default function Page() {
  const posts = getPostsByKind('article')
  return (
    <main>
      <JsonLd data={listJsonLd('article', TITLE, posts)} />
      <h1>Writing</h1>
      <PostList posts={posts} base="/writing" />
    </main>
  )
}
