'use client'

import { useCallback, useEffect, useRef } from 'react'
import { createSpring, isSettled, SPRING_SOFT, type SpringConfig } from './spring'

/**
 * Drives a number with a velocity-aware spring and hands each frame to `onFrame` (write it straight to the DOM, e.g.
 * `el.style.transform`, so React never re-renders at 60fps). `to()` retargets mid-flight keeping velocity; `set()` is
 * for 1:1 finger tracking. Under reduced motion every change lands instantly.
 */
export function useSpring(initial: number, onFrame: (value: number) => void, config: SpringConfig = SPRING_SOFT) {
  const spring = useRef(createSpring(initial, config))
  const raf = useRef(0)
  const last = useRef(0)
  const frame = useRef(onFrame)
  frame.current = onFrame

  const loop = useCallback((now: number) => {
    const dt = Math.min((now - last.current) / 1000, 1 / 20)
    last.current = now
    const s = spring.current.step(dt)
    frame.current(s.value)
    if (isSettled(s)) {
      spring.current.set(s.target)
      frame.current(s.target)
      raf.current = 0
    } else raf.current = requestAnimationFrame(loop)
  }, [])

  const kick = useCallback(() => {
    if (!raf.current) {
      last.current = performance.now()
      raf.current = requestAnimationFrame(loop)
    }
  }, [loop])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  return {
    to: useCallback(
      (target: number, velocity?: number) => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
          spring.current.set(target)
          frame.current(target)
          return
        }
        spring.current.to(target, velocity)
        kick()
      },
      [kick]
    ),
    set: useCallback((value: number) => {
      cancelAnimationFrame(raf.current)
      raf.current = 0
      spring.current.set(value)
      frame.current(value)
    }, []),
    configure: useCallback((next: SpringConfig) => spring.current.configure(next), []),
    get: useCallback(() => spring.current.state, []),
  }
}
