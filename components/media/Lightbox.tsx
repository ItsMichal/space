'use client'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { project, rubberBand, SPRING_MOMENTUM, SPRING_SOFT } from '@/lib/motion/spring'
import { useSpring } from '@/lib/motion/useSpring'

type Item = { src: string; srcSet?: string; w?: number; h?: number; alt: string; caption?: string; color?: string }

const read = (el: HTMLElement): Item => ({
  src: el.dataset.zoomSrc ?? '',
  srcSet: el.dataset.zoomSrcset,
  w: el.dataset.zoomW ? Number(el.dataset.zoomW) : undefined,
  h: el.dataset.zoomH ? Number(el.dataset.zoomH) : undefined,
  alt: el.querySelector('img')?.getAttribute('alt') ?? '',
  caption: el.dataset.zoomCaption,
  color: el.dataset.zoomColor,
})

/**
 * Page-level image viewer. Any `[data-zoom]` button on the page opens it (event delegation, so server-rendered
 * pictures need no client code). Built on a native modal <dialog>: focus is trapped and restored, Esc closes,
 * the page behind is inert. Slides are a CSS scroll-snap strip, so swiping is native and 60fps; tapping an image
 * toggles a 2.5x pan-able zoom, and the page's own pinch-zoom still works (viewport scaling is never disabled).
 *
 * Motion is fluid: the image grows from (and returns to) its thumbnail on a velocity-aware spring, a vertical drag
 * tracks the finger 1:1 and on release projects momentum to decide dismiss vs. stay, and closing can begin while
 * opening is still in flight (the spring retargets from its current value and velocity).
 */
export function Lightbox() {
  const dialog = useRef<HTMLDialogElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const triggers = useRef<HTMLElement[]>([])
  const bgEl = useRef<HTMLDivElement>(null)
  const uiEl = useRef<HTMLDivElement>(null)
  const closing = useRef(false)
  const pv = useRef(0) // openness 0..1
  const yv = useRef(0) // vertical drag offset, px
  const fromRect = useRef<{ dx: number; dy: number; s: number } | null>(null)
  const drag = useRef<{ id: number; x: number; y: number; py: number; t: number; vy: number; live: boolean } | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [zoomed, setZoomed] = useState(false)

  const apply = useCallback(() => {
    const p = pv.current
    const y = yv.current
    const pull = Math.min(Math.abs(y) / 400, 0.6)
    if (bgEl.current) bgEl.current.style.opacity = String(p * (1 - pull))
    if (uiEl.current) uiEl.current.style.opacity = String(Math.max(0, p * (1 - Math.min(Math.abs(y) / 120, 1))))
    const img = strip.current?.querySelector<HTMLElement>('.lb__slide[data-cur] img')
    if (!img) return
    const f = fromRect.current
    if (p >= 1 && y === 0) {
      img.style.transform = ''
      img.style.opacity = ''
      return
    }
    const s0 = f ? f.s : 0.96
    const scale = (s0 + (1 - s0) * p) * (1 - Math.min(Math.abs(y) / 1500, 0.15) * p)
    const tx = f ? f.dx * (1 - p) : 0
    const ty = (f ? f.dy * (1 - p) : 0) + y * p
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
    img.style.opacity = f ? '' : String(Math.min(1, p * 1.4))
  }, [])

  const open_ = useSpring(
    0,
    (v) => {
      pv.current = v
      apply()
      if (v <= 0 && closing.current) dialog.current?.close()
    },
    SPRING_SOFT
  )
  const drag_ = useSpring(
    0,
    (v) => {
      yv.current = v
      apply()
    },
    SPRING_SOFT
  )

  // Open from any [data-zoom] trigger.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as Element | null)?.closest<HTMLElement>('[data-zoom]')
      if (!btn) return
      e.preventDefault()
      const all = [...document.querySelectorAll<HTMLElement>('[data-zoom]')]
      trigger.current = btn
      triggers.current = all
      closing.current = false
      setItems(all.map(read))
      setIndex(all.indexOf(btn))
      setZoomed(false)
      setOpen(true)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      document.documentElement.classList.add('lb-open')
      const s = strip.current
      if (s) s.scrollTo({ left: index * s.clientWidth, behavior: 'instant' as ScrollBehavior })
      // Grow from the thumbnail: measure where it is and where the image will rest, then spring 0 -> 1.
      drag_.set(0)
      fromRect.current = measureFrom(index)
      open_.set(0)
      open_.configure(SPRING_SOFT)
      open_.to(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  /** Where the thumbnail sits relative to the resting image (centre offset and uniform scale), if it is on screen. */
  const measureFrom = (i: number) => {
    const img = strip.current?.querySelector<HTMLElement>(`.lb__slide:nth-child(${i + 1}) img`)
    const thumb = triggers.current[i]?.querySelector('img')
    if (!img || !thumb) return null
    const a = img.getBoundingClientRect()
    const b = thumb.getBoundingClientRect()
    const onScreen = b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth
    if (!onScreen || !a.width || !b.width) return null
    return { dx: b.left + b.width / 2 - (a.left + a.width / 2), dy: b.top + b.height / 2 - (a.top + a.height / 2), s: b.width / a.width }
  }

  /** Begin closing at any moment; works mid-open because the spring retargets from where it is. */
  const close = useCallback(
    (velocity?: number) => {
      if (!dialog.current?.open) return
      closing.current = true
      fromRect.current = measureFrom(index)
      open_.configure(velocity ? SPRING_MOMENTUM : SPRING_SOFT)
      open_.to(0, velocity)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index]
  )
  const onClosed = () => {
    closing.current = false
    pv.current = 0
    yv.current = 0
    drag_.set(0)
    document.documentElement.classList.remove('lb-open')
    setOpen(false)
    setZoomed(false)
    trigger.current?.focus({ preventScroll: true })
  }

  const go = useCallback((to: number) => {
    const s = strip.current
    if (!s) return
    setZoomed(false)
    s.scrollTo({ left: to * s.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' as ScrollBehavior : 'smooth' })
  }, [])

  const onScroll = () => {
    const s = strip.current
    if (!s || !s.clientWidth) return
    const i = Math.round(s.scrollLeft / s.clientWidth)
    if (i !== index) {
      setIndex(i)
      setZoomed(false)
    }
  }

  // Vertical drag: follows the finger from the first frame once the direction is clear, then releases with momentum.
  const onDown = (e: React.PointerEvent, i: number) => {
    if (zoomed || i !== index || (e.pointerType === 'mouse' && e.button !== 0)) return
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, py: e.clientY, t: e.timeStamp, vy: 0, live: false }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.live) {
      if (Math.abs(dy) < 4 && Math.abs(dx) < 4) return
      if (Math.abs(dx) > Math.abs(dy)) {
        drag.current = null // horizontal: native swipe between slides
        return
      }
      d.live = true
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    }
    const a = Math.abs(dy)
    const y = a <= 160 ? dy : Math.sign(dy) * (160 + rubberBand(a - 160, 240))
    const dt = Math.max(1, e.timeStamp - d.t)
    d.vy = 0.5 * d.vy + 0.5 * (((e.clientY - d.py) / dt) * 1000)
    d.py = e.clientY
    d.t = e.timeStamp
    drag_.set(y)
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d || !d.live) return
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
    const vy = d.vy
    if (Math.abs(project(yv.current, vy)) > 180) {
      closing.current = true
      fromRect.current = measureFrom(index)
      open_.configure(SPRING_MOMENTUM)
      open_.to(0, -Math.abs(vy) / 800)
    } else {
      drag_.configure(Math.abs(vy) > 300 ? SPRING_MOMENTUM : SPRING_SOFT)
      drag_.to(0, vy)
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' && index < items.length - 1) go(index + 1)
    else if (e.key === 'ArrowLeft' && index > 0) go(index - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(items.length - 1)
  }

  const cur = items[index]
  return (
    <dialog ref={dialog} className="lb" aria-label="Image viewer" onClose={onClosed} onKeyDown={onKey} onCancel={(e) => (e.preventDefault(), setZoomed(false), close())}>
      {open ? (
        <>
          <div ref={bgEl} className="lb__bg" aria-hidden />
          <div ref={strip} className="lb__strip" data-zoomed={zoomed || undefined} onScroll={onScroll} tabIndex={-1}>
            {items.map((it, i) => (
              <div key={i} className="lb__slide" data-cur={i === index ? '' : undefined} data-zoomed={zoomed && i === index ? '' : undefined} onClick={(e) => e.target === e.currentTarget && close()}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.src}
                  srcSet={it.srcSet}
                  sizes={zoomed && i === index ? '250vw' : '100vw'}
                  width={it.w}
                  height={it.h}
                  alt={it.alt}
                  loading={Math.abs(i - index) <= 1 ? 'eager' : 'lazy'}
                  decoding="async"
                  draggable={false}
                  style={{ backgroundColor: it.color }}
                  onClick={() => i === index && !drag.current?.live && setZoomed((z) => !z)}
                  onPointerDown={(e) => onDown(e, i)}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                />
              </div>
            ))}
          </div>
          <div ref={uiEl} className="lb__ui">
          <button type="button" className="lb__btn lb__close lg lg--pill" onClick={() => close()} aria-label="Close image viewer" autoFocus>
            <X size={20} strokeWidth={1.5} aria-hidden />
          </button>
          {items.length > 1 ? (
            <>
              <button type="button" className="lb__btn lb__nav lb__prev lg lg--pill" disabled={index === 0} onClick={() => go(index - 1)} aria-label="Previous image">
                <ChevronLeft size={20} strokeWidth={1.5} aria-hidden />
              </button>
              <button type="button" className="lb__btn lb__nav lb__next lg lg--pill" disabled={index === items.length - 1} onClick={() => go(index + 1)} aria-label="Next image">
                <ChevronRight size={20} strokeWidth={1.5} aria-hidden />
              </button>
            </>
          ) : null}
          <div className="lb__bar" aria-live="polite">
            <p className="lb__count">
              {index + 1} / {items.length} · {zoomed ? 'drag to pan, tap to fit' : 'tap to zoom'}
            </p>
            {cur?.caption ? <p className="lb__caption">{cur.caption}</p> : null}
          </div>
          </div>
        </>
      ) : null}
    </dialog>
  )
}
