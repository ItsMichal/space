// Browser twin of the size rules in lib/editor/server/posts.ts saveUpload(): images wider than 1600 px, or larger than 250 KB and
// not webp, are resized and re-encoded as webp (q82). Animated GIFs and anything the browser cannot encode as webp are kept as is.
const MAX_WIDTH = 1600
const CONVERT_ABOVE = 250 * 1024

export type PreparedImage = { file: File; width: number; height: number; converted: boolean }

export async function prepareImage(file: File): Promise<PreparedImage> {
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return { file, width: 0, height: 0, converted: false } // the server says whether it is an image it accepts
  }
  const { width, height } = bmp
  const wide = width > MAX_WIDTH
  const convert = file.type !== 'image/gif' && (wide || (file.type !== 'image/webp' && file.size > CONVERT_ABOVE))
  if (!convert || typeof OffscreenCanvas === 'undefined') {
    bmp.close()
    return { file, width, height, converted: false }
  }
  const w = Math.min(width, MAX_WIDTH)
  const h = Math.round((height * w) / width)
  const canvas = new OffscreenCanvas(w, h)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 })
  if (blob.type !== 'image/webp') return { file, width, height, converted: false }
  const base = file.name.replace(/\.[^.]+$/, '') || 'image'
  return { file: new File([blob], `${base}.webp`, { type: 'image/webp' }), width: w, height: h, converted: true }
}
