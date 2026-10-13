// Build-time helpers for route loaders (Node only: `.server` keeps this out of the browser bundle).
import fs from 'node:fs'
import path from 'node:path'
import type { Metadata, Viewport } from 'next'
import { getImageInfo, type ImageInfo } from '@/lib/media/index'
import type { Post } from '@/lib/content/types'
import { buildMeta, type Descriptor, type ShareImage } from './head'
import { rootMetadata, rootViewport } from './root-meta'

export type SlimPost = Omit<Post, 'body'>

/** Posts go over the wire without their markdown body (pages that need prose get rendered output instead). */
export const slim = <T extends Post>(p: T): SlimPost => {
  const { body: _body, ...rest } = p
  return rest
}
export const slimAll = (ps: Post[]) => ps.map(slim)

/** Every `/media/...` string anywhere in a JSON-able value. */
export function collectMedia(value: unknown, acc = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    for (const m of value.matchAll(/\/media\/[^\s"'<>)]+?\.(?:png|jpe?g|webp|avif|gif|svg)/gi)) acc.add(m[0])
  } else if (Array.isArray(value)) value.forEach((v) => collectMedia(v, acc))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectMedia(v, acc))
  return acc
}

/** Image-manifest entries the page renders, resolved now so the browser never loads the whole manifest. */
export function imagesFor(data: unknown, extra: string[] = []): Record<string, ImageInfo> {
  const srcs = collectMedia(data)
  for (const e of extra) srcs.add(e)
  const out: Record<string, ImageInfo> = {}
  for (const s of srcs) {
    const info = getImageInfo(s)
    if (info) out[decodeURI(s.split('?')[0])] = info
  }
  return out
}

let cards: Record<string, string> | undefined
function cardHash(key: string): string {
  cards ??= (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(process.cwd(), '.cache', 'share-cards', 'manifest.json'), 'utf8'))
    } catch {
      return {}
    }
  })()
  return cards![key] ?? '0000000000000000'
}

/** Share-card reference for a page path ("/" for home): og and twitter URLs plus content hashes. */
export function shareFor(pagePath: string, alt: string): ShareImage {
  const base = pagePath === '/' ? '' : pagePath
  return {
    og: `${base}/opengraph-image`,
    twitter: `${base}/twitter-image`,
    ogHash: cardHash(`${base}/opengraph-image`),
    twitterHash: cardHash(`${base}/twitter-image`),
    alt,
  }
}

export function headFor(page: Metadata, opts: { viewport?: Viewport; share?: ShareImage } = {}): Descriptor[] {
  return buildMeta(rootMetadata, page, opts.viewport ?? rootViewport, opts.share)
}
