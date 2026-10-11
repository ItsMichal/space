import { getTopLevel } from '@/lib/content'
import { PostPage, postMetadata, readingViewport } from '@/components/content/PostPage'

export const dynamicParams = false

export function generateStaticParams() {
  return getTopLevel('project').map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return postMetadata('project', (await params).slug)
}

export const viewport = readingViewport

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <PostPage kind="project" slug={(await params).slug} />
}
