import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPost } from '@/lib/content'
import { renderMarkdown } from '@/lib/content/render'
import { ArticleLayout } from '@/components/site/ArticleLayout'
import type { PostKind } from '@/lib/content/types'
import { JsonLd } from '@/components/seo/JsonLd'
import { postJsonLd, postMetadata as buildPostMetadata } from '@/lib/seo'

export function postMetadata(kind: PostKind, slug: string): Metadata {
  const post = getPost(slug)
  if (!post || post.kind !== kind) return {}
  return buildPostMetadata(post)
}

export async function PostPage({ kind, slug }: { kind: PostKind; slug: string }) {
  const post = getPost(slug)
  if (!post || post.kind !== kind) notFound()
  const body = await renderMarkdown(post.body)
  return (
    <>
      <JsonLd data={postJsonLd(post)} />
      <ArticleLayout
        title={post.title}
        description={post.description}
        date={post.date}
        updated={post.updated}
        tags={post.tags}
        readingMinutes={post.readingMinutes}
        cover={post.cover}
        coverAlt={post.coverAlt}
        kind={kind}
      >
        {body}
      </ArticleLayout>
    </>
  )
}
