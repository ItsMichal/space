'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { createSpring, isSettled } from '@space/motion/spring'
import { bounded, dragAxis, settleDamping, settleIndex, VelocityTracker } from './kinetics'

type StripOptions = {
  count: number
  /** Pixels between detents (item pitch). Read on every gesture so it can follow the viewport. */
  pitch: () => number
  initial: number
  /** Every frame the position changes. `p` is continuous in item units; `v` is items per second. Write to the DOM here. */
  onFrame: (p: number, v: number, dragging: boolean) => void
  /** The focused (nearest) item changed. Fires live while dragging, not only at rest. */
  onIndex?: (i: number, by: 'drag' | 'settle' | 'key' | 'tap') => void
  /** True from touch-down (or first wheel tick) until the strip has come to rest. */
  onActive?: (active: boolean) => void
  /** Soft rubber-band range at the ends, in items. */
  soft?: number
}

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * One-dimensional drag strip with detents: 1:1 finger tracking, velocity-projected landing on the nearest item,
 * rubber-banded ends, interruptible at any frame (a new touch grabs the strip where it is, carrying nothing). It never
 * locks input and never intercepts vertical scroll (the host sets `touch-action: pan-y`). The Timeline and the Gallery
 * share it; it owns no markup.
 */
export function useStrip(opts: StripOptions) {
  const o = useRef(opts)
  o.current = opts
  const spring = useRef(createSpring(opts.initial, { response: 0.5, damping: 1 }))
  const raf = useRef(0)
  const last = useRef(0)
  const index = useRef(opts.initial)
  const dragging = useRef(false)
  const moved = useRef(false)
  const gesture = useRef<{ id: number; x0: number; y0: number; p0: number; axis: 'x' | 'y' | null; target: Element | null } | null>(null)
  const vel = useRef(new VelocityTracker())
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const active = useRef(false)

  const setActive = useCallback((a: boolean) => {
    if (active.current !== a) {
      active.current = a
      o.current.onActive?.(a)
    }
  }, [])

  const emitIndex = useCallback((p: number, by: 'drag' | 'settle' | 'key' | 'tap') => {
    const i = Math.min(o.current.count - 1, Math.max(0, Math.round(p)))
    if (i !== index.current) {
      index.current = i
      o.current.onIndex?.(i, by)
    }
  }, [])

  const loop = useCallback(
    (now: number) => {
      const dt = Math.min((now - last.current) / 1000, 1 / 20)
      last.current = now
      const s = spring.current.step(dt)
      o.current.onFrame(s.value, s.velocity, false)
      emitIndex(s.value, 'settle')
      if (isSettled(s, 0.0008)) {
        spring.current.set(s.target)
        o.current.onFrame(s.target, 0, false)
        raf.current = 0
        setActive(false)
      } else raf.current = requestAnimationFrame(loop)
    },
    [emitIndex, setActive]
  )

  const kick = useCallback(() => {
    if (!raf.current) {
      last.current = performance.now()
      raf.current = requestAnimationFrame(loop)
    }
  }, [loop])

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current)
    raf.current = 0
  }, [])

  const goTo = useCallback(
    (i: number, by: 'key' | 'tap' | 'settle' = 'tap', velocity = 0) => {
      const target = Math.min(o.current.count - 1, Math.max(0, i))
      setActive(true)
      if (reduced()) {
        stop()
        spring.current.set(target)
        o.current.onFrame(target, 0, false)
        emitIndex(target, by)
        setActive(false)
        return
      }
      // Retarget from the current value and velocity: an arrow key pressed mid-flight redirects, never restarts.
      spring.current.configure({ response: by === 'tap' ? 0.62 : 0.5, damping: settleDamping(velocity * o.current.pitch()) })
      spring.current.to(target, velocity)
      emitIndex(target, by)
      kick()
    },
    [emitIndex, kick, setActive, stop]
  )

  const release = useCallback(
    (now: number) => {
      const pitch = o.current.pitch()
      const v = vel.current.get(now) / pitch // items/s, sign follows the finger
      const p = spring.current.state.value
      const to = settleIndex(p, -v, o.current.count)
      setActive(true)
      spring.current.configure({ response: 0.5, damping: reduced() ? 1 : settleDamping(v * pitch) })
      if (reduced()) {
        spring.current.set(to)
        o.current.onFrame(to, 0, false)
        emitIndex(to, 'settle')
        setActive(false)
        return
      }
      spring.current.to(to, -v)
      kick()
    },
    [emitIndex, kick, setActive]
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (gesture.current) return
      stop()
      gesture.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, p0: spring.current.state.value, axis: null, target: e.currentTarget }
      vel.current.reset()
      vel.current.add(e.timeStamp, e.clientX)
      moved.current = false
    },
    [stop]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const g = gesture.current
      if (!g || g.id !== e.pointerId) return
      const dx = e.clientX - g.x0
      if (!g.axis) {
        g.axis = dragAxis(dx, e.clientY - g.y0, e.pointerType === 'touch' ? 8 : 4)
        if (g.axis === 'y') {
          gesture.current = null
          return
        }
        if (g.axis === 'x') {
          dragging.current = true
          moved.current = true
          g.target?.setPointerCapture(e.pointerId)
          // The drag begins from where the strip is NOW, so there is no jump at the moment of capture.
          g.x0 = e.clientX
          g.p0 = spring.current.state.value
          setActive(true)
        } else return
      }
      vel.current.add(e.timeStamp, e.clientX)
      const pitch = o.current.pitch()
      const soft = o.current.soft ?? 0.9
      const p = bounded(g.p0 - (e.clientX - g.x0) / pitch, 0, o.current.count - 1, soft)
      spring.current.set(p)
      o.current.onFrame(p, 0, true)
      emitIndex(p, 'drag')
    },
    [emitIndex, setActive]
  )

  const end = useCallback(
    (e: React.PointerEvent) => {
      const g = gesture.current
      if (!g || g.id !== e.pointerId) return
      gesture.current = null
      if (g.axis === 'x') {
        dragging.current = false
        release(e.timeStamp)
        // Swallow the click that follows a drag so it never activates what was under the finger.
        setTimeout(() => (moved.current = false), 0)
      }
    },
    [release]
  )

  // Trackpad / horizontal wheel: passive, 1:1, then settles after the gesture goes quiet. Vertical wheel is untouched.
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.2) return
      const pitch = o.current.pitch()
      stop()
      setActive(true)
      const p = bounded(spring.current.state.value + e.deltaX / pitch, 0, o.current.count - 1, o.current.soft ?? 0.9)
      spring.current.set(p)
      vel.current.add(e.timeStamp, -p * pitch)
      o.current.onFrame(p, 0, true)
      emitIndex(p, 'drag')
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
      wheelTimer.current = setTimeout(() => release(performance.now()), 110)
    },
    [emitIndex, release, setActive, stop]
  )

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (moved.current) {
      e.preventDefault()
      e.stopPropagation()
    }
  }, [])

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
    },
    []
  )

  const bind = useMemo(
    () => ({ onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end, onWheel, onClickCapture }),
    [end, onClickCapture, onPointerDown, onPointerMove, onWheel]
  )

  return {
    bind,
    goTo,
    /** Jump without animation (layout changes, first paint). */
    jump(p: number) {
      stop()
      spring.current.set(p)
      index.current = Math.round(p)
      o.current.onFrame(p, 0, false)
    },
    get index() {
      return index.current
    },
    get position() {
      return spring.current.state.value
    },
  }
}
