'use client'

import { useMemo, useRef } from 'react'
import { makeStroke, type Pt } from '@/lib/motion/handStroke'
import { useSpringSet } from '@/lib/motion/useSpringSet'

const W = 520
const H = 92
const MID = 46
const TICKS = [0.08, 0.26, 0.44, 0.62, 0.8, 0.97]

/** A leaf as a single asymmetric organic path, pointing along +x from the origin, `len` long. */
function leafPath(len: number, wid: number, lean: number) {
  const f = (v: number) => Math.round(v * 100) / 100
  return `M0 0C${f(len * 0.22)} ${f(-wid * 0.9)} ${f(len * 0.7)} ${f(-wid * (0.75 + lean))} ${f(len)} ${f(-lean * 4)}C${f(len * 0.7)} ${f(wid * (0.35 - lean))} ${f(len * 0.28)} ${f(wid * 0.55)} 0 0Z`
}

/**
 * A scrubbable timeline whose track is a growing stem. The stem is one hand stroke whose tip follows the finger with
 * follow-through; each tick is a bud that opens into a leaf the moment the tip passes it (an overshooting spring: it
 * swells past full size and settles), and every leaf lags the tip on its own softer spring so scrubbing sets the
 * foliage swaying a beat behind the stem: overlapping action. Drag, tap the track or use arrow keys; vertical
 * scrolling is never hijacked. Interrupt any time: every channel retargets from its current value and velocity.
 */
export function BuddingTimeline({ onChange }: { onChange?: (p: number) => void }) {
  const stemRef = useRef<SVGPathElement>(null)
  const leafEls = useRef<(SVGGElement | null)[]>([])
  const valueRef = useRef(0.0)
  const dragging = useRef(false)

  const stem = useMemo(() => {
    const ctrl: Pt[] = []
    for (let i = 0; i <= 8; i++) ctrl.push({ x: 18 + (i / 8) * (W - 44), y: MID + Math.sin(i * 1.3 + 0.6) * 2.6 })
    return makeStroke(ctrl, { size: 3.2, seed: 5, wobble: 1.1, tip: 0.07, startWidth: 0.5, density: 110 })
  }, [])

  const leaves = useMemo(
    () =>
      TICKS.map((u, i) => {
        const p = stem.at(u)
        const up = i % 2 === 0
        return { u, p, up, d: leafPath(15 + (i % 3) * 3, 5.4 + (i % 2), 0.1 * ((i * 7) % 3)), base: (up ? -1 : 1) * (0.78 + 0.1 * ((i * 5) % 3)) }
      }),
    [stem]
  )

  const init: Record<string, number> = { head: 0 }
  const cfg: Record<string, { response: number; damping: number }> = { head: { response: 0.42, damping: 0.86 } }
  leaves.forEach((_, i) => {
    init[`o${i}`] = 0
    init[`f${i}`] = 0
    cfg[`o${i}`] = { response: 0.55, damping: 0.5 } // opens past full size and settles back
    cfg[`f${i}`] = { response: 0.3 + i * 0.07, damping: 0.62 } // follower: lags the tip, more so further along
  })
  const opened = useRef<number[]>([])

  const sp = useSpringSet<string>(init, cfg, (v) => {
    const head = Math.max(0, v.head)
    stemRef.current?.setAttribute('d', stem.d(0, Math.min(1, head), Math.max(0, head - 1) * 14))
    leaves.forEach((l, i) => {
      const g = leafEls.current[i]
      if (!g) return
      const open = v.head >= l.u - 0.004 ? 1 : 0
      if ((opened.current[i] ?? 0) !== open) {
        opened.current[i] = open
        sp.to(`o${i}`, open)
      }
      sp.to(`f${i}`, v.head)
      const lag = (v.head - v[`f${i}`]) * 120 // how far behind the tip this leaf is, in degrees
      const s = Math.max(0, v[`o${i}`])
      const rot = (l.base * 180) / Math.PI + lag * (l.up ? 1 : -1) * 0.5
      g.setAttribute('transform', `translate(${l.p.x} ${l.p.y}) rotate(${rot}) scale(${s} ${s * (0.7 + 0.3 * Math.min(1.2, s))})`)
      g.setAttribute('opacity', s < 0.02 ? '0' : '1')
    })
  })

  const setValue = (p: number) => {
    const c = Math.min(1, Math.max(0, p))
    valueRef.current = c
    sp.to('head', c)
    onChange?.(c)
  }
  const fromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    return (x - 18) / (W - 44)
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Timeline"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(valueRef.current * 100)}
      className="relative w-full max-w-[520px] cursor-pointer select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus"
      style={{ aspectRatio: `${W} / ${H}`, touchAction: 'pan-y' }}
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        setValue(fromEvent(e))
      }}
      onPointerMove={(e) => dragging.current && setValue(fromEvent(e))}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.2 : 0.1
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setValue(valueRef.current + step)
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setValue(valueRef.current - step)
        else if (e.key === 'Home') setValue(0)
        else if (e.key === 'End') setValue(1)
        else return
        e.preventDefault()
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        {/* faint pencil line the stem will grow along: the quiet resting track */}
        <path d={stem.d(0, 1, -1.6)} fill="var(--ink-faint)" opacity="0.28" />
        <path ref={stemRef} fill="var(--accent)" />
        {leaves.map((l, i) => (
          <g key={i} ref={(el) => void (leafEls.current[i] = el)} opacity="0">
            <path d={l.d} fill="var(--accent)" opacity="0.9" />
            <path d={`M0 0Q${6 + (i % 3)} ${-1.2 * (l.up ? 1 : -1) * 0} ${12} ${-0.6}`} stroke="var(--paper)" strokeWidth="0.7" strokeLinecap="round" fill="none" opacity="0.55" />
          </g>
        ))}
      </svg>
    </div>
  )
}
