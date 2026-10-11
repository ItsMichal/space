'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import { createSpring, isSettled, type Spring } from '@/lib/motion/spring'
import { settleLine, type SettleOpts } from '@/lib/motion/settle'

export type SettleHandle = { settle(on: boolean): void }

type Channel = { o: Spring; b: Spring; m: Spring; el: HTMLElement; cfg: ReturnType<typeof settleLine>; timer: number }

/**
 * Text that settles line by line. Each line has three independent springs with deliberately different timings: opacity
 * (quick, critically damped), blur-to-sharp (slow), and a rise plus a hair of rotation that overshoots and settles.
 * Lines start staggered by seeded offsets, so it never feels metronomic. `settle(false)` reverses everything faster
 * and without stagger; either call can interrupt the other mid-flight and every spring continues from where it is.
 * Without JS the text is simply there; under reduced motion it appears at once.
 */
export const SettleText = forwardRef<
  SettleHandle,
  { text: string; as?: 'h1' | 'h2' | 'h3' | 'p'; className?: string; autoStart?: boolean } & SettleOpts
>(function SettleText({ text, as: Tag = 'h2', className = '', autoStart = true, ...opts }, ref) {
  const root = useRef<HTMLSpanElement>(null)
  const ch = useRef<Channel[]>([])
  const raf = useRef(0)
  const last = useRef(0)
  const optsRef = useRef(opts)
  optsRef.current = opts

  const paint = (c: Channel) => {
    const o = c.o.state.value
    const b = c.b.state.value
    const m = c.m.state.value
    c.el.style.opacity = String(Math.min(1, Math.max(0, o)))
    c.el.style.filter = b < 0.995 ? `blur(${((1 - b) * c.cfg.fromBlur).toFixed(2)}px)` : ''
    c.el.style.transform = `translate3d(0, ${((1 - m) * c.cfg.fromY).toFixed(2)}px, 0) rotate(${((1 - m) * c.cfg.fromRot).toFixed(3)}deg)`
  }

  const loop = useCallback((now: number) => {
    const dt = Math.min((now - last.current) / 1000, 1 / 20)
    last.current = now
    let busy = false
    for (const c of ch.current) {
      c.o.step(dt)
      c.b.step(dt)
      c.m.step(dt)
      paint(c)
      if (!isSettled(c.o.state, 0.001) || !isSettled(c.b.state, 0.001) || !isSettled(c.m.state, 0.0005)) busy = true
    }
    raf.current = busy ? requestAnimationFrame(loop) : 0
    if (!busy) {
      for (const c of ch.current) {
        if (c.m.state.target === 1) {
          c.el.style.willChange = ''
          c.el.style.filter = ''
          c.el.style.transform = ''
        }
      }
    }
  }, [])
  const kick = () => {
    if (!raf.current) {
      last.current = performance.now()
      raf.current = requestAnimationFrame(loop)
    }
  }

  const settle = useCallback((on: boolean) => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    for (const c of ch.current) {
      clearTimeout(c.timer)
      const go = () => {
        c.el.style.willChange = 'transform, filter, opacity'
        if (on) {
          c.o.configure({ response: 0.34, damping: 1 })
          c.b.configure({ response: 0.62, damping: 1 })
          c.m.configure({ response: 0.7, damping: 0.62 })
        } else {
          c.o.configure({ response: 0.28, damping: 1 })
          c.b.configure({ response: 0.34, damping: 1 })
          c.m.configure({ response: 0.4, damping: 1 })
        }
        const v = on ? 1 : 0
        if (reduce) {
          c.o.set(v)
          c.b.set(v)
          c.m.set(v)
          paint(c)
        } else {
          c.o.to(v)
          c.b.to(v)
          c.m.to(v)
          kick()
        }
      }
      if (on && !reduce) c.timer = window.setTimeout(go, c.cfg.delay)
      else go()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({ settle }), [settle])

  // Build lines after layout (and again after fonts load, which reflows). Words are measured; no markup changes the flow.
  useLayoutEffect(() => {
    const host = root.current!
    const build = () => {
      const prevOn = ch.current[0]?.m.state.target ?? 0
      ch.current.forEach((c) => clearTimeout(c.timer))
      host.textContent = ''
      const words = text.split(' ').map((w) => {
        const s = document.createElement('span')
        s.textContent = w
        s.style.display = 'inline-block'
        host.append(s, ' ')
        return s
      })
      const lines: HTMLElement[][] = []
      let top = -1
      for (const w of words) {
        if (Math.abs(w.offsetTop - top) > 4) {
          lines.push([])
          top = w.offsetTop
        }
        lines[lines.length - 1].push(w)
      }
      host.textContent = ''
      ch.current = lines.map((ws, i) => {
        const el = document.createElement('span')
        el.style.display = 'block'
        el.style.transformOrigin = '0 70%'
        el.textContent = ws.map((w) => w.textContent).join(' ')
        host.append(el)
        const cfg = settleLine(i, optsRef.current)
        return { o: createSpring(prevOn, { response: 0.34, damping: 1 }), b: createSpring(prevOn), m: createSpring(prevOn), el, cfg, timer: 0 }
      })
      ch.current.forEach(paint)
    }
    build()
    let alive = true
    document.fonts?.ready.then(() => {
      if (alive) {
        build()
        if (autoStart) settle(true)
      }
    })
    if (autoStart) settle(true)
    let width = host.clientWidth
    const ro = new ResizeObserver(() => {
      if (host.clientWidth !== width) {
        width = host.clientWidth
        build()
        settle((ch.current[0]?.m.state.target ?? 0) === 1)
      }
    })
    ro.observe(host)
    return () => {
      alive = false
      ro.disconnect()
      ch.current.forEach((c) => clearTimeout(c.timer))
      cancelAnimationFrame(raf.current)
      raf.current = 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const Any = Tag as 'h2'
  return (
    <Any aria-label={text} className={className}>
      {/* keyed on the text so React replaces this span wholesale; the lines we build inside it are never React's concern */}
      <span key={text} ref={root} style={{ display: 'block' }}>
        {text}
      </span>
    </Any>
  )
})
