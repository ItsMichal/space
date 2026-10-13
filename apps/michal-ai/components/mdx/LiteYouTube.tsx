'use client'
// Click-to-load YouTube player: a thumbnail and play button until clicked, then the privacy-enhanced iframe.
// Without JavaScript the thumbnail is a plain link to the video, so the content still works.
import { useState } from 'react'

export function LiteYouTube({ id, title, thumbnail }: { id: string; title: string; thumbnail: string }) {
  const [playing, setPlaying] = useState(false)
  const watch = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`
  return (
    <div className="embed embed--youtube" style={{ aspectRatio: '16 / 9', position: 'relative', background: '#000', overflow: 'hidden' }}>
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
      ) : (
        <a
          href={watch}
          aria-label={`Play video: ${title}`}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return
            e.preventDefault()
            setPlaying(true)
          }}
          style={{ position: 'absolute', inset: 0, display: 'block' }}
        >
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <svg
            viewBox="0 0 68 48"
            width="68"
            height="48"
            aria-hidden
            style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
          >
            <path d="M66.5 7.7a8.5 8.5 0 0 0-6-6C55.2.3 34 .3 34 .3S12.8.3 7.5 1.7a8.5 8.5 0 0 0-6 6C.1 13 .1 24 .1 24s0 11 1.4 16.3a8.5 8.5 0 0 0 6 6C12.8 47.7 34 47.7 34 47.7s21.2 0 26.5-1.4a8.5 8.5 0 0 0 6-6C67.9 35 67.9 24 67.9 24s0-11-1.4-16.3Z" fill="#212121" fillOpacity=".85" />
            <path d="M45 24 27 14v20z" fill="#fff" />
          </svg>
        </a>
      )}
    </div>
  )
}
