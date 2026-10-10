'use client'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

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
 */
export function Lightbox() {
  const dialog = useRef<HTMLDialogElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [zoomed, setZoomed] = useState(false)

  // Open from any [data-zoom] trigger.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as Element | null)?.closest<HTMLElement>('[data-zoom]')
      if (!btn) return
      e.preventDefault()
      const all = [...document.querySelectorAll<HTMLElement>('[data-zoom]')]
      trigger.current = btn
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = useCallback(() => dialog.current?.close(), [])
  const onClosed = () => {
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

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' && index < items.length - 1) go(index + 1)
    else if (e.key === 'ArrowLeft' && index > 0) go(index - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(items.length - 1)
  }

  const cur = items[index]
  return (
    <dialog ref={dialog} className="lb" aria-label="Image viewer" onClose={onClosed} onKeyDown={onKey} onCancel={() => setZoomed(false)}>
      {open ? (
        <>
          <div ref={strip} className="lb__strip" data-zoomed={zoomed || undefined} onScroll={onScroll} tabIndex={-1}>
            {items.map((it, i) => (
              <div key={i} className="lb__slide" data-zoomed={zoomed && i === index ? '' : undefined} onClick={(e) => e.target === e.currentTarget && close()}>
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
                  onClick={() => i === index && setZoomed((z) => !z)}
                />
              </div>
            ))}
          </div>
          <button type="button" className="lb__btn lb__close lg lg--pill" onClick={close} aria-label="Close image viewer" autoFocus>
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
        </>
      ) : null}
    </dialog>
  )
}
