'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react'
import { Glass, glass } from '@/components/glass'
import { createSpring } from '@/lib/motion/spring'
import { project } from '@/lib/motion/spring'
import { bounded, VelocityTracker } from './kinetics'
import { nearestSegment, type Segment } from './segments'
import './segmented.css'

export type SegmentOption = { value: string; label: string; href?: string }

type Props = {
  options: readonly SegmentOption[]
  value: string
  onChange: (value: string) => void
  label: string
  className?: string
}

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** Tell the glass field that something inside it moved by script (it listens for transition events to keep sampling). */
const nudge = (el: HTMLElement | null) => el?.dispatchEvent(new Event('transitionrun', { bubbles: true }))

/**
 * A glass segmented control. The thumb is a glass lens that follows the finger 1:1 while you drag, stretches toward
 * where it is going (the trailing edge lags and settles with a small overshoot), then lands on the nearest segment
 * with the release velocity carried over. A tap is the same motion with no finger travel. Options are real anchors, so
 * with no JavaScript they still navigate (the page filters them with :target).
 */
export function SegmentedControl({ options, value, onChange, label, className = '' }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const labels = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLDivElement>(null)
  const items = useRef<(HTMLAnchorElement | null)[]>([])
  const segs = useRef<Segment[]>([])
  const [ready, setReady] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const index = Math.max(0, options.findIndex((o) => o.value === value))

  const fx = useRef({
    x: createSpring(0, { response: 0.42, damping: 0.88 }),
    w: createSpring(0, { response: 0.4, damping: 0.8 }),
    s: createSpring(0, { response: 0.3, damping: 0.5 }),
    raf: 0,
    last: 0,
    dragging: false,
    moved: false,
    px: 0,
    prev: 0,
  })
  const vel = useRef(new VelocityTracker())
  const gesture = useRef<{ id: number; x0: number; thumbX0: number } | null>(null)

  const apply = useCallback(
    (dt: number) => {
      const f = fx.current
      const x = f.x.step(dt)
      const w = f.w.step(dt)
      const v = x.velocity
      f.s.to(Math.min(Math.abs(v) * 0.014, 18))
      const st = f.s.step(dt).value
      const lead = v >= 0 ? 0.3 : 0.7 // the leading edge gets ahead of the body, the trailing one follows
      const el = thumb.current
      if (el) {
        el.style.width = `${Math.max(0, w.value + st)}px`
        el.style.transform = `translate3d(${x.value - st * lead}px,0,0) scaleY(${1 - Math.min(st, 18) * 0.004})`
      }
      nudge(thumb.current)
      return Math.abs(x.value - x.target) > 0.05 || Math.abs(v) > 0.5 || Math.abs(w.value - w.target) > 0.05 || Math.abs(f.s.state.value) > 0.05
    },
    []
  )

  const loop = useCallback(
    (now: number) => {
      const f = fx.current
      const dt = Math.min((now - f.last) / 1000, 1 / 20)
      f.last = now
      f.raf = apply(dt) ? requestAnimationFrame(loop) : 0
    },
    [apply]
  )
  const kick = useCallback(() => {
    const f = fx.current
    if (!f.raf) {
      f.last = performance.now()
      f.raf = requestAnimationFrame(loop)
    }
  }, [loop])

  const measure = useCallback(() => {
    const host = labels.current
    if (!host) return
    segs.current = items.current.map((a) => (a ? { left: a.offsetLeft, width: a.offsetWidth } : { left: 0, width: 0 }))
  }, [])

  const goto = useCallback(
    (i: number, velocity = 0) => {
      const s = segs.current[i]
      if (!s) return
      const f = fx.current
      if (reduced()) {
        f.x.set(s.left)
        f.w.set(s.width)
        apply(0)
        return
      }
      f.x.to(s.left, velocity)
      f.w.to(s.width)
      kick()
    },
    [apply, kick]
  )

  // Measure, then place the thumb without animating.
  useIso(() => {
    measure()
    const s = segs.current[index]
    if (!s) return
    const f = fx.current
    f.x.set(s.left)
    f.w.set(s.width)
    apply(0)
    setReady(true)
    const ro = new ResizeObserver(() => {
      measure()
      const t = segs.current[fx.current.dragging ? 0 : index]
      if (t && !fx.current.dragging) {
        f.x.set(t.left)
        f.w.set(t.width)
        apply(0)
      }
    })
    if (labels.current) ro.observe(labels.current)
    document.fonts?.ready.then(() => {
      measure()
      const t = segs.current[index]
      if (t) {
        f.x.set(t.left)
        f.w.set(t.width)
        apply(0)
      }
    })
    return () => ro.disconnect()
  }, [])

  // Selection changed (click, key, URL): glide there from wherever the thumb is, carrying its velocity.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!fx.current.dragging) goto(index, fx.current.x.state.velocity)
  }, [index, goto])

  useEffect(() => () => cancelAnimationFrame(fx.current.raf), [])

  const onPointerDown = (e: RPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const f = fx.current
    gesture.current = { id: e.pointerId, x0: e.clientX, thumbX0: f.x.state.value }
    f.moved = false
    vel.current.reset()
    vel.current.add(e.timeStamp, e.clientX)
  }

  const onPointerMove = (e: RPointerEvent) => {
    const g = gesture.current
    const f = fx.current
    if (!g || g.id !== e.pointerId) return
    const dx = e.clientX - g.x0
    if (!f.moved) {
      if (Math.abs(dx) < 4) return
      f.moved = true
      f.dragging = true
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      g.x0 = e.clientX
      g.thumbX0 = f.x.state.value
      // The thumb becomes the size of whatever it is nearest, as if you had picked it up.
    }
    vel.current.add(e.timeStamp, e.clientX)
    const first = segs.current[0]
    const last = segs.current[segs.current.length - 1]
    const x = bounded(g.thumbX0 + (e.clientX - g.x0), first.left, last.left, 26)
    f.x.set(x)
    const mid = x + (f.w.state.value || first.width) / 2
    const near = nearestSegment(segs.current, mid)
    setHover(near)
    const s = segs.current[near]
    f.w.to(s.width) // width glides toward the segment it is over
    apply(0)
    kick()
  }

  const end = (e: RPointerEvent) => {
    const g = gesture.current
    const f = fx.current
    if (!g || g.id !== e.pointerId) return
    gesture.current = null
    if (!f.moved) return
    f.dragging = false
    const v = vel.current.get(e.timeStamp)
    const px = f.x.state.value + (f.w.state.value || 0) / 2
    const dest = nearestSegment(segs.current, project(px, v, 0.994))
    setHover(null)
    setTimeout(() => (f.moved = false), 0)
    f.x.to(f.x.state.value, v)
    if (options[dest].value !== value) onChange(options[dest].value)
    goto(dest, v)
  }

  const select = (i: number) => {
    onChange(options[i].value)
    if (typeof history !== 'undefined' && options[i].href) history.replaceState(null, '', options[i].href)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    let to = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = (index + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = (index + options.length - 1) % options.length
    else if (e.key === 'Home') to = 0
    else if (e.key === 'End') to = options.length - 1
    else if (e.key === ' ') {
      e.preventDefault()
      ;(e.target as HTMLElement).click()
      return
    } else return
    e.preventDefault()
    select(to)
    items.current[to]?.focus({ preventScroll: true })
  }

  return (
    <div className={`seg ${className}`} data-ready={ready ? '' : undefined} ref={root}>
      <Glass as="span" effect={glass.clear} shape="capsule" className="seg-track" aria-hidden />
      <Glass as="div" effect={glass.regular.tint('rgba(61, 106, 53, 0.2)').interactive()} shape="capsule" className="seg-thumb" aria-hidden ref={thumb as never} />
      <div
        ref={labels}
        role="radiogroup"
        aria-label={label}
        className="seg-labels"
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onClickCapture={(e) => {
          if (fx.current.moved) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        {options.map((o, i) => (
          <a
            key={o.value}
            ref={(el) => {
              items.current[i] = el
            }}
            href={o.href ?? `#${o.value}`}
            role="radio"
            aria-checked={i === index}
            tabIndex={i === index ? 0 : -1}
            data-hover={hover === i ? '' : undefined}
            className="seg-opt"
            onClick={(e) => {
              e.preventDefault()
              select(i)
            }}
          >
            {o.label}
          </a>
        ))}
      </div>
    </div>
  )
}
