// Turns the site's Metadata objects (lib/seo.ts, unchanged) into React Router `meta` descriptors, reproducing the tags Next emitted.
// Pure and browser-safe: loaders call it at prerender time and hand the result to the route's `meta` export.
import type { Metadata, Viewport } from 'next'

export type Descriptor = Record<string, unknown>

export type ShareImage = {
  /** Path of the card route without host, e.g. "/writing/foo/opengraph-image". */
  og: string
  twitter: string
  /** Content hashes appended as the cache-busting query (same shape Next used). */
  ogHash: string
  twitterHash: string
  alt: string
}

type Title = string | { default?: string; template?: string; absolute?: string } | undefined

const VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover'

function resolveTitle(root: Title, page: Title): string {
  const r = typeof root === 'object' ? root : { default: root }
  if (page === undefined) return r.default ?? ''
  if (typeof page === 'object') {
    if (page.absolute) return page.absolute
    return page.default ?? r.default ?? ''
  }
  return r.template ? r.template.replace('%s', page) : page
}

const toArray = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v])

/** Next's per-key shallow merge: a page's `openGraph`, `twitter`, `alternates` replace the layout's wholesale. */
export function mergeMetadata(root: Metadata, page: Metadata): Metadata {
  return { ...root, ...page, title: undefined } as Metadata
}

export function buildMeta(root: Metadata, page: Metadata, viewport: Viewport, share?: ShareImage, site = 'https://michal.ai'): Descriptor[] {
  const md = mergeMetadata(root, page)
  const abs = (u: string) => (/^https?:\/\//.test(u) ? u : `${site}${u.startsWith('/') ? '' : '/'}${u}`)
  const out: Descriptor[] = []
  const meta = (k: 'name' | 'property', key: string, content: unknown) => {
    if (content === undefined || content === null || content === '') return
    out.push({ [k]: key, content: String(content) })
  }

  out.push({ name: 'viewport', content: VIEWPORT })
  for (const tc of toArray(viewport.themeColor as unknown as string | { media?: string; color: string }[] | undefined)) {
    if (typeof tc === 'string') out.push({ name: 'theme-color', content: tc })
    else out.push({ name: 'theme-color', content: tc.color, ...(tc.media ? { media: tc.media } : {}) })
  }
  if (viewport.colorScheme) out.push({ name: 'color-scheme', content: String(viewport.colorScheme) })

  out.push({ title: resolveTitle(root.title as Title, page.title as Title) })
  meta('name', 'description', md.description)
  for (const a of toArray(md.authors as { name?: string; url?: string }[] | undefined)) {
    meta('name', 'author', a.name)
    if (a.url) out.push({ tagName: 'link', rel: 'author', href: abs(a.url) })
  }
  if (md.keywords) meta('name', 'keywords', toArray(md.keywords as string | string[]).join(','))
  const robots = md.robots as { index?: boolean; follow?: boolean } | undefined
  if (robots) meta('name', 'robots', `${robots.index === false ? 'noindex' : 'index'}, ${robots.follow === false ? 'nofollow' : 'follow'}`)
  if (md.manifest) out.push({ tagName: 'link', rel: 'manifest', href: String(md.manifest) })

  const alt = md.alternates as { canonical?: string; types?: Record<string, { url: string; title?: string }[]> } | undefined
  if (alt?.canonical) out.push({ tagName: 'link', rel: 'canonical', href: abs(alt.canonical) })
  for (const [type, list] of Object.entries(alt?.types ?? {})) {
    for (const l of list) out.push({ tagName: 'link', rel: 'alternate', type, href: abs(l.url), ...(l.title ? { title: l.title } : {}) })
  }

  const og = md.openGraph as Record<string, unknown> | undefined
  if (og) {
    meta('property', 'og:title', og.title)
    meta('property', 'og:description', og.description)
    meta('property', 'og:url', og.url && abs(String(og.url)))
    meta('property', 'og:site_name', og.siteName)
    meta('property', 'og:locale', og.locale)
    if (share) {
      meta('property', 'og:image:alt', share.alt)
      meta('property', 'og:image:type', 'image/png')
      meta('property', 'og:image', `${site}${share.og}?${share.ogHash}`)
      meta('property', 'og:image:width', 1200)
      meta('property', 'og:image:height', 630)
    }
    meta('property', 'og:type', og.type)
    meta('property', 'profile:first_name', og.firstName)
    meta('property', 'profile:last_name', og.lastName)
    meta('property', 'article:published_time', og.publishedTime)
    meta('property', 'article:modified_time', og.modifiedTime)
    for (const a of toArray(og.authors as string[] | undefined)) meta('property', 'article:author', a)
    for (const t of toArray(og.tags as string[] | undefined)) meta('property', 'article:tag', t)
  }
  const tw = md.twitter as Record<string, unknown> | undefined
  if (tw) {
    meta('name', 'twitter:card', tw.card)
    meta('name', 'twitter:site', tw.site)
    meta('name', 'twitter:creator', tw.creator)
    meta('name', 'twitter:title', tw.title)
    meta('name', 'twitter:description', tw.description)
    if (share) {
      meta('name', 'twitter:image:alt', share.alt)
      meta('name', 'twitter:image:type', 'image/png')
      meta('name', 'twitter:image', `${site}${share.twitter}?${share.twitterHash}`)
      meta('name', 'twitter:image:width', 1200)
      meta('name', 'twitter:image:height', 630)
    }
  }

  // File-convention favicon, then the explicit icons from the root metadata.
  out.push({ tagName: 'link', rel: 'icon', href: '/favicon.ico', sizes: '16x16', type: 'image/x-icon' })
  const icons = md.icons as { icon?: { url: string; sizes?: string; type?: string }[] } | undefined
  for (const i of icons?.icon ?? []) out.push({ tagName: 'link', rel: 'icon', href: i.url, ...(i.sizes ? { sizes: i.sizes } : {}), ...(i.type ? { type: i.type } : {}) })
  return out
}
