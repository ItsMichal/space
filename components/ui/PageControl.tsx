'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Glass, glass } from '@/components/glass'
import { useSpringSet } from '@/lib/motion/useSpringSet'
import type { SpringConfig } from '@/lib/motion/spring'
import { hash01 } from '@/lib/motion/rng'
import { seedPath } from './craft/stroke'
import './ui.css'
import './gallery.css'

type Props = {
  count: number
  index: number
  label?: string
  onSelect: (i: number) => void
  /** Present only when the host can auto-advance. */
  playing?: boolean
  /** Auto-advance is actually running right now, so the active leaf fills like a progress bar. */
  running?: boolean
  /** Milliseconds the fill takes to complete; the host advances on `onFillEnd`. */
  interval?: number
  onToggle?: () => void
  onFillEnd?: () => void
}

const GAP = 20
const PAD = 16
const H = 11
const Y = 17
// Same two-edge springs as components/motion/StretchPill: the edge nearest the destination leads, the other is dragged.
const LEAD: SpringConfig = { response: 0.36, damping: 0.78 }
const TRAIL: SpringConfig = { response: 0.66, damping: 0.94 }
const f = (n: number) => Math.round(n * 100) / 100

/**
 * Page control. Resting pages are small seeds (each a little different); the current page is a leaf-shaped pill that
 * stretches toward where you are going: the leading edge jumps ahead and overshoots, the trailing edge is pulled after
 * it, the waist pinches while it is long and gathers back on arrival. A second tap mid-flight keeps both edges'
 * velocity. While the gallery auto-advances the leaf fills left to right (a darker inner leaf). The buttons are plain
 * 44px targets laid over the drawing, so nothing depends on hover.
 */
export function PageControl({ count, index, label = 'Pages', onSelect, playing, running, interval = 6000, onToggle, onFillEnd }: Props) {
  const width = PAD * 2 + GAP * (count - 1)
  const cx = (i: number) => PAD + i * GAP
  const body = useRef<SVGPathElement>(null)
  const fill = useRef<SVGPathElement>(null)
  const edges = useRef({ l: cx(index), r: cx(index) })
  const prog = useRef(running ? 0 : 1)
  const prev = useRef(index)
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => seedPath(i + 1)), [count])

  const shape = (l: number, r: number, k: number, lift: number) => {
    // A leaf, never a circle: round at the shoulder, drawn to a soft tip. Stretched, the waist pinches and the tip
    // lifts; at rest it is a small asymmetric bud (a touch wider than tall, tip tilted up) so even stillness is organic.
    const span = r - l
    const stretch = Math.min(1, Math.max(0, span / (GAP * 1.6)))
    const h = H * (1 - 0.28 * stretch)
    const waist = h * 0.3 * stretch
    const x0 = l - H * 0.62
    const x1 = x0 + (r + H * 0.7 - x0) * k
    const w = x1 - x0
    const skew = (hash01(index * 3 + 1) - 0.5) * 1.1
    const tipY = Y - 1.6 - lift - stretch * 0.8
    const yTop = Y - h / 2 - lift
    const yBot = Y + h / 2 + lift * 0.4
    return (
      `M${f(x0)} ${f(Y + 0.4)}` +
      `C${f(x0 - 0.2)} ${f(yTop - h * 0.1)} ${f(x0 + w * 0.34)} ${f(yTop + waist + skew)} ${f(x1)} ${f(tipY)}` +
      `C${f(x1 - w * 0.28)} ${f(yBot - waist - skew)} ${f(x0 + w * 0.12)} ${f(yBot + h * 0.12)} ${f(x0)} ${f(Y + 0.4)}Z`
    )
  }

  const draw = () => {
    const { l, r } = edges.current
    const lo = Math.min(l, r)
    const hi = Math.max(l, r)
    body.current?.setAttribute('d', shape(lo, hi, 1, 0))
    fill.current?.setAttribute('d', shape(lo + 1, hi, Math.max(0.02, prog.current), 0))
  }

  const sp = useSpringSet({ l: cx(index), r: cx(index) }, { l: TRAIL, r: LEAD }, (v) => {
    edges.current = { l: v.l, r: v.r }
    draw()
  })

  useEffect(() => {
    if (index === prev.current) return
    const forward = index > prev.current
    prev.current = index
    prog.current = 0
    // the edge nearest the destination leads
    sp.configure('r', forward ? LEAD : TRAIL)
    sp.configure('l', forward ? TRAIL : LEAD)
    sp.to('r', cx(index))
    sp.to('l', cx(index))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  // The autoplay fill is time based: one rAF while it runs, so it never depends on the springs being awake.
  useEffect(() => {
    if (!running) {
      prog.current = 1
      draw()
      return
    }
    let raf = 0
    const t0 = performance.now() - prog.current * interval
    if (prog.current >= 1) prog.current = 0
    const tick = (now: number) => {
      prog.current = Math.min(1, (now - t0) / interval)
      draw()
      if (prog.current >= 1) onFillEnd?.()
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, index, interval])

  useEffect(draw, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (count < 2) return null
  return (
    <Glass as="div" effect={glass.regular.interactive()} shape="capsule" className="pc" role="group" aria-label={label}>
      <div className="pc-art" style={{ width, height: 34 }}>
        <svg viewBox={`0 0 ${width} 34`} width={width} height={34} aria-hidden className="pc-svg">
          {seeds.map((d, i) => (
            <path key={i} d={d} transform={`translate(${cx(i)} ${Y})`} className="pc-seed" />
          ))}
          <path ref={body} className="pc-body" />
          <path ref={fill} className="pc-fillp" />
        </svg>
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            className="pc-hit"
            style={{ left: cx(i) - GAP / 2, width: GAP }}
            aria-label={`Show ${i + 1} of ${count}`}
            aria-current={i === index ? 'true' : undefined}
            onClick={() => onSelect(i)}
          />
        ))}
      </div>
      {onToggle ? (
        <button type="button" className="pc-play" aria-label={playing ? 'Pause slideshow' : 'Play slideshow'} aria-pressed={!!playing} onClick={onToggle}>
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
            <g className="pc-ico pc-ico--pause" data-on={playing ? '' : undefined}>
              <path d="M2.7 2.2c.5-.4 1.6-.3 1.9.3.3 2.4.3 4.7 0 7.3-.3.6-1.4.7-1.9.3-.4-2.6-.4-5.3 0-7.9zM7.4 2.1c.5-.4 1.5-.2 1.9.4.3 2.5.2 5 0 7.3-.4.6-1.5.6-1.9.2-.3-2.6-.3-5.3 0-7.9z" />
            </g>
            <path className="pc-ico pc-ico--play" data-on={playing ? undefined : ''} d="M3.6 2.2c.5-.3 1 0 1.4.2l4.6 2.9c.5.3.5.9 0 1.2L5 9.4c-.4.3-1 .3-1.4 0-.3-.2-.4-.5-.4-.9V3.1c0-.4.1-.7.4-.9z" />
          </svg>
        </button>
      ) : null}
    </Glass>
  )
}
