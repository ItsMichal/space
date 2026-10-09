import { getPostsByKind } from '@/lib/content'
import { PostPage, postMetadata } from '@/components/content/PostPage'

export const dynamicParams = false

export function generateStaticParams() {
  return getPostsByKind('article').map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return postMetadata('article', (await params).slug)
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <PostPage kind="article" slug={(await params).slug} />
}
