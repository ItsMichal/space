import type { Metadata } from 'next'
import { getArticleSeries, getBlogPosts, getProjectLogs } from '@/lib/content'
import { groupWriting } from '@/lib/content/writing'
import { WritingIndex } from '@/components/writing/WritingIndex'
import { JsonLd } from '@/components/seo/JsonLd'
import { listJsonLd, listMetadata } from '@/lib/seo'

const TITLE = 'Writing · Michał Bodzianowski'
const DESCRIPTION = 'Essays and notes on building with AI, the web and systems, by Michał Bodzianowski.'

const base = listMetadata('article', TITLE, DESCRIPTION)
export const metadata: Metadata = {
  ...base,
  alternates: { ...base.alternates, types: { 'application/rss+xml': [{ url: '/feed.xml', title: 'Michał Bodzianowski · RSS' }] } },
}

export default function Page() {
  const posts = getBlogPosts()
  const groups = groupWriting(posts, [...getArticleSeries(), ...getProjectLogs()])
  return (
    <div className="mx-auto max-w-content px-space-4 pb-space-16 pt-[120px] md:px-space-8 md:pt-[160px]">
      <JsonLd data={listJsonLd('article', TITLE, posts)} />
      <h1 className="mb-space-12 font-display text-title">Writing</h1>
      <WritingIndex {...groups} />
    </div>
  )
}
