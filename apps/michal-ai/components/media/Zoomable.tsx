import { Picture, type PictureProps } from './Picture'
import { getImageInfo } from '@/lib/media'

/**
 * A Picture that opens in the page's <Lightbox>. The trigger is a real <button> (keyboard + screen reader friendly);
 * the lightbox discovers triggers by `data-zoom` and reads the large-variant srcset from data attributes.
 */
export function Zoomable({ caption, ...pic }: PictureProps & { caption?: string }) {
  const info = getImageInfo(pic.src)
  const webp = info?.variants.webp ?? []
  const big = webp.filter((v) => v.w >= 960)
  const set = (big.length ? big : webp).map((v) => `${v.src} ${v.w}w`).join(', ')
  return (
    <button
      type="button"
      className="zoom"
      data-zoom=""
      data-zoom-src={webp.length ? webp[webp.length - 1].src : pic.src}
      data-zoom-srcset={set || undefined}
      data-zoom-w={info?.w}
      data-zoom-h={info?.h}
      data-zoom-color={info?.color}
      data-zoom-caption={caption}
      aria-label={`Enlarge image: ${pic.alt || caption || 'untitled'}`}
    >
      <Picture {...pic} />
    </button>
  )
}
