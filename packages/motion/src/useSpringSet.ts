'use client'

import { useCallback, useEffect, useRef } from 'react'
import { createSpring, isSettled, SPRING_SOFT, type Spring, type SpringConfig } from './spring'

/**
 * Several named springs advanced by ONE rAF loop and handed to `onFrame` together (write to the DOM, never to React
 * state). Every channel retargets from its current value and velocity, so any gesture can interrupt any other.
 * Different channels may have different configs: that difference is how follow-through is made (a fast head and a
 * lagging tail, or a stiff stem and a loose leaf). Reduced motion lands every change instantly.
 */
export function useSpringSet<K extends string>(
  initial: Record<K, number>,
  configs: Partial<Record<K, SpringConfig>>,
  onFrame: (v: Record<K, number>, velocity: Record<K, number>) => void
) {
  const springs = useRef<Record<string, Spring> | null>(null)
  if (!springs.current) {
    springs.current = {}
    for (const k of Object.keys(initial)) springs.current[k] = createSpring((initial as Record<string, number>)[k], configs[k as K] ?? SPRING_SOFT)
  }
  const frame = useRef(onFrame)
  frame.current = onFrame
  const raf = useRef(0)
  const last = useRef(0)

  const emit = useCallback(() => {
    const v: Record<string, number> = {}
    const vel: Record<string, number> = {}
    for (const [k, s] of Object.entries(springs.current!)) {
      v[k] = s.state.value
      vel[k] = s.state.velocity
    }
    frame.current(v as Record<K, number>, vel as Record<K, number>)
  }, [])

  const loop = useCallback(
    (now: number) => {
      const dt = Math.min((now - last.current) / 1000, 1 / 20)
      last.current = now
      for (const s of Object.values(springs.current!)) {
        const st = s.step(dt)
        if (isSettled(st, 0.0005)) s.set(st.target)
      }
      // `emit` may retarget springs (a follower chasing a leader), so decide whether we are still busy AFTER it.
      emit()
      const busy = Object.values(springs.current!).some((s) => !isSettled(s.state, 0.0005))
      raf.current = busy ? requestAnimationFrame(loop) : 0
    },
    [emit]
  )

  const kick = useCallback(() => {
    if (!raf.current) {
      last.current = performance.now()
      raf.current = requestAnimationFrame(loop)
    }
  }, [loop])

  useEffect(() => {
    emit()
    return () => cancelAnimationFrame(raf.current)
  }, [emit])

  return {
    to: useCallback(
      (key: K, target: number, velocity?: number) => {
        const s = springs.current![key]
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
          s.set(target)
          emit()
          return
        }
        s.to(target, velocity)
        kick()
      },
      [emit, kick]
    ),
    set: useCallback(
      (key: K, value: number) => {
        springs.current![key].set(value)
        emit()
      },
      [emit]
    ),
    get: useCallback((key: K) => springs.current![key].state, []),
    configure: useCallback((key: K, cfg: SpringConfig) => springs.current![key].configure(cfg), []),
  }
}
