'use client'

import { useRef } from 'react'
import { useSpringSet } from '@/lib/motion/useSpringSet'
import type { SpringConfig } from '@/lib/motion/spring'

const GAP = 22
const PAD = 14
const H = 12
const DOT = 3.2

const LEAD: SpringConfig = { response: 0.36, damping: 0.78 } // the edge in the direction of travel jumps ahead
const TRAIL: SpringConfig = { response: 0.66, damping: 0.94 } // the other edge is dragged along, a beat late

/**
 * A page control whose indicator is a stretching pill. The leading edge goes first on a quick spring that overshoots a
 * little, the trailing edge follows on a slower one, so the pill elongates mid-flight, thins at the waist (its
 * volume is conserved) and gathers back into itself on arrival. Which edge leads flips with the direction of travel,
 * and a new tap mid-flight just retargets both edges from where they are, velocity kept. Tap a dot, drag across the
 * row, or use arrow keys; touch targets are 44px tall.
 */
export function StretchPill({ count = 5, onChange }: { count?: number; onChange?: (i: number) => void }) {
  const path = useRef<SVGPathElement>(null)
  const index = useRef(0)
  const width = PAD * 2 + GAP * (count - 1)
  const cx = (i: number) => PAD + i * GAP

  const sp = useSpringSet({ l: cx(0), r: cx(0) }, { l: TRAIL, r: LEAD }, (v) => {
    const l = Math.min(v.l, v.r)
    const r = Math.max(v.l, v.r)
    const span = r - l
    const stretch = Math.min(1, Math.max(0, (span - H) / (GAP * 1.6)))
    const h = H * (1 - 0.3 * stretch) // volume conservation: longer means thinner
    const waist = h * 0.34 * stretch // the middle pinches in
    const y = 22
    const rad = h / 2
    const x0 = l - H / 2 + rad * 0.0
    const x1 = r + H / 2
    const mx = (x0 + x1) / 2
    const f = (n: number) => Math.round(n * 100) / 100
    path.current?.setAttribute(
      'd',
      `M${f(x0 + rad)} ${f(y - h / 2)}Q${f(mx)} ${f(y - h / 2 + waist * 2)} ${f(x1 - rad)} ${f(y - h / 2)}A${f(rad)} ${f(rad)} 0 0 1 ${f(x1 - rad)} ${f(y + h / 2)}Q${f(mx)} ${f(y + h / 2 - waist * 2)} ${f(x0 + rad)} ${f(y + h / 2)}A${f(rad)} ${f(rad)} 0 0 1 ${f(x0 + rad)} ${f(y - h / 2)}Z`
    )
  })

  const go = (i: number) => {
    const next = Math.min(count - 1, Math.max(0, i))
    if (next === index.current) return
    const forward = next > index.current
    index.current = next
    // the edge nearest the destination leads
    sp.configure('r', forward ? LEAD : TRAIL)
    sp.configure('l', forward ? TRAIL : LEAD)
    sp.to('r', cx(next))
    sp.to('l', cx(next))
    onChange?.(next)
  }
  const at = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return Math.round((((e.clientX - r.left) / r.width) * width - PAD) / GAP)
  }

  return (
    <div
      role="tablist"
      aria-label="Page"
      tabIndex={0}
      className="relative inline-block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus"
      style={{ width, height: 44, touchAction: 'pan-y' }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        go(at(e))
      }}
      onPointerMove={(e) => e.buttons && go(at(e))}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(index.current + 1)
        else if (e.key === 'ArrowLeft') go(index.current - 1)
        else return
        e.preventDefault()
      }}
    >
      <svg viewBox={`0 0 ${width} 44`} width={width} height={44} aria-hidden className="absolute inset-0 overflow-visible">
        {Array.from({ length: count }, (_, i) => (
          <circle key={i} cx={cx(i)} cy={22} r={DOT} fill="var(--ink-faint)" opacity="0.55" />
        ))}
        <path ref={path} fill="var(--ink)" />
      </svg>
    </div>
  )
}
