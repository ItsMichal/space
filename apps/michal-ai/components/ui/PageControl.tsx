'use client'

import { useEffect, useId, useRef } from 'react'
import { Glass, glass } from '@/components/glass'
import { useSpringSet } from '@space/motion/useSpringSet'
import type { SpringConfig } from '@space/motion/spring'
import './ui.css'
import './gallery.css'

type Props = {
  count: number
  index: number
  label?: string
  onSelect: (i: number) => void
  /** Present only when the host can auto-advance. */
  playing?: boolean
  /** Auto-advance is actually running right now, so the active capsule fills like a progress bar. */
  running?: boolean
  /** Milliseconds the fill takes to complete; the host advances on `onFillEnd`. */
  interval?: number
  onToggle?: () => void
  onFillEnd?: () => void
}

const GAP = 18
const PAD = 16
/** Dot diameter; the current page is a capsule of this height. */
const D = 7
const R = D / 2
/** Resting capsule is this many dot diameters wide (centre to centre of its end caps is the remainder). */
const REST_SPAN = D * 2.7 - D
const Y = 17
// Same two-edge springs as components/motion/StretchPill: the edge nearest the destination leads, the other is dragged.
const LEAD: SpringConfig = { response: 0.36, damping: 0.78 }
const TRAIL: SpringConfig = { response: 0.66, damping: 0.94 }
const f = (n: number) => Math.round(n * 100) / 100

/**
 * Page control, in the manner of iOS UIPageControl: resting pages are identical dots, the current page is a capsule of
 * the same height. On a change the capsule stretches toward the destination: the leading edge jumps ahead and
 * overshoots, the trailing edge is pulled after it (a second tap mid-flight keeps both edges' velocity). While the
 * gallery auto-advances the capsule fills left to right. The buttons are plain 44px targets laid over the drawing, so
 * nothing depends on hover.
 */
export function PageControl({ count, index, label = 'Pages', onSelect, playing, running, interval = 6000, onToggle, onFillEnd }: Props) {
  const width = PAD * 2 + GAP * (count - 1)
  const cx = (i: number) => PAD + i * GAP
  const clipId = `pc-clip-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const body = useRef<SVGRectElement>(null)
  const clip = useRef<SVGRectElement>(null)
  const fill = useRef<SVGRectElement>(null)
  const half = REST_SPAN / 2
  const edges = useRef({ l: cx(index) - half, r: cx(index) + half })
  const prog = useRef(running ? 0 : 1)
  const prev = useRef(index)

  const put = (el: SVGRectElement | null, x: number, w: number) => {
    if (!el) return
    el.setAttribute('x', String(f(x)))
    el.setAttribute('width', String(f(Math.max(D, w))))
  }

  const draw = () => {
    const { l, r } = edges.current
    const x = Math.min(l, r) - R
    const w = Math.abs(r - l) + D
    put(body.current, x, w)
    put(clip.current, x, w)
    put(fill.current, x, Math.max(D, w * Math.max(0.02, prog.current)))
  }

  const sp = useSpringSet({ l: cx(index) - half, r: cx(index) + half }, { l: TRAIL, r: LEAD }, (v) => {
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
    sp.to('r', cx(index) + half)
    sp.to('l', cx(index) - half)
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
          <defs>
            <clipPath id={clipId}>
              <rect ref={clip} y={Y - R} height={D} rx={R} />
            </clipPath>
          </defs>
          {Array.from({ length: count }, (_, i) => (
            <circle key={i} cx={cx(i)} cy={Y} r={R} className="pc-dot" />
          ))}
          <rect ref={body} y={Y - R} height={D} rx={R} className="pc-body" />
          <g clipPath={`url(#${clipId})`}>
            <rect ref={fill} y={Y - R} height={D} className="pc-fillp" />
          </g>
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
