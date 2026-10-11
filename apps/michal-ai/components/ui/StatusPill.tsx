'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { getServerStatus, getStatus, subscribeStatus } from './status'
import { useReading } from './useReading'
import { makeStroke } from '@space/motion/handStroke'
import './ui.css'

type View = { key: string; title: string; sub?: string; progress: number }

const REST_MS = 2200
const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The nav's second voice, after the Dynamic Island. It lives INSIDE the nav pill: while something is happening (you
 * are reading, or scrubbing a timeline) a slot at the pill's right edge opens on a sampled spring, so the pill itself
 * grows to make room, and folds back when things go still. On phones the pill is already full width, so the slot
 * simply takes the free space between the mark and the menu button (text ellipsised, never clipped mid-glyph).
 * Width is measured from an unscaled ruler (offsetWidth, after fonts load), so transforms never skew it. The text swaps
 * with a staggered settle; a hand-drawn stem along the pill's lower edge fills with progress.
 * Reduced motion: no growth, only a thin progress line at the top edge.
 */
export function StatusSlot({ routeKey }: { routeKey: string }) {
  const entry = useSyncExternalStore(subscribeStatus, getStatus, getServerStatus)
  const reading = useReading(routeKey, REST_MS)
  const [calm, setCalm] = useState(false)
  useEffect(() => setCalm(reduced()), [])

  const view: View | null = useMemo(() => {
    if (entry) return { key: `s:${entry.source}:${entry.title}`, title: entry.title, sub: entry.sub, progress: entry.progress ?? 0 }
    if (reading && reading.started && reading.scrolling && reading.headings.length && reading.section >= 0) {
      const h = reading.headings[reading.section]
      return { key: `r:${h.id}`, title: h.text, sub: reading.headings.length > 1 ? `${reading.section + 1} of ${reading.headings.length}` : undefined, progress: reading.progress }
    }
    if (reading && reading.started && reading.scrolling) return { key: 'r:top', title: 'Reading', progress: reading.progress }
    return null
  }, [entry, reading])

  // Keep the last view while the slot folds away, so the text does not vanish before the shape.
  const [shown, setShown] = useState<View | null>(null)
  useEffect(() => {
    if (view) setShown(view)
  }, [view])

  // Measure the text once per change: offsetWidth ignores transforms, and fonts are awaited so a late swap re-measures.
  const ruler = useRef<HTMLSpanElement>(null)
  const [natural, setNatural] = useState(0)
  useIso(() => {
    const el = ruler.current
    if (!el || !shown) return
    let live = true
    const measure = () => live && setNatural(Math.ceil(el.offsetWidth))
    measure()
    document.fonts?.ready.then(measure)
    return () => {
      live = false
    }
  }, [shown?.key, shown?.sub])

  // Outgoing text
  const [leaving, setLeaving] = useState<View | null>(null)
  const prev = useRef<View | null>(null)
  useEffect(() => {
    if (shown && prev.current && prev.current.key !== shown.key) {
      setLeaving(prev.current)
      const t = setTimeout(() => setLeaving(null), 420)
      prev.current = shown
      return () => clearTimeout(t)
    }
    prev.current = shown
  }, [shown])

  const stroke = useMemo(
    () => makeStroke([0, 1, 2, 3, 4, 5].map((i) => ({ x: i * 48, y: Math.sin(i * 1.7 + 0.4) * 0.9 })), { size: 3.4, seed: 9, wobble: 0.5, tip: 0.1, startWidth: 0.5, density: 48 }),
    []
  )
  const on = !!view
  const cur = view ?? shown
  const p = cur?.progress ?? 0

  if (calm) {
    return on || (reading && reading.started) ? <div aria-hidden className="st-line" style={{ transform: `scaleX(${reading?.progress ?? p})` }} /> : null
  }
  if (!cur) return null
  // Room for the text plus its horizontal breathing; capped so a long heading cannot make the pill huge.
  const w = Math.min(natural + 20, 340)
  return (
    <>
      <span aria-hidden className="st-slot" data-on={on ? '' : undefined} style={{ ['--sw' as string]: `${w}px` }}>
        <span className="st-clip">
          <span className="st-inner">
            {leaving ? (
              <span key={`o:${leaving.key}`} className="st-text st-text--out">
                <span className="st-title">{leaving.title}</span>
                {leaving.sub ? <span className="st-sub"> · {leaving.sub}</span> : null}
              </span>
            ) : null}
            <span key={cur.key} className="st-text st-text--in">
              <span className="st-title">{cur.title}</span>
              {cur.sub ? <span className="st-sub"> · {cur.sub}</span> : null}
            </span>
          </span>
        </span>
      </span>
      {/* Unclipped, off-flow copy of the text, only to be measured. */}
      <span aria-hidden ref={ruler} className="st-ruler">
        <span className="st-text">
          <span className="st-title">{cur.title}</span>
          {cur.sub ? <span className="st-sub"> · {cur.sub}</span> : null}
        </span>
      </span>
      <svg aria-hidden className="st-stem" data-on={on ? '' : undefined} viewBox="0 0 240 6" preserveAspectRatio="none">
        <g transform="translate(0 3)">
          <path d={stroke.d(0, Math.min(1, Math.max(0.05, p)), p > 0.02 && p < 0.99 ? 0.6 : 0)} />
        </g>
      </svg>
    </>
  )
}
