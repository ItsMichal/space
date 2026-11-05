import type { CSSProperties } from 'react'
import { POSTER_SRC_RE, VIDEO_SRC_RE } from '@/lib/content/rules.mjs'
import { getImageInfo } from '@/lib/media'
import { CaptionedVideo } from './CaptionedVideo'

/**
 * A self-hosted 16:9 clip from /media/; nothing loads past its metadata until the reader presses play. The poster comes
 * from the image pipeline like a Picture: its blurred placeholder first, then a WebP variant near the column's width.
 */
export function Video({ src, poster, title, captions, vtt }: { src: string; poster?: string; title?: string; captions?: string; vtt?: string }) {
  if (!VIDEO_SRC_RE.test(src)) return null
  if (poster && !POSTER_SRC_RE.test(poster)) poster = undefined
  const info = getImageInfo(poster)
  const style: CSSProperties = { aspectRatio: '16 / 9', ...(info ? { backgroundColor: info.color, backgroundImage: `url(${info.lqip})`, backgroundSize: 'cover' } : {}) }
  const webp = info && !info.animated ? info.variants.webp : []
  const still = webp.find((v) => v.w >= 960)?.src ?? webp[webp.length - 1]?.src ?? poster
  return (
    <figure className={captions ? 'video captioned' : 'video'}>
      {captions ? (
        <CaptionedVideo src={src} poster={still} title={title} captions={captions} vtt={vtt} style={style} />
      ) : (
        <div className="embed" style={style}>
          <video src={src} poster={still} controls preload="metadata" playsInline aria-label={title} />
        </div>
      )}
      {title ? <figcaption>{title}</figcaption> : null}
    </figure>
  )
}
