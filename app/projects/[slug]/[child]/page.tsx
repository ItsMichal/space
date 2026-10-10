import { getAllPosts } from '@/lib/content'
import { PostPage, postMetadata } from '@/components/content/PostPage'

export const dynamicParams = false

// Children (progress logs, pieces of a larger project) live under their parent: /projects/<parent>/<slug>.
export function generateStaticParams() {
  return getAllPosts()
    .filter((p) => p.parent)
    .map((p) => ({ slug: p.parent as string, child: p.slug }))
}

type Params = Promise<{ slug: string; child: string }>

async function kindOf(params: Params) {
  const { slug, child } = await params
  const post = getAllPosts().find((p) => p.slug === child && p.parent === slug)
  return { slug, child, kind: post?.kind ?? 'article' }
}

export async function generateMetadata({ params }: { params: Params }) {
  const { slug, child, kind } = await kindOf(params)
  return postMetadata(kind, child, slug)
}

export default async function Page({ params }: { params: Params }) {
  const { slug, child, kind } = await kindOf(params)
  return <PostPage kind={kind} slug={child} parent={slug} />
}
