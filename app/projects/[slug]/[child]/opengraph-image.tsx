import { getAllPosts } from '@/lib/content'
import { OG_CONTENT_TYPE, OG_SIZE, renderPostOg } from '@/lib/og'

export const dynamic = 'force-static'
export const dynamicParams = false
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Project update by Michal Bodzianowski'

export function generateStaticParams() {
  return getAllPosts()
    .filter((p) => p.parent)
    .map((p) => ({ slug: p.parent as string, child: p.slug }))
}

export default async function Image({ params }: { params: Promise<{ slug: string; child: string }> }) {
  const { slug, child } = await params
  const post = getAllPosts().find((p) => p.slug === child && p.parent === slug)
  if (!post) throw new Error('post not found')
  return renderPostOg(post)
}
