import type { CSSProperties } from 'react'
import { getImageInfo } from '@/lib/media'

export type PictureProps = {
  src: string
  alt: string
  /** `sizes` attribute: what width the image renders at. Tell the browser the truth so phones fetch small variants. */
  sizes: string
  /** Above-the-fold image: eager + fetchpriority high. */
  priority?: boolean
  className?: string
  /** Crop to a fixed aspect ratio, e.g. "16 / 10". Defaults to the intrinsic ratio. */
  aspect?: string
  /** CSS object-position for cropped images, e.g. "50% 30%". */
  focus?: string
  /** Extra attributes for the <img>, e.g. data-* hooks. */
  imgProps?: Record<string, string | number | undefined>
}

/**
 * Responsive <picture>: AVIF + WebP srcsets from the build pipeline, intrinsic width/height (no layout shift)
 * and a blurred dominant-color background while loading. Images the pipeline doesn't know (remote URLs,
 * files added without a build) fall back to a plain <img>.
 */
export function Picture({ src, alt, sizes, priority = false, className, aspect, focus, imgProps }: PictureProps) {
  const info = getImageInfo(src)
  const style: CSSProperties = {
    ...(info ? { backgroundColor: info.color, backgroundImage: `url(${info.lqip})`, backgroundSize: 'cover' } : {}),
    ...(aspect ? { aspectRatio: aspect, objectFit: 'cover' as const } : {}),
    ...(focus ? { objectPosition: focus } : {}),
  }
  const common = {
    className,
    style,
    'data-lqip': info ? '' : undefined,
    decoding: 'async' as const,
    loading: priority ? ('eager' as const) : ('lazy' as const),
    fetchPriority: priority ? ('high' as const) : undefined,
    ...imgProps,
  }
  if (!info || info.animated || !info.variants.webp.length) {
    return <img src={src} alt={alt} width={info?.w} height={info?.h} {...common} />
  }
  const set = (list: { w: number; src: string }[]) => list.map((v) => `${v.src} ${v.w}w`).join(', ')
  const mid = info.variants.webp.find((v) => v.w >= 960) ?? info.variants.webp[info.variants.webp.length - 1]
  return (
    <picture>
      <source type="image/avif" srcSet={set(info.variants.avif)} sizes={sizes} />
      <source type="image/webp" srcSet={set(info.variants.webp)} sizes={sizes} />
      <img src={mid.src} alt={alt} width={info.w} height={info.h} {...common} />
    </picture>
  )
}
