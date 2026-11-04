import { POSTER_SRC_RE, VIDEO_SRC_RE } from '@/lib/content/rules.mjs'

/** A self-hosted 16:9 clip from /media/; nothing loads past its metadata until the reader presses play. */
export function Video({ src, poster, title }: { src: string; poster?: string; title?: string }) {
  if (!VIDEO_SRC_RE.test(src)) return null
  if (poster && !POSTER_SRC_RE.test(poster)) poster = undefined
  return (
    <figure className="video">
      <div className="embed" style={{ aspectRatio: '16 / 9' }}>
        <video src={src} poster={poster} controls preload="metadata" playsInline aria-label={title} />
      </div>
      {title ? <figcaption>{title}</figcaption> : null}
    </figure>
  )
}
