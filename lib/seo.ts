// Central SEO helpers: absolute URLs, metadata builders and JSON-LD for posts and the site.
// Safe to import from server components, route handlers and (statically) from the root layout.
import type { Metadata } from 'next'
import { siteConfig } from '@/site.config'
import type { Post, PostKind } from '@/lib/content/types'

export const SITE_URL = siteConfig.url.replace(/\/$/, '')
export const SITE_NAME = siteConfig.title
export const AUTHOR_NAME = 'Michal Bodzianowski'
export const DEFAULT_OG_IMAGE = '/michal.png'

/** Pass to `metadata.metadataBase` in the root layout so relative URLs resolve to https://michal.us. */
export const metadataBase = new URL(SITE_URL)

export const absoluteUrl = (path: string) =>
  /^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`

export const SECTION: Record<PostKind, { base: string; label: string; eyebrow: string }> = {
  project: { base: '/projects', label: 'Projects', eyebrow: 'Project' },
  article: { base: '/writing', label: 'Writing', eyebrow: 'Article' },
}

export const postPath = (post: Pick<Post, 'kind' | 'slug'>) => `${SECTION[post.kind].base}/${post.slug}`
export const postTitle = (title: string) => `${title} — ${AUTHOR_NAME}`

/** Defaults the root layout can spread into its `metadata` export (RSS discovery, metadataBase, site-wide OG). */
export const siteMetadata: Metadata = {
  metadataBase,
  alternates: {
    types: {
      'application/rss+xml': [{ url: '/feed.xml', title: `${SITE_NAME} — RSS` }],
      'application/feed+json': [{ url: '/feed.json', title: `${SITE_NAME} — JSON Feed` }],
    },
  },
  openGraph: { siteName: SITE_NAME, locale: 'en_US', type: 'website' },
  twitter: { card: 'summary_large_image', site: siteConfig.twitter, creator: siteConfig.twitter },
}

/** Person JSON-LD. Render on the home page with <JsonLd data={personJsonLd} />. */
export const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': `${SITE_URL}/#person`,
  name: AUTHOR_NAME,
  url: SITE_URL,
  image: absoluteUrl(DEFAULT_OG_IMAGE),
  jobTitle: 'Creative Developer',
  description: siteConfig.description,
  sameAs: [siteConfig.github, siteConfig.linkedin, `https://twitter.com/${siteConfig.twitter.replace(/^@/, '')}`],
}

export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: SITE_NAME,
  inLanguage: 'en-US',
  publisher: { '@id': `${SITE_URL}/#person` },
}

/** Metadata fragment for the home page: canonical + profile OG. Spread into the page's `metadata`. */
export function homeMetadata(): Metadata {
  return {
    alternates: { canonical: SITE_URL },
    openGraph: { type: 'profile', url: SITE_URL, siteName: SITE_NAME, firstName: 'Michal', lastName: 'Bodzianowski' },
  }
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  }
}

export function postImage(post: Post) {
  return absoluteUrl(post.cover ?? DEFAULT_OG_IMAGE)
}

export function postMetadata(post: Post): Metadata {
  const url = absoluteUrl(postPath(post))
  const title = postTitle(post.title)
  return {
    metadataBase,
    title: { absolute: title },
    description: post.description,
    authors: [{ name: AUTHOR_NAME, url: SITE_URL }],
    keywords: post.tags,
    alternates: { canonical: post.canonical ?? url },
    openGraph: {
      type: 'article',
      url,
      title,
      description: post.description,
      siteName: SITE_NAME,
      locale: 'en_US',
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      authors: [AUTHOR_NAME],
      tags: post.tags,
      // With no cover we omit images so the generated opengraph-image card is used.
      ...(post.cover ? { images: [{ url: postImage(post), alt: post.coverAlt ?? post.title }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: post.description,
      site: siteConfig.twitter,
      creator: siteConfig.twitter,
      ...(post.cover ? { images: [postImage(post)] } : {}),
    },
  }
}

export function postJsonLd(post: Post) {
  const url = absoluteUrl(postPath(post))
  const author = { '@type': 'Person', '@id': `${SITE_URL}/#person`, name: AUTHOR_NAME, url: SITE_URL }
  const common = {
    '@context': 'https://schema.org',
    '@id': `${url}#${post.kind === 'article' ? 'article' : 'work'}`,
    url,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    image: postImage(post),
    keywords: post.tags.join(', '),
    inLanguage: 'en-US',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author,
  }
  const entity =
    post.kind === 'article'
      ? {
          ...common,
          '@type': 'BlogPosting',
          headline: post.title,
          wordCount: post.body.split(/\s+/).filter(Boolean).length,
          publisher: author,
        }
      : { ...common, '@type': 'CreativeWork', name: post.title, creator: author }
  const section = SECTION[post.kind]
  return [
    entity,
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: section.label, path: section.base },
      { name: post.title, path: postPath(post) },
    ]),
  ]
}

export function listMetadata(kind: PostKind, title: string, description: string): Metadata {
  const { base } = SECTION[kind]
  const url = absoluteUrl(base)
  return {
    metadataBase,
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      siteName: SITE_NAME,
      images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE) }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [absoluteUrl(DEFAULT_OG_IMAGE)] },
  }
}

export function listJsonLd(kind: PostKind, name: string, posts: Post[]) {
  const { base, label } = SECTION[kind]
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name,
      url: absoluteUrl(base),
      isPartOf: { '@id': `${SITE_URL}/#website` },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: posts.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: absoluteUrl(postPath(p)),
          name: p.title,
        })),
      },
    },
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: label, path: base },
    ]),
  ]
}
