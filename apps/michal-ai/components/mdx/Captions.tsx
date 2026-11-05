'use client'
// Captions over a playing video (the `captions` attribute of ::youtube and ::video, a checked cue file: lib/content/rules.mjs
// parseCaptions). On the site the cues are inlined at build time (lib/captions/inline.server.ts); elsewhere (the editor) the
// file is loaded through lib/captions/source.ts. The overlay follows a clock the player gives it and only re-renders when the
// cue changes. Readers can turn captions off; the choice is remembered on the device.
import { useEffect, useRef, useState } from 'react'
import { cueAt, parseCaptions, type Cue } from '@/lib/content/rules.mjs'
import { cachedCaptions, loadCaptions } from '@/lib/captions/source'

const PREF = 'captions'

/** The cues of a cue file: the page's inlined copy of the file when it has one, else loaded; both checked with parseCaptions. */
export function useCues(src: string | undefined, inlined: string | undefined): Cue[] | null {
  const [cues, setCues] = useState<Cue[] | null>(() => (inlined ? (parseCaptions(inlined).cues ?? null) : src ? cachedCaptions(src) : null))
  useEffect(() => {
    if (inlined || !src) return
    let alive = true
    loadCaptions(src).then(
      (v) => alive && setCues(v),
      () => alive && setCues(null)
    )
    return () => {
      alive = false
    }
  }, [src, inlined])
  return cues
}

/** Captions on or off, shared by every captioned video on the page and remembered on the device. */
export function useCaptionsPref(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(true)
  useEffect(() => {
    try {
      if (localStorage.getItem(PREF) === 'off') setOn(false)
    } catch {
      /* storage blocked: captions stay on */
    }
  }, [])
  const set = (next: boolean) => {
    setOn(next)
    try {
      if (next) localStorage.removeItem(PREF)
      else localStorage.setItem(PREF, 'off')
    } catch {
      /* storage blocked: the choice lasts for this page */
    }
  }
  return [on, set]
}

/**
 * The line being said, over the bottom of the video. `time` reads the player's position in seconds (null before it has one);
 * it is polled once a frame while `running`, and once whenever `moved` changes (a seek while paused). The overlay re-renders
 * only when the cue changes.
 */
export function CaptionOverlay({ cues, time, running, moved = 0 }: { cues: Cue[]; time: () => number | null; running: boolean; moved?: number }) {
  const [cue, setCue] = useState<Cue | null>(null)
  const last = useRef<Cue | null>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const t = time()
      const next = t === null ? null : cueAt(cues, t)
      if (next !== last.current) setCue((last.current = next))
      if (running) raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [cues, time, running, moved])
  return (
    <div className="captions" aria-live="off">
      {cue ? <p className="captions__cue">{cue.text}</p> : null}
    </div>
  )
}

export function CaptionsToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" className="captions-toggle" aria-pressed={on} onClick={() => onChange(!on)}>
      <span aria-hidden>CC</span> Captions {on ? 'on' : 'off'}
    </button>
  )
}
