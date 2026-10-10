// Build-time lookup into the image manifest written by scripts/build-images.mjs.
// Server-only (reads the filesystem); call from statically rendered server components.
import fs from 'node:fs'
import path from 'node:path'

export type ImageVariant = { w: number; src: string }
export type ImageInfo = {
  w: number
  h: number
  color: string
  lqip: string
  animated: boolean
  variants: { avif: ImageVariant[]; webp: ImageVariant[] }
}

let cache: Record<string, ImageInfo> | null = null

function load(): Record<string, ImageInfo> {
  if (cache && process.env.NODE_ENV === 'production') return cache
  try {
    cache = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'lib', 'media', 'manifest.json'), 'utf8'))
  } catch {
    cache = {}
  }
  return cache!
}

/** Manifest entry for a `/media/...` path, or undefined for remote / unprocessed images. */
export function getImageInfo(src: string | undefined): ImageInfo | undefined {
  if (!src) return undefined
  return load()[decodeURI(src.split('?')[0])]
}
