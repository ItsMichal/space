import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPost } from '@/lib/content'
import { renderMarkdown } from '@/lib/content/render'
import type { PostKind } from '@/lib/content/types'
import { JsonLd } from '@/components/seo/JsonLd'
import { SECTION, postJsonLd, postMetadata as buildPostMetadata } from '@/lib/seo'

export function postMetadata(kind: PostKind, slug: string): Metadata {
  const post = getPost(slug)
  if (!post || post.kind !== kind) return {}
  return buildPostMetadata(post)
}

export async function PostPage({ kind, slug }: { kind: PostKind; slug: string }) {
  const post = getPost(slug)
  if (!post || post.kind !== kind) notFound()
  const body = await renderMarkdown(post.body)
  const section = SECTION[kind]
  return (
    <>
      <JsonLd data={postJsonLd(post)} />
      <article>
        <nav aria-label="Breadcrumb">
          <Link href={section.base}>{section.label}</Link>
        </nav>
        <header>
          <h1>{post.title}</h1>
          <p className="lede">{post.description}</p>
          <p className="meta">
            <time dateTime={post.date}>{post.date}</time>
            {post.updated && post.updated !== post.date ? (
              <>
                {' · updated '}
                <time dateTime={post.updated}>{post.updated}</time>
              </>
            ) : null}
            {` · ${post.readingMinutes} min read`}
          </p>
          {post.tags.length ? (
            <ul className="tags">
              {post.tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : null}
        </header>
        {post.cover ? (
          <figure className="cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.cover} alt={post.coverAlt ?? ''} fetchPriority="high" decoding="async" />
          </figure>
        ) : null}
        <div className="prose">{body}</div>
      </article>
    </>
  )
}
