'use client'
// A ::video with captions: the same <video>, with the overlay following its currentTime and the on/off toggle under it.
import { useCallback, useRef, useState, type CSSProperties } from 'react'
import { CaptionOverlay, CaptionsToggle, useCaptionsPref, useCues } from './Captions'

type Props = { src: string; poster?: string; title?: string; captions: string; vtt?: string; style: CSSProperties }

export function CaptionedVideo({ src, poster, title, captions, vtt, style }: Props) {
  const cues = useCues(captions, vtt)
  const [on, setOn] = useCaptionsPref()
  const [running, setRunning] = useState(false)
  const [moved, setMoved] = useState(0)
  const video = useRef<HTMLVideoElement>(null)
  const time = useCallback(() => video.current?.currentTime ?? null, [])
  return (
    <>
      <div className="embed" style={{ ...style, position: 'relative' }}>
        <video
          ref={video}
          src={src}
          poster={poster}
          controls
          preload="metadata"
          playsInline
          aria-label={title}
          onPlay={() => setRunning(true)}
          onPause={() => setRunning(false)}
          onEnded={() => setRunning(false)}
          onSeeked={() => setMoved((n) => n + 1)}
        />
        {cues?.length && on ? <CaptionOverlay cues={cues} time={time} running={running} moved={moved} /> : null}
      </div>
      {cues?.length ? <CaptionsToggle on={on} onChange={setOn} /> : null}
    </>
  )
}
