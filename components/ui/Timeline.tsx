'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createSpring, type Spring } from '@/lib/motion/spring'
import { makeStroke, type Pt } from '@/lib/motion/handStroke'
import { bladePath, leafPath } from './craft/stroke'
import { useStrip } from './useStrip'
import { publishStatus } from './status'
import { formatDate, yearMarks, type TimelineItem } from './timelineData'
import './ui.css'

export type { TimelineItem }

const PAD = 96 // rail extends this far past the first and last item, so rubber-banding has something to stretch over
const RAIL_Y = 46
const HISTORY = 40

type Props = {
  items: readonly TimelineItem[]
  /** Accessible name, e.g. "Experience". */
  label: string
  /** Pixels between items. */
  pitch?: number
  /** Item focused on first paint (server and client agree). Default: the last. */
  initial?: number
  /** When given, scrubbing publishes "<statusLabel> · <item title>" to the nav's status pill. */
  statusLabel?: string
  /** Show the full date (with day) rather than month and year. */
  withDay?: boolean
  className?: string
}

const itemDate = (it: TimelineItem, withDay: boolean) => it.dateLabel ?? (it.date ? formatDate(it.date, withDay) : '')
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const r2 = (v: number) => Math.round(v * 100) / 100
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * A scrubbable timeline. The rail is a hand-drawn line with budding leaf marks; a moss stem grows from the first
 * item to wherever you are. Drag, swipe, scroll sideways, press arrow keys, or tap an item. Releases carry momentum and
 * settle on the nearest item. All details are in the HTML (stacked, cross-fading), and without JS the strip hides and the
 * details read as a plain vertical list.
 */
export function Timeline({ items, label, pitch = 120, initial, statusLabel, withDay = false, className = '' }: Props) {
  const n = items.length
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
  const geometry = useMemo(() => {
    const W = L + PAD * 2
    // One hand stroke runs the whole rail. The quiet pencil line and the growing moss stem are the same stroke, so the
    // stem always sits exactly on the line it grows along; buds and blades are placed on it by arclength.
    const ctrl: Pt[] = []
    const steps = Math.max(4, Math.round(W / 70))
    for (let i = 0; i <= steps; i++) ctrl.push({ x: (i / steps) * W, y: Math.sin(i * 1.3 + 0.6) * 2.4 })
    const stroke = makeStroke(ctrl, { size: 4.4, seed: 5, wobble: 1.1, tip: 0.05, startWidth: 0.5, density: Math.max(60, Math.round(W / 6)) })
    const uOf = (x: number) => clamp(x / W, 0, 1)
    const blades = [] as { x: number; y: number; d: string; seed: number }[]
    for (let i = 0; i < n - 1; i++)
      for (let k = 1; k <= 3; k++) {
        const seed = i * 7 + k
        const x = PAD + (i + k / 4) * pitch
        blades.push({ x, y: r2(stroke.at(uOf(x)).y), d: bladePath(seed).d, seed })
      }
    const buds = items.map((_, i) => {
      const x = PAD + i * pitch
      return { x, y: r2(stroke.at(uOf(x)).y) }
    })
    return { W, stroke, uOf, rail: stroke.d(0, 1, -1.8), blades, buds }
  }, [L, n, pitch, items])

  // ---- animation state (all imperative; React only owns which item is active)
  const fx = useRef<{
    open: Spring[]
    lean: Spring
    hist: number[]
    p: number
    prevP: number
    raf: number
    last: number
    els: { buds: SVGPathElement[]; blades: SVGPathElement[]; stem: SVGPathElement | null; tip: SVGGElement | null } | null
    dragging: boolean
  }>({ open: [], lean: createSpring(0, { response: 0.42, damping: 0.55 }), hist: [], p: start, prevP: start, raf: 0, last: 0, els: null, dragging: false })

  const paint = useCallback(
    (p: number) => {
      const f = fx.current
      if (track.current) track.current.style.transform = `translate3d(${-p * pitch}px,0,0)`
      const x = PAD + clamp(p, 0, n - 1) * pitch
      const head = geometry.uOf(x)
      f.els?.stem?.setAttribute('d', geometry.stroke.d(0, head, Math.max(0, Math.min(1, Math.abs(f.p - f.prevP) * 6)) * 1.4))
      for (let i = 0; i < n; i++) {
        const t = tabs.current[i]
        if (t) {
          const d = Math.abs(i - p)
          const s = Math.min(d, 2.4) / 2.4
          t.style.opacity = String(1 - 0.62 * (s * s * (3 - 2 * s)))
        }
      }
    },
    [n, pitch, geometry]
  )

  const fxStep = useCallback(
    (now: number) => {
      const f = fx.current
      const dt = Math.min((now - f.last) / 1000, 1 / 20)
      f.last = now
      const els = f.els
      if (!els) return
      const calm = reducedMotion()
      const v = dt > 0 ? (f.p - f.prevP) / dt : 0 // items/s
      f.prevP = f.p
      // The leaf tip leans into the direction of travel and swings back with a little overshoot.
      f.lean.to(calm ? 0 : clamp(-v * 5, -22, 22))
      const lean = f.lean.step(dt).value
      f.hist.unshift(lean)
      if (f.hist.length > HISTORY) f.hist.pop()
      let busy = Math.abs(lean) > 0.05 || Math.abs(f.lean.state.velocity) > 0.05 || Math.abs(v) > 0.01
      for (let i = 0; i < n; i++) {
        const sp = f.open[i]
        const want = i === activeRef.current ? 1 : 0
        sp.configure(want ? { response: 0.62, damping: 0.62 } : { response: 0.3, damping: 1 })
        sp.to(want)
        const o = sp.step(dt).value
        if (Math.abs(sp.state.value - want) > 0.002 || Math.abs(sp.state.velocity) > 0.002) busy = true
        const bud = els.buds[i]
        if (bud) {
          // Closed buds are small, tilted and quiet; the focused one unfurls with a hint of overshoot. Neighbours sway with a delay
          // that grows with distance from the finger, so the lean travels along the rail like wind through grass.
          const delay = Math.min(HISTORY - 1, Math.round(Math.abs(i - f.p) * 2.5))
          const sway = (f.hist[delay] ?? 0) * 0.6
          const sc = 0.62 + 0.5 * o
          const rot = -18 * (1 - Math.min(o, 1.2)) + sway
          bud.style.transform = `translate(${geometry.buds[i].x}px,${geometry.buds[i].y}px) rotate(${rot}deg) scale(${sc})`
          const m = clamp(o, 0, 1) * 100
          bud.style.color = `color-mix(in srgb, var(--accent) ${m}%, var(--ink-faint))`
          bud.style.opacity = String(0.55 + 0.45 * clamp(o, 0, 1))
        }
      }
      for (let j = 0; j < els.blades.length; j++) {
        const b = els.blades[j]
        const bx = Number(b.dataset.x)
        const d2 = Math.min(HISTORY - 1, Math.max(0, Math.round(Math.abs((bx - PAD) / pitch - f.p) * 2.5)))
        const a = (f.hist[d2] ?? 0) * (0.5 + Number(b.dataset.k))
        const near = clamp(1 - Math.abs((bx - PAD) / pitch - f.p) / 2.2, 0, 1)
        b.style.transform = `translate(${bx}px,${Number(b.dataset.y)}px) rotate(${a}deg) scaleY(${0.8 + near * 0.35})`
        b.style.opacity = String(0.35 + near * 0.4)
      }
      // growing tip of the stem
      if (els.tip) {
        const tx = PAD + clamp(f.p, 0, n - 1) * pitch
        const grow = clamp(f.p / 0.35, 0, 1)
        const tp = geometry.stroke.at(geometry.uOf(tx))
        els.tip.style.transform = `translate(${tp.x}px,${tp.y}px) rotate(${-60 + lean * 1.4}deg) scale(${grow})`
      }
      if (busy) f.raf = requestAnimationFrame(fxStep)
      else f.raf = 0
    },
    [n, pitch, geometry]
  )

  const fxKick = useCallback(() => {
    const f = fx.current
    if (!f.raf) {
      f.last = performance.now()
      f.raf = requestAnimationFrame(fxStep)
    }
  }, [fxStep])

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
    onFrame: (p, _v, dragging) => {
      const f = fx.current
      f.p = p
      f.dragging = dragging
      paint(p)
      fxKick()
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

  // First paint: hand the DOM to the imperative layer.
  useEffect(() => {
    const svg = track.current?.querySelector('svg')
    if (!svg) return
    const f = fx.current
    f.open = items.map((_, i) => createSpring(i === start ? 1 : 0, { response: 0.5, damping: 0.7 }))
    f.els = {
      buds: Array.from(svg.querySelectorAll<SVGPathElement>('[data-bud]')),
      blades: Array.from(svg.querySelectorAll<SVGPathElement>('[data-blade]')),
      stem: svg.querySelector('[data-stem]'),
      tip: svg.querySelector('[data-tip]'),
    }
    strip.jump(start)
    paint(start)
    f.prevP = start
    f.last = performance.now()
    fxStep(f.last)
    const timer = idleTimer.current
    return () => {
      cancelAnimationFrame(f.raf)
      f.raf = 0
      if (timer) clearTimeout(timer)
      publishStatus('timeline', null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <section className={`tl ${className}`} aria-label={label} style={{ ['--tl-pitch' as string]: `${pitch}px` }}>
      <div ref={vp} className="tl-vp" {...strip.bind}>
        <div ref={track} className="tl-track" style={{ transform: `translate3d(${-start * pitch}px,0,0)`, height: 132 }}>
          <svg className="tl-svg" width={geometry.W} height={RAIL_Y + 14} style={{ left: -PAD }} aria-hidden focusable="false">
            <g transform={`translate(0 ${RAIL_Y})`}>
              <path className="tl-rail" d={geometry.rail} />
              {geometry.blades.map((b, j) => (
                <path key={j} data-blade data-x={b.x} data-y={b.y} data-k={(b.seed % 3) / 3} className="tl-blade" d={b.d} style={{ transform: `translate(${b.x}px,${b.y}px)` }} />
              ))}
              <path data-stem className="tl-stem" d={geometry.stroke.d(0, geometry.uOf(PAD + start * pitch))} />
              <g data-tip className="tl-tip" style={{ transform: `translate(${PAD + start * pitch}px,${geometry.buds[start].y}px) rotate(-60deg)` }}>
                <path d={leafPath(15, 0.4, 0.34)} />
              </g>
              {items.map((it, i) => (
                <path
                  key={it.id}
                  data-bud
                  className="tl-bud"
                  d={leafPath(15, i % 2 ? 0.25 : -0.25, 0.4 + (i % 3) * 0.04)}
                  style={{
                    transform: `translate(${geometry.buds[i].x}px,${geometry.buds[i].y}px) ${i === start ? 'rotate(0deg) scale(1.12)' : 'rotate(-18deg) scale(0.62)'}`,
                    color: i === start ? 'var(--accent)' : 'var(--ink-faint)',
                  }}
                />
              ))}
            </g>
          </svg>
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
        <style>{`.tl-vp{display:none!important}.tl-panels{display:block!important}.tl-panel{position:static!important;visibility:visible!important;opacity:1!important;translate:none!important;transform:none!important;margin:0 0 32px!important;padding-left:16px;border-left:1.5px solid var(--hairline)}`}</style>
      </noscript>
    </section>
  )
}
