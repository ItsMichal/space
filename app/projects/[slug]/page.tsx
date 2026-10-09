import { getPostsByKind } from '@/lib/content'
import { PostPage, postMetadata } from '@/components/content/PostPage'

export const dynamicParams = false

export function generateStaticParams() {
  return getPostsByKind('project').map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return postMetadata('project', (await params).slug)
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <PostPage kind="project" slug={(await params).slug} />
}
