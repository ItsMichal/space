import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPost } from '@/lib/content'
import { renderMarkdown } from '@/lib/content/render'
import type { PostKind } from '@/lib/content/types'

const SITE = 'https://michal.us'
const BASE: Record<PostKind, string> = { project: '/projects', article: '/writing' }

export function postMetadata(kind: PostKind, slug: string): Metadata {
  const post = getPost(slug)
  if (!post || post.kind !== kind) return {}
  const url = `${SITE}${BASE[kind]}/${post.slug}`
  const image = post.cover ? `${SITE}${post.cover}` : `${SITE}/michal.png`
  return {
    title: `${post.title} by Michal`,
    description: post.description,
    alternates: { canonical: post.canonical ?? url },
    openGraph: { title: post.title, description: post.description, url, images: [{ url: image }] },
    twitter: { card: 'summary_large_image', images: [image] },
  }
}

export async function PostPage({ kind, slug }: { kind: PostKind; slug: string }) {
  const post = getPost(slug)
  if (!post || post.kind !== kind) notFound()
  const body = await renderMarkdown(post.body)
  return (
    <article>
      <h1>{post.title}</h1>
      <p>
        <time dateTime={post.date}>{post.date}</time> · {post.readingMinutes} min read
      </p>
      {body}
    </article>
  )
}
