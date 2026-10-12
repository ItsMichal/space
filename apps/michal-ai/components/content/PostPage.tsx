import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { getChildren, getPost, getSeriesOf } from '@/lib/content'
import { OriginalLink } from '@/components/content/OriginalLink'
import { SeriesNav } from '@/components/content/SeriesNav'
import { renderMarkdown } from '@/lib/content/render'
import { ArticleLayout } from '@/components/site/ArticleLayout'
import { PostNav } from '@/components/content/PostNav'
import type { PostKind } from '@/lib/content/types'
import { ReadingTheme } from '@/components/site/ReadingTheme'
import { JsonLd } from '@/components/seo/JsonLd'
import { PostExtras } from '@/components/content/PostExtras'
import { LIVE_REACTIONS_ENABLED } from '@/lib/presence/flag'
import { LiveReactions } from '@/components/presence/LiveReactions'
import { postJsonLd, postMetadata as buildPostMetadata } from '@/lib/seo'

/** Reading pages follow the OS light/dark setting (everything else is Birch only). */
export const readingViewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f1e8' },
    { media: '(prefers-color-scheme: dark)', color: '#121612' },
  ],
}

/** Resolve a post and make sure it is being served at its canonical place (right kind, right parent). */
function resolve(kind: PostKind, slug: string, parent?: string) {
  const post = getPost(slug)
  if (!post || post.kind !== kind || (post.parent ?? undefined) !== parent) return undefined
  return post
}

export function postMetadata(kind: PostKind, slug: string, parent?: string): Metadata {
  const post = resolve(kind, slug, parent)
  if (!post) return {}
  const meta = buildPostMetadata(post)
  // Projects with a progress log / sub-pieces advertise their own feed.
  if (!post.parent && getChildren(post.slug).length) {
    meta.alternates = {
      ...meta.alternates,
      types: { 'application/rss+xml': [{ url: `/projects/${post.slug}/feed.xml`, title: `${post.title} — updates` }] },
    }
  }
  return meta
}

export async function PostPage({ kind, slug, parent }: { kind: PostKind; slug: string; parent?: string }) {
  const post = resolve(kind, slug, parent)
  if (!post) notFound()
  const parentPost = post.parent ? getPost(post.parent) : undefined
  if (post.parent && !parentPost) notFound()
  const body = await renderMarkdown(post.body)
  const children = post.parent ? [] : getChildren(post.slug)
  const siblings = post.parent ? getChildren(post.parent) : []
  const at = siblings.findIndex((s) => s.slug === post.slug)
  const series = getSeriesOf(post)
  return (
    <>
      <ReadingTheme />
      <JsonLd data={postJsonLd(post, parentPost)} />
      <ArticleLayout
        title={post.title}
        description={post.description}
        date={post.date}
        updated={post.updated}
        tags={post.tags}
        readingMinutes={post.readingMinutes}
        cover={post.cover}
        coverAlt={post.coverAlt}
        coverFocus={post.coverFocus}
        role={post.role}
        years={post.years}
        links={post.links}
        gallery={post.gallery}
        kind={kind}
        back={parentPost ? { href: `/projects/${parentPost.slug}`, label: parentPost.title, series: post.series } : undefined}
        after={
          <>
            {/* presence: reactions (dark behind LIVE_REACTIONS_ENABLED in lib/presence/flag.ts) */}
            {LIVE_REACTIONS_ENABLED ? <LiveReactions slug={post.slug} /> : null}
            <OriginalLink url={post.originalUrl} />
            <PostExtras slug={post.slug} />
            {series ? <SeriesNav name={series.name} id={series.id} posts={series.posts} current={post.slug} /> : null}
            <PostNav
            parent={parentPost}
            items={children}
            prev={at > 0 ? siblings[at - 1] : undefined}
            next={at >= 0 ? siblings[at + 1] : undefined}
            position={at >= 0 ? { n: at + 1, of: siblings.length } : undefined}
            />
          </>
        }
      >
        {body}
      </ArticleLayout>
    </>
  )
}
