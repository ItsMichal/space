import type { ReactNode } from 'react'
import { getAllPosts } from '@/lib/content'
import { postPath } from '@/lib/seo'
import { PreviewLink } from './PreviewLink'

/**
 * Server-side resolver for in-text links: an internal href that points at a project or article becomes a PreviewLink
 * with that post's title, description and cover. Anything else renders as a plain anchor. Build time only.
 */
export function PostPreviewLink({ href, children, ...rest }: { href?: string; children?: ReactNode } & Record<string, unknown>) {
  if (!href || !href.startsWith('/')) return <a href={href} {...(rest as object)}>{children}</a>
  const path = href.split('#')[0].replace(/\/$/, '')
  const post = getAllPosts().find((p) => postPath(p) === path)
  if (!post) return <a href={href} {...(rest as object)}>{children}</a>
  return (
    <PreviewLink
      href={href}
      preview={{ title: post.title, description: post.description, image: post.cover, meta: post.years ?? post.date.slice(0, 4) }}
    >
      {children}
    </PreviewLink>
  )
}
