'use client'

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { PageControl } from './PageControl'
import { useStrip } from './useStrip'
import './ui.css'

export type GallerySlide = { key: string; node: ReactNode; caption?: string }

type Props = {
  slides: GallerySlide[]
  label?: string
  /** Auto-advance interval in ms; 0 or omitted disables it. Never runs under reduced motion. */
  autoplayMs?: number
  className?: string
}

const GAP = 14
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Highlights gallery. One large image at a time with its neighbours leaning in from the sides; drag with 1:1 tracking
 * and momentum, a click on a page dot, an arrow key, or the optional auto-advance. Images move at slightly different
 * rates than their frames (parallax), and distant slides quiet down, so the strip reads as depth rather than a row.
 * Without JS it is a native horizontal scroller.
 */
export function Gallery({ slides, label = 'Gallery', autoplayMs = 0, className = '' }: Props) {
  const n = slides.length
  const uid = useId()
  const root = useRef<HTMLDivElement>(null)
  const vp = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLUListElement>(null)
  const items = useRef<(HTMLLIElement | null)[]>([])
  const lay = useRef({ vw: 0, slide: 0, pitch: 0 })
  const [index, setIndex] = useState(0)
  const [js, setJs] = useState(false)
  const [playing, setPlaying] = useState(autoplayMs > 0)
  const [engaged, setEngaged] = useState(false) // finger / focus
  const [visible, setVisible] = useState(true)
  const [hidden, setHidden] = useState(false)
  const [calm, setCalm] = useState(false)

  const measure = useCallback(() => {
    const v = vp.current
    const first = items.current[0]
    if (!v || !first) return
    lay.current = { vw: v.clientWidth, slide: first.offsetWidth, pitch: first.offsetWidth + GAP }
  }, [])

  const paint = useCallback(
    (p: number) => {
      const { vw, slide, pitch } = lay.current
      if (!pitch) return
      if (track.current) track.current.style.transform = `translate3d(${(vw - slide) / 2 - p * pitch}px,0,0)`
      for (let i = 0; i < n; i++) {
        const li = items.current[i]
        if (!li) continue
        const d = i - p
        const a = Math.min(Math.abs(d), 1)
        li.style.opacity = String(1 - 0.5 * a)
        li.style.setProperty('--g-s', String(1 - 0.045 * a))
        li.style.setProperty('--g-x', `${(-d * 22).toFixed(1)}px`)
      }
    },
    [n]
  )

  const strip = useStrip({
    count: n,
    pitch: () => lay.current.pitch || 1,
    initial: 0,
    soft: 0.5,
    onFrame: (p) => paint(p),
    onIndex: (i) => setIndex(i),
    onActive: (a) => setEngaged(a),
  })

  useEffect(() => {
    setJs(true)
    setCalm(reduced())
    measure()
    strip.jump(0)
    const ro = new ResizeObserver(() => {
      measure()
      paint(strip.position)
    })
    if (vp.current) ro.observe(vp.current)
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 })
    if (root.current) io.observe(root.current)
    const vis = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', vis)
    return () => {
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', vis)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const running = playing && !calm && visible && !hidden && !engaged && index < n - 1
  const onFillEnd = () => strip.goTo(clamp(index + 1, 0, n - 1), 'settle')

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') strip.goTo(strip.index + 1, 'key')
    else if (e.key === 'ArrowLeft') strip.goTo(strip.index - 1, 'key')
    else if (e.key === 'Home') strip.goTo(0, 'key')
    else if (e.key === 'End') strip.goTo(n - 1, 'key')
    else return
    e.preventDefault()
    setPlaying(false)
  }

  return (
    <div ref={root} className={`gal ${className}`} data-js={js ? '' : undefined}>
      <div
        ref={vp}
        className="gal-vp"
        role="group"
        aria-roledescription="carousel"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocusCapture={(e) => {
          // Tabbing into an off-screen image brings it to the middle.
          const li = (e.target as HTMLElement).closest('li')
          const i = li ? items.current.indexOf(li as HTMLLIElement) : -1
          if (i >= 0 && i !== strip.index && js) strip.goTo(i, 'settle')
        }}
        onPointerDownCapture={() => setPlaying((p) => (p ? false : p))}
        {...strip.bind}
      >
        <ul ref={track} className="gal-track">
          {slides.map((s, i) => (
            <li
              key={s.key}
              ref={(el) => {
                items.current[i] = el
              }}
              className="gal-slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${n}`}
              aria-hidden={js && Math.abs(i - index) > 1 ? true : undefined}
              inert={js && Math.abs(i - index) > 1 ? true : undefined}
              id={`${uid}-s${i}`}
            >
              <div className="gal-media">{s.node}</div>
              {s.caption ? <p className="gal-cap">{s.caption}</p> : null}
            </li>
          ))}
        </ul>
      </div>
      <div className="gal-ctl">
        <PageControl
          count={n}
          index={index}
          label={`${label} pages`}
          onSelect={(i) => {
            setPlaying(false)
            strip.goTo(i, 'tap')
          }}
          playing={autoplayMs > 0 ? playing : undefined}
          running={running}
          interval={autoplayMs || 6000}
          onToggle={autoplayMs > 0 && !calm ? () => setPlaying((p) => !p) : undefined}
          onFillEnd={onFillEnd}
        />
      </div>
      <noscript>
        <style>{`.gal-vp{overflow-x:auto!important}.gal-track{transform:none!important}.gal-slide{opacity:1!important}.gal-ctl{display:none}`}</style>
      </noscript>
    </div>
  )
}
