import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { getChildren, getPost, getSeriesOf } from '@/lib/content'
import { OriginalLink } from '@/components/content/OriginalLink'
import { OtherSiteEnd, otherSiteFor } from '@/components/content/OtherSiteLink'
import { SeriesNav } from '@/components/content/SeriesNav'
import { renderMarkdown } from '@/lib/content/render'
import { ArticleLayout } from '@/components/site/ArticleLayout'
import { PostNav } from '@/components/content/PostNav'
import type { PostKind } from '@/lib/content/types'
import { ReadingTheme } from '@/components/site/ReadingTheme'
import { JsonLd } from '@/components/seo/JsonLd'
import { PostExtras } from '@/components/content/PostExtras'
import { Publications } from '@/components/content/Publications'
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
      types: { 'application/rss+xml': [{ url: `/projects/${post.slug}/feed.xml`, title: `${post.title} · updates` }] },
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
  // The paired piece on the other site (packages/crosslinks): a row in a project's Links, a line at the end of an article.
  const other = otherSiteFor(post.id ?? post.slug)
  const links = other && kind === 'project' ? [...(post.links ?? []), { label: other.title, href: other.href, other: true }] : post.links
  const nav = (
    <PostNav
      parent={parentPost}
      items={children}
      prev={at > 0 ? siblings[at - 1] : undefined}
      next={at >= 0 ? siblings[at + 1] : undefined}
      position={at >= 0 ? { n: at + 1, of: siblings.length } : undefined}
    />
  )
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
        links={links}
        gallery={post.gallery}
        kind={kind}
        back={parentPost ? { href: `/projects/${parentPost.slug}`, label: parentPost.title, series: post.series } : undefined}
        after={
          <>
            <Publications ids={post.publications} />
            <OriginalLink url={post.originalUrl} />
            {kind === 'article' ? <OtherSiteEnd postId={post.id ?? post.slug} /> : null}
            <PostExtras slug={post.slug} />
            {/* A project's own list of entries is content: it comes before the reactions row. */}
            {!parentPost ? nav : null}
            {/* Reactions and views (flags in lib/presence/flag.ts, kill switch LIVE_KILL): the last thing of the
                article's own content, before series and previous/next navigation. */}
            {LIVE_REACTIONS_ENABLED ? <LiveReactions postId={post.id ?? post.slug} /> : null}
            {series ? <SeriesNav name={series.name} id={series.id} posts={series.posts} current={post.slug} /> : null}
            {parentPost ? nav : null}
          </>
        }
      >
        {body}
      </ArticleLayout>
    </>
  )
}
