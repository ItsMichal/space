'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createSpring, isSettled } from '@/lib/motion/spring'
import './ui.css'
import './disclosure.css'

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A soft expanding section. The height is a critically damped spring driven from JS, so pressing again halfway through
 * reverses from the current height and velocity instead of restarting; the caret turns with a small overshoot and the
 * content rises into place a beat after the box opens. The content is always in the HTML (collapsed with CSS, forced
 * open without JavaScript), so search engines and no-JS readers get all of it.
 */
export function Disclosure({ summary, children, defaultOpen = false }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const id = useId()
  const [open, setOpen] = useState(defaultOpen)
  const [js, setJs] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const spring = useRef(createSpring(defaultOpen ? 1 : 0, { response: 0.5, damping: 1 }))
  const raf = useRef(0)
  const last = useRef(0)

  const paint = useCallback((t: number) => {
    const b = box.current
    const i = inner.current
    if (!b || !i) return
    const h = i.scrollHeight
    b.style.height = `${Math.max(0, t) * h}px`
    b.style.setProperty('--d-t', String(Math.min(1, Math.max(0, t))))
  }, [])

  const loop = useCallback(
    (now: number) => {
      const dt = Math.min((now - last.current) / 1000, 1 / 20)
      last.current = now
      const s = spring.current.step(dt)
      paint(s.value)
      if (isSettled(s, 0.001)) {
        spring.current.set(s.target)
        paint(s.target)
        if (box.current && s.target === 1) box.current.style.height = 'auto'
        raf.current = 0
      } else raf.current = requestAnimationFrame(loop)
    },
    [paint]
  )

  useIso(() => {
    setJs(true)
    paint(spring.current.state.value)
    if (spring.current.state.value === 1 && box.current) box.current.style.height = 'auto'
  }, [paint])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const toggle = () => {
    const next = !open
    setOpen(next)
    const s = spring.current
    // freeze 'auto' into pixels so the spring can take over from the real height
    if (box.current && box.current.style.height === 'auto') paint(s.state.value)
    if (reduced()) {
      s.set(next ? 1 : 0)
      paint(next ? 1 : 0)
      if (next && box.current) box.current.style.height = 'auto'
      return
    }
    s.configure(next ? { response: 0.55, damping: 0.9 } : { response: 0.45, damping: 1 })
    s.to(next ? 1 : 0)
    if (!raf.current) {
      last.current = performance.now()
      raf.current = requestAnimationFrame(loop)
    }
  }

  return (
    <div className="dc" data-open={open ? '' : undefined} data-js={js ? '' : undefined}>
      <button type="button" className="dc-btn" aria-expanded={open} aria-controls={id} onClick={toggle}>
        <span className="dc-sum">{summary}</span>
        <svg className="dc-caret" viewBox="0 0 16 16" width="16" height="16" aria-hidden>
          <path d="M3.2 6.1c1.6 1.3 3.2 2.9 4.8 4.4 1.5-1.5 3.1-3.1 4.8-4.4" />
        </svg>
      </button>
      <div ref={box} id={id} role="region" className="dc-box" style={{ height: defaultOpen ? 'auto' : 0 }}>
        <div ref={inner} className="dc-in">
          {children}
        </div>
      </div>
      <noscript>
        <style>{`.dc-box{height:auto!important;visibility:visible!important}.dc-caret{display:none}`}</style>
      </noscript>
    </div>
  )
}
