import type { Metadata } from 'next'
import { getPostsByKind } from '@/lib/content'
import { ProjectList } from '@/components/site/ProjectList'

export const metadata: Metadata = {
  title: 'Writing by Michal Bodzianowski',
  description: 'Articles and notes by Michal Bodzianowski',
}

export default function Page() {
  return (
    <div className="mx-auto max-w-content px-space-4 pb-space-16 pt-[120px] md:px-space-8 md:pt-[160px]">
      <h1 className="mb-space-12 text-[clamp(36px,11vw,56px)] font-semibold leading-none tracking-[-0.03em] md:text-display">Writing</h1>
      <ProjectList posts={getPostsByKind('article')} base="/writing" />
    </div>
  )
}
