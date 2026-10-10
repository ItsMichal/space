import { getPost, getTopLevel } from '@/lib/content'
import { OG_CONTENT_TYPE, OG_SIZE, renderPostOg } from '@/lib/og'

export const dynamic = 'force-static'
export const dynamicParams = false
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Project by Michal Bodzianowski'

export function generateStaticParams() {
  return getTopLevel('project').map((p) => ({ slug: p.slug }))
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug)
  if (!post) throw new Error('post not found')
  return renderPostOg(post)
}
