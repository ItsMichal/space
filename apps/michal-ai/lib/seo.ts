// Central SEO helpers: absolute URLs, metadata builders and JSON-LD for posts and the site.
// Safe to import from server components, route handlers and (statically) from the root layout.
import type { Metadata } from 'next'
import { siteConfig } from '@/site.config'
import { profile } from '@/content/profile'
import type { Post, PostKind } from '@/lib/content/types'

export const SITE_URL = siteConfig.url.replace(/\/$/, '')
export const SITE_NAME = siteConfig.title
export const AUTHOR_NAME = profile.name
export const DEFAULT_OG_IMAGE = '/michal.png'
/** 1200x630 JPEG share card (built by scripts/build-images.mjs); the portrait stays DEFAULT_OG_IMAGE for JSON-LD. */
export const DEFAULT_SHARE_IMAGE = '/media/_og/default.jpg'

/** WebP covers have a JPEG twin under /media/_og/ for share cards; other formats are used as they are. */
export const shareImagePath = (cover: string) => cover.replace(/^\/media\/(.+)\/cover\.webp$/i, '/media/_og/$1.jpg')

/** Pass to `metadata.metadataBase` in the root layout so relative URLs resolve to https://michal.ai. */
export const metadataBase = new URL(SITE_URL)

export const absoluteUrl = (path: string) =>
  /^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`

export const SECTION: Record<PostKind, { base: string; label: string; kindLabel: string }> = {
  project: { base: '/projects', label: 'Projects', kindLabel: 'Project' },
  article: { base: '/writing', label: 'Writing', kindLabel: 'Article' },
}

/** Canonical path of a post: children live under their parent project. */
export const postPath = (post: Pick<Post, 'kind' | 'slug' | 'parent'>) =>
  post.parent ? `/projects/${post.parent}/${post.slug}` : `${SECTION[post.kind].base}/${post.slug}`
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
  alternateName: profile.asciiName,
  url: SITE_URL,
  image: absoluteUrl(DEFAULT_OG_IMAGE),
  jobTitle: profile.jobTitle,
  worksFor: profile.worksFor.map((o) => ({ '@type': 'Organization', ...o })),
  alumniOf: profile.alumniOf.map((name) => ({ '@type': 'CollegeOrUniversity', name })),
  knowsAbout: [...profile.knowsAbout],
  description: siteConfig.description,
  sameAs: [
    siteConfig.github,
    siteConfig.linkedin,
    `https://twitter.com/${siteConfig.twitter.replace(/^@/, '')}`,
  ],
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

const HOME_TITLE = `${profile.name} — ${profile.titleTagline}`

/** Metadata fragment for the home page: canonical + profile OG. Spread into the page's `metadata`. */
export function homeMetadata(): Metadata {
  return {
    alternates: { canonical: SITE_URL },
    // Next replaces (not merges) `openGraph` per page, so the layout's og:image/title/description must be repeated here.
    openGraph: {
      type: 'profile',
      url: SITE_URL,
      siteName: SITE_NAME,
      locale: 'en_US',
      title: HOME_TITLE,
      description: profile.description,
      images: [{ url: absoluteUrl(DEFAULT_SHARE_IMAGE) }],
      firstName: profile.firstName,
      lastName: profile.lastName,
    },
    twitter: { ...siteMetadata.twitter, title: HOME_TITLE, description: profile.description, images: [absoluteUrl(DEFAULT_SHARE_IMAGE)] },
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
  return absoluteUrl(post.cover ? shareImagePath(post.cover) : DEFAULT_SHARE_IMAGE)
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

export function postJsonLd(post: Post, parent?: Pick<Post, 'title' | 'slug' | 'parent' | 'kind'>) {
  const url = absoluteUrl(postPath(post))
  const author = { '@type': 'Person', '@id': `${SITE_URL}/#person`, name: AUTHOR_NAME, url: SITE_URL }
  const parentUrl = parent ? absoluteUrl(postPath(parent)) : undefined
  const common = {
    '@context': 'https://schema.org',
    '@id': `${url}#${post.kind === 'article' ? 'article' : 'work'}`,
    url,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    // No cover: omit the image so crawlers use the generated opengraph-image card.
    ...(post.cover ? { image: postImage(post) } : {}),
    keywords: post.tags.join(', '),
    inLanguage: 'en-US',
    isPartOf: parent ? { '@type': 'CreativeWork', '@id': `${parentUrl}#work`, name: parent.title, url: parentUrl } : { '@id': `${SITE_URL}/#website` },
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
  const crumbs = parent
    ? [
        { name: 'Home', path: '/' },
        { name: 'Projects', path: '/projects' },
        { name: parent.title, path: postPath(parent) },
        { name: post.title, path: postPath(post) },
      ]
    : [
        { name: 'Home', path: '/' },
        { name: SECTION[post.kind].label, path: SECTION[post.kind].base },
        { name: post.title, path: postPath(post) },
      ]
  return [entity, breadcrumbJsonLd(crumbs)]
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
      images: [{ url: absoluteUrl(DEFAULT_SHARE_IMAGE) }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [absoluteUrl(DEFAULT_SHARE_IMAGE)] },
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
