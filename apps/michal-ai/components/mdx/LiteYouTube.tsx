'use client'
// Click-to-load YouTube player: a thumbnail and play button until clicked, then the privacy-enhanced iframe.
// Without JavaScript the thumbnail is a plain link to the video, so the content still works.
// With cues, the iframe is asked for its position over the IFrame API's postMessage channel (no API script is loaded) and the
// captions follow it, interpolated between the player's reports while it plays.
import { useCallback, useEffect, useRef, useState } from 'react'
import { CaptionOverlay, CaptionsToggle, useCaptionsPref, useCues } from './Captions'

const PLAYER_ORIGIN = 'https://www.youtube-nocookie.com'
const PLAYING = 1

type Clock = { time: number; at: number; rate: number; playing: boolean }

export function LiteYouTube({ id, title, thumbnail, captions, vtt }: { id: string; title: string; thumbnail: string; captions?: string; vtt?: string }) {
  const cues = useCues(captions, vtt)
  const [playing, setPlaying] = useState(false)
  const [on, setOn] = useCaptionsPref()
  const [running, setRunning] = useState(false)
  const [moved, setMoved] = useState(0)
  const frame = useRef<HTMLIFrameElement>(null)
  const clock = useRef<Clock | null>(null)
  const captioned = Boolean(cues?.length)
  const watch = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`
  const api = captioned && typeof window !== 'undefined' ? `&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}` : ''

  useEffect(() => {
    if (!playing || !captioned) return
    let heard = false
    const say = (msg: object) => frame.current?.contentWindow?.postMessage(JSON.stringify({ ...msg, id: 1, channel: 'widget' }), PLAYER_ORIGIN)
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== PLAYER_ORIGIN || e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return
      let data: { event?: string; info?: { currentTime?: unknown; playerState?: unknown; playbackRate?: unknown } | null }
      try {
        data = JSON.parse(e.data)
      } catch {
        return
      }
      heard = true
      const info = data.info
      if (!info || typeof info !== 'object') return
      const prev = clock.current ?? { time: 0, at: performance.now(), rate: 1, playing: false }
      const next = { ...prev, at: performance.now(), time: prev.playing ? prev.time + ((performance.now() - prev.at) / 1000) * prev.rate : prev.time }
      if (typeof info.currentTime === 'number' && Number.isFinite(info.currentTime)) next.time = info.currentTime
      if (typeof info.playbackRate === 'number' && info.playbackRate > 0) next.rate = info.playbackRate
      if (typeof info.playerState === 'number') next.playing = info.playerState === PLAYING
      // The cue file stands in for YouTube's own captions (which it turns on by itself for muted autoplay), so the two never
      // stack. The captions module only exists once playback starts, so this is said each time it does.
      if (next.playing && !prev.playing) {
        say({ event: 'command', func: 'setOption', args: ['captions', 'track', {}] })
        say({ event: 'command', func: 'unloadModule', args: ['captions'] })
      }
      clock.current = next
      setRunning(next.playing)
      if (!next.playing) setMoved((n) => n + 1)
    }
    window.addEventListener('message', onMessage)
    // The player answers once it is told someone is listening; keep saying so until it does.
    let tries = 0
    const hello = window.setInterval(() => {
      if (heard || ++tries > 60) return window.clearInterval(hello)
      say({ event: 'listening' })
    }, 250)
    return () => {
      window.removeEventListener('message', onMessage)
      window.clearInterval(hello)
      clock.current = null
      setRunning(false)
    }
  }, [playing, captioned])

  const time = useCallback(() => {
    const c = clock.current
    if (!c) return null
    return c.playing ? c.time + ((performance.now() - c.at) / 1000) * c.rate : c.time
  }, [])

  const player = (
    <div className="embed embed--youtube" style={{ aspectRatio: '16 / 9', position: 'relative', background: '#000', overflow: 'hidden' }}>
      {playing ? (
        <iframe
          ref={frame}
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1${api}`}
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
      {playing && captioned && on ? <CaptionOverlay cues={cues!} time={time} running={running} moved={moved} /> : null}
    </div>
  )
  if (!captioned) return player
  return (
    <div className="captioned">
      {player}
      <CaptionsToggle on={on} onChange={setOn} />
    </div>
  )
}
