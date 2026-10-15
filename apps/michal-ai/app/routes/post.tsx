// One module for the three post URL shapes: /writing/:slug, /projects/:slug and /projects/:slug/:child (see app/routes.ts).
import { useMemo } from 'react'
import { useLoaderData, type LoaderFunctionArgs, type MetaFunction } from 'react-router'
import type { Root } from 'hast'
import { registerImages } from '@/lib/media'
import { PostPage } from '@/components/content/PostPage'
import { hastToReact } from '@/lib/content/to-react'
import type { PostKind } from '@/lib/content/types'

export async function loader({ params }: LoaderFunctionArgs) {
  const { getAllPosts, getChildren, getPost } = await import('@/lib/content')
  const { markdownToHast } = await import('@/lib/content/render')
  const { headFor, imagesFor, shareFor, slim } = await import('@/lib/rr/content.server')
  const { postMetadata, readingViewport } = await import('@/components/content/PostPage')
  const { postJsonLd, postPath } = await import('@/lib/seo')

  const slug = params.child ?? params.slug!
  const parent = params.child ? params.slug : undefined
  const post = getAllPosts().find((p) => p.slug === slug && (p.parent ?? undefined) === parent)
  if (!post) throw new Response('Not found', { status: 404 })
  const parentPost = post.parent ? getPost(post.parent) : undefined
  const hast = await markdownToHast(post.body)
  const metadata = postMetadata(post.kind, post.slug, post.parent)
  const alt = post.parent ? 'Project update by Michał Bodzianowski' : post.kind === 'article' ? 'Article by Michał Bodzianowski' : 'Project by Michał Bodzianowski'
  const related = [post, ...(parentPost ? [parentPost] : []), ...getChildren(post.parent ?? post.slug)]
  return {
    kind: post.kind as PostKind,
    slug: post.slug,
    parent: post.parent ?? null,
    hast,
    jsonLd: postJsonLd(post, parentPost),
    head: headFor(metadata, { viewport: readingViewport, share: shareFor(postPath(post), alt) }),
    images: imagesFor([hast, slim(post), related.map(slim)]),
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => data?.head ?? []

export default function PostRoute() {
  const d = useLoaderData<typeof loader>()
  registerImages(d.images)
  const body = useMemo(() => hastToReact(d.hast as Root), [d.hast])
  return <PostPage kind={d.kind} slug={d.slug} parent={d.parent ?? undefined} body={body} jsonLd={d.jsonLd} />
}
