'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { makeStroke, type Pt } from '@space/motion/handStroke'
import { useSpringSet } from '@space/motion/useSpringSet'

/**
 * A link underline drawn as ONE hand-made stroke: it wavers, swells in the belly, ends in a small curl like a
 * tendril. It draws on with a head that overshoots slightly (the pen presses down: extra width, not extra length) and
 * leaves the way ink soaks away, wiped from the tail on a slower spring. Hover again mid-wipe and the tail turns
 * around from where it is. Touch: a tap draws it and it rests a moment before retracting. Keyboard: focus draws it.
 */
export function TendrilLink({
  children,
  href,
  seed = 3,
  className = '',
  size = 3.2,
}: {
  children: ReactNode
  href: string
  seed?: number
  className?: string
  size?: number
}) {
  const wrap = useRef<HTMLAnchorElement>(null)
  const path = useRef<SVGPathElement>(null)
  const [w, setW] = useState(120)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(24, el.getBoundingClientRect().width)))
    ro.observe(el)
    setW(Math.max(24, el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])

  const stroke = useMemo(() => {
    const n = Math.max(4, Math.round(w / 34))
    const ctrl: Pt[] = []
    for (let i = 0; i <= n; i++) ctrl.push({ x: (i / n) * w, y: 6.5 + Math.sin(i * 1.7 + seed) * 1.6 })
    // the curl: leaves the baseline, rises and winds back on itself
    ctrl.push({ x: w + 6, y: 5.2 }, { x: w + 12, y: 0.4 }, { x: w + 8, y: -5.6 }, { x: w + 1.5, y: -4.8 }, { x: w - 0.2, y: -0.6 }, { x: w + 3.5, y: 1.2 })
    return makeStroke(ctrl, { size, seed, wobble: 1.9, tip: 0.1, startWidth: 0.4, density: 90 })
  }, [w, seed, size])

  const strokeRef = useRef(stroke)
  strokeRef.current = stroke

  const sp = useSpringSet(
    { head: 0, tail: 0 },
    { head: { response: 0.62, damping: 0.78 }, tail: { response: 0.85, damping: 1 } },
    (v) => {
      const s = strokeRef.current
      const head = Math.min(1, v.head)
      const bump = Math.max(0, v.head - 1) * size * 5
      const d = s.d(Math.min(Math.max(0, v.tail), head), head, bump)
      path.current?.setAttribute('d', d)
    }
  )

  const timer = useRef(0)
  const open = () => {
    clearTimeout(timer.current)
    sp.to('tail', 0)
    sp.to('head', 1)
  }
  const close = () => {
    clearTimeout(timer.current)
    sp.to('tail', 1)
    // once fully wiped, rewind invisibly so the next draw starts from the left
    timer.current = window.setTimeout(() => {
      if (sp.get('tail').target === 1 && sp.get('tail').value > 0.97) {
        sp.set('head', 0)
        sp.set('tail', 0)
      }
    }, 1900)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <a
      ref={wrap}
      href={href}
      className={`relative inline-block pb-[7px] ${className}`}
      onPointerEnter={(e) => e.pointerType !== 'touch' && open()}
      onPointerLeave={(e) => e.pointerType !== 'touch' && close()}
      onPointerDown={(e) => {
        if (e.pointerType === 'touch') {
          open()
          clearTimeout(timer.current)
          timer.current = window.setTimeout(close, 1400)
        }
      }}
      onFocus={open}
      onBlur={close}
      onClick={(e) => e.preventDefault() /* demo only */}
    >
      {children}
      <svg
        aria-hidden
        className="pointer-events-none absolute left-0 overflow-visible"
        style={{ bottom: 0, width: w, height: 8 }}
        viewBox={`0 0 ${w} 8`}
      >
        <path ref={path} fill="var(--accent)" />
      </svg>
    </a>
  )
}
