// Browser-side stand-in for lib/media/index.ts (swapped in by vite.config.ts for the client build).
// The manifest (hundreds of KB) never ships: each route's loader resolves the entries the page renders and the route
// registers them before rendering, so `getImageInfo` answers identically on the server and in the browser.
import type { ImageInfo } from './index'

export type { ImageInfo, ImageVariant } from './index'

const registry = new Map<string, ImageInfo>()

export function registerImages(images: Record<string, ImageInfo> | undefined) {
  if (images) for (const [k, v] of Object.entries(images)) registry.set(k, v)
}

export function getImageInfo(src: string | undefined): ImageInfo | undefined {
  if (!src) return undefined
  return registry.get(decodeURI(src.split('?')[0]))
}
