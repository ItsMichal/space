'use client'

import { useEffect, useRef } from 'react'

/**
 * A soft highlight that follows the pointer over its parent card. Only a transform and an opacity change, so it never
 * repaints the card; one rAF per frame at most; absent for touch and under reduced motion. Decorative.
 */
export function CardGlow() {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    const card = el?.parentElement?.parentElement
    if (!el || !card) return
    if (!matchMedia('(hover: hover)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    let x = 0
    let y = 0
    const paint = () => {
      raf = 0
      el.style.transform = `translate3d(${x - 160}px, ${y - 160}px, 0)`
    }
    const move = (e: PointerEvent) => {
      const r = card.getBoundingClientRect()
      x = e.clientX - r.left
      y = e.clientY - r.top
      el.dataset.on = ''
      if (!raf) raf = requestAnimationFrame(paint)
    }
    const leave = () => {
      delete el.dataset.on
    }
    card.addEventListener('pointermove', move, { passive: true })
    card.addEventListener('pointerleave', leave, { passive: true })
    return () => {
      card.removeEventListener('pointermove', move)
      card.removeEventListener('pointerleave', leave)
      cancelAnimationFrame(raf)
    }
  }, [])
  return (
    <span className="pcard__clip" aria-hidden>
      <i ref={ref} className="pcard__glow" />
    </span>
  )
}
