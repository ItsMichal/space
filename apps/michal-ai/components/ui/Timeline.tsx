'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Globe, FileText, Rocket, SatelliteDish, Users, type LucideIcon } from 'lucide-react'
import { Picture } from '@/components/media/Picture'
import { useStrip } from './useStrip'
import { publishStatus } from './status'
import { formatDate, yearMarks, type TimelineIconName, type TimelineItem } from './timelineData'
import './ui.css'

export type { TimelineItem }

const RULE_OVERSHOOT = 4000 // the rule runs far past both ends, so it always spans the whole strip edge to edge (the strip clips it)
const RAIL_Y = 50 // centre line of the thumbnails (year row above, thumbnail below it)
const TRACK_H = 192

const ICONS: Record<TimelineIconName, LucideIcon> = { satellite: SatelliteDish, globe: Globe, file: FileText, users: Users, rocket: Rocket }

/** A thumbnail tile: the item's picture, or its icon on a quiet tile. */
function Thumb({ it, size, sizes }: { it: TimelineItem; size: 'sm' | 'lg'; sizes: string }) {
  const Icon = ICONS[it.icon ?? 'file']
  return (
    <span className={`tl-thumb tl-thumb--${size}`} data-kind={it.image ? 'image' : 'icon'} aria-hidden={size === 'sm' ? true : undefined}>
      {it.image ? (
        <Picture src={it.image.src} alt={size === 'sm' ? '' : it.image.alt} sizes={sizes} aspect={size === 'sm' ? '1 / 1' : '4 / 3'} focus={it.image.focus} />
      ) : (
        <Icon size={size === 'sm' ? 20 : 28} strokeWidth={1.5} aria-hidden />
      )}
    </span>
  )
}

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
 * A scrubbable timeline: a row of small cards (thumbnail or icon, date, title) threaded on a thin rule; the selected one wears an ink ring.
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

  const paint = useCallback(
    (p: number) => {
      if (track.current) track.current.style.transform = `translate3d(${-(fitsRef.current ? (n - 1) / 2 : p) * pitch}px,0,0)`
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
        <div ref={track} className="tl-track" style={{ transform: `translate3d(${-(fits ? (n - 1) / 2 : start) * pitch}px,0,0)`, height: TRACK_H }}>
          <div className="tl-rule" aria-hidden style={{ left: -RULE_OVERSHOOT, width: L + RULE_OVERSHOOT * 2, top: RAIL_Y }} />
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
                style={{ left: i * pitch, width: pitch }}
                onClick={() => strip.goTo(i, 'tap')}
              >
                <Thumb it={it} size="sm" sizes="48px" />
                <span className="tl-date">{itemDate(it, withDay)}</span>
                <span className="tl-name">{it.label ?? it.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* The current value, announced politely as it changes (by drag, swipe, tap or arrow keys). */}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {itemDate(items[active], withDay)} {items[active].title}
      </p>
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
            <div className="tl-p-media">
              <Thumb it={it} size="lg" sizes="(min-width: 700px) 300px, 90vw" />
            </div>
            <div className="tl-p-body">
              <p className="tl-p-date">
                {it.date ? <time dateTime={it.date}>{itemDate(it, withDay)}</time> : itemDate(it, withDay)}
              </p>
              <h3 className="tl-p-title">{it.title}</h3>
              {it.summary ? <p className="tl-p-sum">{it.summary}</p> : null}
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
            </div>
          </li>
        ))}
      </ol>
      <noscript>
        <style>{`.tl-vp{display:none!important}.tl-panels{display:block!important}.tl-panel,.tl-panel>*{position:static!important;visibility:visible!important;opacity:1!important;translate:none!important;transform:none!important;filter:none!important;animation:none!important}.tl-panel{margin:0 0 32px!important;padding-left:16px;border-left:1.5px solid var(--hairline)}`}</style>
      </noscript>
    </section>
  )
}
