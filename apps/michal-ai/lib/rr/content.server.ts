// Build-time helpers for route loaders (Node only: `.server` keeps this out of the browser bundle).
import fs from 'node:fs'
import path from 'node:path'
import type { Metadata, Viewport } from '@/lib/meta-types'
import { getImageInfo, type ImageInfo } from '@/lib/media/index'
import type { Post } from '@/lib/content/types'
import { buildMeta, type Descriptor, type ShareImage, type ShareVideo } from './head'
import { videoSources } from '@/lib/content/rules.mjs'
import { rootMetadata, rootViewport } from './root-meta'

export type SlimPost = Omit<Post, 'body'>

/** Posts go over the wire without their markdown body (pages that need prose get rendered output instead). */
export const slim = <T extends Post>(p: T): SlimPost => {
  const rest: Partial<Post> = { ...p }
  delete rest.body
  return rest as SlimPost
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
export function shareFor(pagePath: string, alt: string, video?: ShareVideo): ShareImage {
  const base = pagePath === '/' ? '' : pagePath
  return {
    ...(video ? { video } : {}),
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

/** The frame size an mp4 declares in its video track header (tkhd), or null when there is none. */
export function mp4Size(buf: Buffer): { width: number; height: number } | null {
  for (let i = buf.indexOf('tkhd'); i > 0; i = buf.indexOf('tkhd', i + 4)) {
    const at = i + 4 + (buf[i + 4] === 1 ? 88 : 76)
    if (at + 8 > buf.length) break
    const width = buf.readUInt32BE(at) >>> 16
    const height = buf.readUInt32BE(at + 4) >>> 16
    if (width && height) return { width, height }
  }
  return null
}

/** The first mp4 a post's markdown plays (::video) that is on disk, with its frame size. Webm is left out: iMessage and X only
 * play mp4. Media comes from the content repo at build time, so a clip that is not there is skipped. */
export function postVideo(body: string, root = path.join(process.cwd(), 'public')): (ShareVideo & { poster?: string; title?: string }) | undefined {
  for (const v of videoSources(body)) {
    if (!v.src.endsWith('.mp4')) continue
    try {
      const size = mp4Size(fs.readFileSync(path.join(root, v.src)))
      if (size) return { ...v, ...size }
    } catch {}
  }
  return undefined
}

/** A post's share clip: its first mp4 (postVideo), as og:video and the X player card take it. */
export function shareVideoFor(body: string, root?: string): ShareVideo | undefined {
  const v = postVideo(body, root)
  return v && { src: v.src, width: v.width, height: v.height }
}
