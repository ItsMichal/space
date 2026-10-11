'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Glass, glass, type GlassNamespace } from '@/components/glass'
import { getServerStatus, getStatus, subscribeStatus } from './status'
import { useReading } from './useReading'
import { stemPath } from './craft/stroke'
import './ui.css'

type View = { key: string; title: string; sub?: string; progress: number }

const REST_MS = 2200
const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The nav's second voice, after the Dynamic Island: a glass capsule that bulges out of the pill while something is
 * happening (you are reading, or scrubbing a timeline) and folds back in when things go still. It sits in the same
 * GlassEffectContainer as the pill, so the two shapes merge at the seam while it grows. Width follows the text with a
 * spring that overshoots a hair; the text swaps with a staggered settle; a hand-drawn stem fills with progress.
 * Reduced motion: no capsule, only a thin progress line at the top edge.
 */
export function StatusPill({ ns, routeKey }: { ns: GlassNamespace; routeKey: string }) {
  const entry = useSyncExternalStore(subscribeStatus, getStatus, getServerStatus)
  const reading = useReading(routeKey, REST_MS)
  const [calm, setCalm] = useState(false)
  useEffect(() => setCalm(reduced()), [])

  const view: View | null = useMemo(() => {
    if (entry) return { key: `s:${entry.source}:${entry.title}`, title: entry.title, sub: entry.sub, progress: entry.progress ?? 0 }
    if (reading && reading.started && reading.scrolling && reading.headings.length && reading.section >= 0) {
      const h = reading.headings[reading.section]
      return { key: `r:${h.id}`, title: h.text, sub: `${reading.section + 1} of ${reading.headings.length}`, progress: reading.progress }
    }
    if (reading && reading.started && reading.scrolling) return { key: 'r:top', title: 'Reading', progress: reading.progress }
    return null
  }, [entry, reading])

  // Keep the last view around while the capsule folds away, so the text does not vanish before the shape.
  const [shown, setShown] = useState<View | null>(null)
  const [mounted, setMounted] = useState(false)
  const lastView = useRef<View | null>(null)
  if (view) lastView.current = view
  useEffect(() => {
    if (view) {
      setMounted(true)
      setShown(view)
      return
    }
    const t = setTimeout(() => setMounted(false), 1000)
    return () => clearTimeout(t)
  }, [view])

  // Width follows content.
  const inner = useRef<HTMLSpanElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  const first = useRef(true)
  useIso(() => {
    const el = inner.current
    if (!el || !shown) return
    const w = Math.ceil(el.getBoundingClientRect().width) + 36
    setWidth(w)
  }, [shown?.key, shown?.sub, mounted])

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

  const stem = useMemo(() => stemPath(240, { seed: 9, base: 2.6, tip: 0.8, sway: 0.8 }), [])
  const visible = !!view
  const p = (view ?? lastView.current)?.progress ?? 0

  if (calm) {
    return visible || (reading && reading.started) ? (
      <div aria-hidden className="st-line" style={{ transform: `scaleX(${reading?.progress ?? p})` }} />
    ) : null
  }
  if (!mounted || !shown) return null
  const cur = visible ? view! : shown
  void first
  return (
    <Glass
      as="div"
      aria-hidden
      effect={glass.regular}
      shape="capsule"
      id="status"
      namespace={ns}
      transition="materialize"
      className={`st pointer-events-none${visible ? ' st--on' : ''}`}
      style={{ width: width ?? undefined }}
    >
      <span className="st-clip">
        <span ref={inner} className="st-inner">
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
      <svg className="st-stem" viewBox="0 0 240 6" preserveAspectRatio="none" aria-hidden>
        <defs>
          <clipPath id="st-clip">
            <rect x="0" y="0" height="6" style={{ width: `${Math.max(0.02, p) * 240}px`, transition: 'width 520ms var(--ui-settle)' }} />
          </clipPath>
        </defs>
        <g transform="translate(0 3)">
          <path d={stem} clipPath="url(#st-clip)" />
        </g>
      </svg>
    </Glass>
  )
}
