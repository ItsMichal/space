'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Glass, glass } from '@/components/glass'
import { placePreview } from './previewPlacement'
import './ui.css'
import './preview.css'

export type PreviewData = { title: string; description: string; image?: string; meta?: string }

const DWELL = 480
const LONG_PRESS = 460

/**
 * An internal link with a small glass preview. Pointers: after a short dwell the card grows out of the link along a
 * curve; leaving (or moving to the card) lets it fold back after a beat. Touch: press and hold. Keyboard: focus shows it
 * after a longer pause, Escape dismisses. The card is not focusable and never holds focus; the link works the same
 * with or without it, and the link text is what search engines and screen readers see.
 */
export function PreviewLink({ href, preview, children }: { href: string; preview: PreviewData; children: ReactNode }) {
  const id = useId()
  const a = useRef<HTMLAnchorElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean; ox: number } | null>(null)
  const pressed = useRef(false)
  const suppress = useRef(false)

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  const show = useCallback(() => {
    const el = a.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos(placePreview({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }, { w: 300, h: 150 }, { w: innerWidth, h: innerHeight }))
    setOpen(true)
  }, [])
  const later = (ms: number, fn: () => void) => {
    clear()
    timer.current = setTimeout(fn, ms)
  }
  const hide = useCallback((ms = 160) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(false), ms)
  }, [])

  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const dismiss = (e: PointerEvent) => {
      if (!a.current?.contains(e.target as Node) && !card.current?.contains(e.target as Node)) setOpen(false)
    }
    const scroll = () => setOpen(false)
    window.addEventListener('keydown', key)
    window.addEventListener('pointerdown', dismiss)
    window.addEventListener('scroll', scroll, { passive: true, once: true })
    return () => {
      window.removeEventListener('keydown', key)
      window.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('scroll', scroll)
    }
  }, [open])

  useEffect(() => clear, [])

  return (
    <>
      <Link
        ref={a}
        href={href}
        className="pv-link"
        aria-describedby={open ? id : undefined}
        onPointerEnter={(e) => e.pointerType === 'mouse' && later(DWELL, show)}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'mouse') return
          clear()
          hide()
        }}
        onFocus={() => later(DWELL * 1.6, show)}
        onBlur={() => {
          clear()
          hide(0)
        }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return
          pressed.current = true
          suppress.current = false
          later(LONG_PRESS, () => {
            if (!pressed.current) return
            suppress.current = true
            show()
          })
        }}
        onPointerUp={() => {
          pressed.current = false
          clear()
        }}
        onPointerCancel={() => {
          pressed.current = false
          clear()
        }}
        onContextMenu={(e) => {
          if (suppress.current) e.preventDefault()
        }}
        onClick={(e) => {
          if (suppress.current) {
            e.preventDefault()
            suppress.current = false
          }
        }}
      >
        {children}
      </Link>
      {open && pos && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={card}
              id={id}
              role="tooltip"
              className="pv"
              data-above={pos.above ? '' : undefined}
              style={{ left: pos.x, top: pos.y, ['--ox' as string]: `${pos.ox}px` }}
              onPointerEnter={() => clear()}
              onPointerLeave={() => hide()}
            >
              <Glass as="div" effect={glass.regular} shape={{ cornerRadius: 22 }} className="pv-glass">
                <Link href={href} tabIndex={-1} className="pv-in" aria-hidden>
                  {preview.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="pv-img" src={preview.image} alt="" loading="lazy" decoding="async" />
                  ) : null}
                  <span className="pv-txt">
                    <span className="pv-t">{preview.title}</span>
                    <span className="pv-d">{preview.description}</span>
                    {preview.meta ? <span className="pv-m">{preview.meta}</span> : null}
                  </span>
                </Link>
              </Glass>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
