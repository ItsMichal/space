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
// Share cards (og:image / twitter:image) are generated: app/**/opengraph-image.tsx renders a 1200x630 PNG per page with
// lib/og.tsx at build time, and Next adds the absolute og:image/width/height/type/alt tags itself. Pages therefore set
// no `images` in their metadata (an explicit `images` would replace the generated card).

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
export const postTitle = (title: string) => `${title} · ${AUTHOR_NAME}`

/** Defaults the root layout can spread into its `metadata` export (RSS discovery, metadataBase, site-wide OG). */
export const siteMetadata: Metadata = {
  metadataBase,
  alternates: {
    types: {
      'application/rss+xml': [{ url: '/feed.xml', title: `${SITE_NAME} · RSS` }],
      'application/feed+json': [{ url: '/feed.json', title: `${SITE_NAME} · JSON Feed` }],
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
  // 4:5 photograph (square or 4:5 is what search results crop well), metadata stripped.
  image: absoluteUrl(profile.portrait.jsonLd),
  jobTitle: profile.jobTitle,
  worksFor: profile.worksFor.map((o) => ({ '@type': 'Organization', ...o })),
  alumniOf: profile.alumniOf.map((name) => ({ '@type': 'CollegeOrUniversity', name })),
  knowsAbout: [...profile.knowsAbout],
  description: siteConfig.description,
  // State only, never a city.
  homeLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressRegion: 'CA', addressCountry: 'US' } },
  award: profile.awards.map((a) => `${a.title}, ${a.context}`),
  sameAs: [siteConfig.github, siteConfig.linkedin, siteConfig.x],
}

/**
 * ProfilePage for /about (the page about the person; the home page no longer carries one). Its mainEntity is the Person node:
 * same @id the posts and the WebSite publisher reference, so the graph stays one person.
 */
export const profilePageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfilePage',
  '@id': `${SITE_URL}/about#profilepage`,
  url: `${SITE_URL}/about`,
  name: `About · ${AUTHOR_NAME}`,
  inLanguage: 'en-US',
  dateModified: '2026-10-12',
  isPartOf: { '@id': `${SITE_URL}/#website` },
  mainEntity: { ...personJsonLd, '@context': undefined },
}

const ABOUT_TITLE = `About · ${profile.name}`
export const ABOUT_DESCRIPTION = `${profile.name} is a software engineer at SpaceX working on Starlink.com. Experience, education, publications, hackathons and press, and how to get in touch.`

/** Metadata for /about, same shape as the list pages (canonical, share card, Twitter card). */
export function aboutMetadata(): Metadata {
  const url = absoluteUrl('/about')
  return {
    metadataBase,
    title: { absolute: ABOUT_TITLE },
    description: ABOUT_DESCRIPTION,
    alternates: { canonical: url },
    openGraph: {
      type: 'profile',
      url,
      title: ABOUT_TITLE,
      description: ABOUT_DESCRIPTION,
      siteName: SITE_NAME,
      locale: 'en_US',
      firstName: profile.firstName,
      lastName: profile.lastName,
    },
    twitter: { ...siteMetadata.twitter, title: ABOUT_TITLE, description: ABOUT_DESCRIPTION },
  }
}

const RESUME_TITLE = `Resume · ${profile.name}`
export const RESUME_DESCRIPTION = `Resume of ${profile.name}, software engineer at SpaceX: experience, education, publications, selected projects and skills.`
export function resumeMetadata(): Metadata {
  const url = absoluteUrl('/resume')
  return {
    metadataBase,
    title: { absolute: RESUME_TITLE },
    description: RESUME_DESCRIPTION,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, title: RESUME_TITLE, description: RESUME_DESCRIPTION, siteName: SITE_NAME, locale: 'en_US' },
    twitter: { ...siteMetadata.twitter, title: RESUME_TITLE, description: RESUME_DESCRIPTION },
  }
}

export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: SITE_NAME,
  alternateName: profile.asciiName,
  inLanguage: 'en-US',
  publisher: { '@id': `${SITE_URL}/#person` },
}

const HOME_TITLE = `${profile.name} · ${profile.titleTagline}`

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
      firstName: profile.firstName,
      lastName: profile.lastName,
    },
    twitter: { ...siteMetadata.twitter, title: HOME_TITLE, description: profile.description },
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

/** Display name of the site a post first appeared on, from its URL: "https://x.medium.com/y" gives "Medium". */
export function originalSite(url: string): string | undefined {
  try {
    const parts = new URL(url).hostname.replace(/^www\./, '').split('.')
    const name = parts.length > 1 ? parts[parts.length - 2] : parts[0]
    return name ? name[0].toUpperCase() + name.slice(1) : undefined
  } catch {
    return undefined
  }
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
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: post.description,
      site: siteConfig.twitter,
      creator: siteConfig.twitter,
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
    // The cover itself (not the share card): structured data wants the picture, the card is for link previews.
    ...(post.cover ? { image: absoluteUrl(post.cover) } : {}),
    keywords: post.tags.join(', '),
    inLanguage: 'en-US',
    isPartOf: parent ? { '@type': 'CreativeWork', '@id': `${parentUrl}#work`, name: parent.title, url: parentUrl } : { '@id': `${SITE_URL}/#website` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    ...(post.originalUrl ? { sameAs: post.originalUrl } : {}),
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
      locale: 'en_US',
    },
    twitter: { card: 'summary_large_image', title, description, site: siteConfig.twitter, creator: siteConfig.twitter },
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
