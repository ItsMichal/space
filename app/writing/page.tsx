import type { Metadata } from 'next'
import { getPostsByKind } from '@/lib/content'
import { ProjectList } from '@/components/site/ProjectList'
import { JsonLd } from '@/components/seo/JsonLd'
import { listJsonLd, listMetadata } from '@/lib/seo'

const TITLE = 'Writing — Michal Bodzianowski'
const DESCRIPTION = 'Articles, dev logs and notes by Michal Bodzianowski.'

export const metadata: Metadata = listMetadata('article', TITLE, DESCRIPTION)

export default function Page() {
  const posts = getPostsByKind('article')
  return (
    <div className="mx-auto max-w-content px-space-4 pb-space-16 pt-[120px] md:px-space-8 md:pt-[160px]">
      <JsonLd data={listJsonLd('article', TITLE, posts)} />
      <h1 className="mb-space-12 text-[clamp(36px,11vw,56px)] font-semibold leading-none tracking-[-0.03em] md:text-display">Writing</h1>
      <ProjectList posts={posts} base="/writing" />
    </div>
  )
}
