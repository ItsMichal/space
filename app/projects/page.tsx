import type { Metadata } from 'next'
import { getTopLevel } from '@/lib/content'
import { Showcase } from '@/components/work/Showcase'
import { JsonLd } from '@/components/seo/JsonLd'
import { listJsonLd, listMetadata } from '@/lib/seo'
import { FilteredWork } from '@/components/ui/FilteredWork'
import { availableFilters } from '@/components/ui/segments'

const TITLE = 'Projects — Michał Bodzianowski'
const DESCRIPTION =
  'Games, AI tools and web platforms built by Michał Bodzianowski, from Starlink.com to Unity arcade experiments.'

export const metadata: Metadata = listMetadata('project', TITLE, DESCRIPTION)

export default function Page() {
  const posts = getTopLevel('project')
  return (
    <div className="mx-auto max-w-content px-space-4 pb-space-16 pt-[120px] md:px-space-8 md:pt-[160px]">
      <JsonLd data={listJsonLd('project', TITLE, posts)} />
      <h1 className="mb-space-12 text-[clamp(36px,11vw,56px)] font-semibold leading-none tracking-[-0.03em] md:text-display">Selected work</h1>
      <FilteredWork options={availableFilters(posts.map((p) => p.tags)).map((f) => f.value)}>
        <Showcase posts={posts} base="/projects" priority />
      </FilteredWork>
    </div>
  )
}
