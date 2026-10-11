import { Picture, type PictureProps } from '@/components/media/Picture'
import { getImageInfo } from '@/lib/media'
import type { ShaderTuning } from './config'
import { hashString } from './mask'
import { ShaderFrame } from './ShaderFrame'

export type ShaderImageProps = PictureProps & ShaderTuning

/**
 * Drop-in for <Picture>: same API, same DOM (<picture>/<img> for SEO, LCP, no-JS and a11y), plus the organic edge and
 * the shared-canvas treatment as progressive enhancement. Animated images and unknown remote images pass through.
 */
export function ShaderImage({ variant, intensity, speed, progress, ...pic }: ShaderImageProps) {
  const info = getImageInfo(pic.src)
  if (!info || info.animated) return <Picture {...pic} />
  return (
    <ShaderFrame seed={hashString(pic.src)} variant={variant} intensity={intensity} speed={speed} progress={progress}>
      <Picture {...pic} />
    </ShaderFrame>
  )
}
