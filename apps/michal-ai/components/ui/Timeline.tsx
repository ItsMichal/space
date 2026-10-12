'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useStrip } from './useStrip'
import { publishStatus } from './status'
import { formatDate, yearMarks, type TimelineItem } from './timelineData'
import './ui.css'

export type { TimelineItem }

const PAD = 96 // rail extends this far past the first and last item, so rubber-banding has something to stretch over
const RAIL_Y = 52

type Props = {
  items: readonly TimelineItem[]
  /** Accessible name, e.g. "Experience". */
  label: string
  /** Pixels between items (the minimum when `fit` is on). */
  pitch?: number
  /** When every item fits across the available width at `pitch` or more, spread them to fill it and stop scrubbing (tap or arrow keys still change the item). */
  fit?: boolean
  /** Item focused on first paint (server and client agree). Default: the last. */
  initial?: number
  /** When given, scrubbing publishes "<statusLabel> · <item title>" to the nav's status pill. */
  statusLabel?: string
  /** Show the full date (with day) rather than month and year. */
  withDay?: boolean
  className?: string
}

const itemDate = (it: TimelineItem, withDay: boolean) => it.dateLabel ?? (it.date ? formatDate(it.date, withDay) : '')
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * A scrubbable timeline: a thin straight rule with a small tick for each item and a clear marker for where you are.
 * Drag, swipe, scroll sideways, press arrow keys, or tap an item. Releases carry momentum and settle on the nearest
 * item. All details are in the HTML (stacked, cross-fading), and without JS the strip hides and the details read as a
 * plain vertical list.
 */
export function Timeline({ items, label, pitch: basePitch = 120, fit = false, initial, statusLabel, withDay = false, className = '' }: Props) {
  const n = items.length
  const [layout, setLayout] = useState({ pitch: basePitch, fits: false })
  const { pitch, fits } = layout
  const fitsRef = useRef(false)
  fitsRef.current = fits
  const start = clamp(initial ?? n - 1, 0, n - 1)
  const uid = useId()
  const [active, setActive] = useState(start)
  const vp = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeRef = useRef(start)

  const L = (n - 1) * pitch
  const marks = useMemo(() => yearMarks(items), [items])
  const W = L + PAD * 2
  const cursorRef = useRef<HTMLSpanElement>(null)
  const ticks = useRef<(HTMLElement | null)[]>([])

  const paint = useCallback(
    (p: number) => {
      if (track.current) track.current.style.transform = `translate3d(${-(fitsRef.current ? (n - 1) / 2 : p) * pitch}px,0,0)`
      // The marker rides the rule at the current position (it stays centred while the rule slides under it when scrubbing).
      if (cursorRef.current) cursorRef.current.style.transform = `translate3d(${clamp(p, 0, n - 1) * pitch}px,0,0)`
      for (let i = 0; i < n; i++) {
        const d = Math.abs(i - p)
        const s = Math.min(d, 2.4) / 2.4
        const o = 1 - 0.62 * (s * s * (3 - 2 * s))
        const t = tabs.current[i]
        if (t) t.style.opacity = String(o)
        const k = ticks.current[i]
        if (k) k.style.opacity = String(0.35 + 0.65 * o)
      }
    },
    [n, pitch]
  )

  const publish = useCallback(
    (i: number) => {
      if (!statusLabel) return
      publishStatus('timeline', { priority: 10, title: items[i].title, sub: statusLabel, progress: n > 1 ? i / (n - 1) : 1 })
    },
    [items, n, statusLabel]
  )

  const strip = useStrip({
    count: n,
    pitch: () => pitch,
    initial: start,
    onFrame: (p) => {
      paint(p)
    },
    onIndex: (i, by) => {
      activeRef.current = i
      setActive(i)
      publish(i)
      if (by !== 'drag' && document.activeElement?.getAttribute('role') === 'tab') tabs.current[i]?.focus({ preventScroll: true })
      if (by === 'drag' && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(3)
    },
    onActive: (a) => {
      if (!statusLabel) return
      if (idleTimer.current) clearTimeout(idleTimer.current)
      if (a) publish(activeRef.current)
      else idleTimer.current = setTimeout(() => publishStatus('timeline', null), 1800)
    },
  })

  // Fit: measure the strip once the face is loaded and whenever it resizes. Everything fits -> spread and rest.
  useLayoutEffect(() => {
    if (!fit) return
    const el = vp.current
    if (!el) return
    const measure = () => {
      const W = el.clientWidth
      const each = Math.floor(W / n)
      const next = each >= basePitch ? { pitch: Math.min(each, 240), fits: true } : { pitch: basePitch, fits: false }
      setLayout((cur) => (cur.pitch === next.pitch && cur.fits === next.fits ? cur : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit, n, basePitch])

  // Re-seat the strip whenever the layout changes, and on first paint.
  useEffect(() => {
    strip.jump(activeRef.current)
    paint(activeRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitch, fits])

  useEffect(() => {
    const timer = idleTimer.current
    return () => {
      if (timer) clearTimeout(timer)
      publishStatus('timeline', null)
    }
  }, [])

  const onKeyDown = (e: KeyboardEvent) => {
    const i = strip.index
    let to = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = i + 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = i - 1
    else if (e.key === 'Home') to = 0
    else if (e.key === 'End') to = n - 1
    if (to < 0) return
    e.preventDefault()
    strip.goTo(clamp(to, 0, n - 1), 'key')
  }

  return (
    <section className={`tl ${className}`} aria-label={label} style={{ ['--tl-pitch' as string]: `${pitch}px` }} data-fit={fits ? '' : undefined}>
      <div ref={vp} className={`tl-vp${fits ? ' tl-vp--fit' : ''}`} {...(fits ? {} : strip.bind)}>
        <div ref={track} className="tl-track" style={{ transform: `translate3d(${-(fits ? (n - 1) / 2 : start) * pitch}px,0,0)`, height: 132 }}>
          <div className="tl-rule" aria-hidden style={{ left: -PAD, width: W, top: RAIL_Y }} />
          <div className="tl-ticks" aria-hidden style={{ top: RAIL_Y }}>
            {items.map((it, i) => (
              <i
                key={it.id}
                ref={(el) => {
                  ticks.current[i] = el
                }}
                className="tl-tick"
                style={{ left: i * pitch }}
              />
            ))}
            <span ref={cursorRef} className="tl-cursor" style={{ transform: `translate3d(${start * pitch}px,0,0)` }} />
          </div>
          {marks.map((m) => (
            <span key={m.year} className="tl-year" aria-hidden style={{ left: m.index * pitch }}>
              {m.year}
            </span>
          ))}
          <div role="tablist" aria-label={label} aria-orientation="horizontal" onKeyDown={onKeyDown} className="tl-tabs">
            {items.map((it, i) => (
              <button
                key={it.id}
                ref={(el) => {
                  tabs.current[i] = el
                }}
                type="button"
                role="tab"
                id={`${uid}-t${i}`}
                aria-selected={i === active}
                aria-controls={`${uid}-p${i}`}
                tabIndex={i === active ? 0 : -1}
                className="tl-tab"
                style={{ left: i * pitch, width: pitch, opacity: i === start ? 1 : 0.7 }}
                onClick={() => strip.goTo(i, 'tap')}
              >
                <span className="tl-date">{itemDate(it, withDay)}</span>
                <span className="tl-name">{it.label ?? it.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <ol className="tl-panels">
        {items.map((it, i) => (
          <li
            key={it.id}
            id={`${uid}-p${i}`}
            role="tabpanel"
            aria-labelledby={`${uid}-t${i}`}
            className="tl-panel"
            data-pos={i === active ? 'active' : i < active ? 'before' : 'after'}
          >
            <p className="tl-p-date">
              {it.date ? <time dateTime={it.date}>{itemDate(it, withDay)}</time> : itemDate(it, withDay)}
            </p>
            <h3 className="tl-p-title">{it.title}</h3>
            {it.summary ? <p className="tl-p-sum">{it.summary}</p> : null}
            {it.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="tl-p-img" src={it.image.src} alt={it.image.alt} loading="lazy" decoding="async" />
            ) : null}
            {it.link || it.source ? (
              <p className="tl-p-links">
                {it.link ? (
                  <a href={it.link.href} className="tl-link">
                    {it.link.label}
                  </a>
                ) : null}
                {it.source ? (
                  <a href={it.source.href} className="tl-link tl-link--quiet" target="_blank" rel="noopener noreferrer">
                    {it.source.label}
                  </a>
                ) : null}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      <noscript>
        <style>{`.tl-vp{display:none!important}.tl-panels{display:block!important}.tl-panel,.tl-panel>*{position:static!important;visibility:visible!important;opacity:1!important;translate:none!important;transform:none!important;filter:none!important;animation:none!important}.tl-panel{margin:0 0 32px!important;padding-left:16px;border-left:1.5px solid var(--hairline)}`}</style>
      </noscript>
    </section>
  )
}
