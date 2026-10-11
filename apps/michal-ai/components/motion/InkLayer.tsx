'use client'

import { useEffect, useRef } from 'react'
import { fbm1, mulberry32 } from '@space/motion/rng'
import { createSpring, isSettled, type Spring } from '@space/motion/spring'
import type { Pt } from '@space/motion/handStroke'

/** Streaky paper-fibre alpha tile, made once. Used to eat into the ink so its body is mottled and fibrous. */
let fibre: HTMLCanvasElement | null = null
function fibreTile() {
  if (fibre) return fibre
  const c = document.createElement('canvas')
  c.width = c.height = 160
  const g = c.getContext('2d')!
  const r = mulberry32(11)
  g.fillStyle = 'rgba(0,0,0,0.0)'
  for (let i = 0; i < 520; i++) {
    const x = r() * 160
    const y = r() * 160
    const len = 6 + r() * 26
    const a = (r() - 0.5) * 0.7 + 0.35
    g.strokeStyle = `rgba(0,0,0,${0.1 + r() * 0.35})`
    g.lineWidth = 0.4 + r() * 0.9
    g.beginPath()
    g.moveTo(x, y)
    g.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5 + (r() - 0.5) * 4, x + Math.cos(a) * len, y + Math.sin(a) * len)
    g.stroke()
  }
  fibre = c
  return c
}

type Blot = { x: number; y: number; seed: number; radius: Spring; alpha: Spring; released: boolean; age: number }
const N = 64

/**
 * The ink-soak press as a layer. Drop it inside any `position: relative; overflow: hidden` host (a glass pill, a plain
 * button): it listens to pointer events on its parent, so the host needs no handlers. The blot blooms from the touch
 * point along an irregular boundary (per-angle speeds and a ragged edge that grows as it spreads), pools darker at its
 * rim, is eaten into by paper fibre, and keeps soaking outward after release while it fades, slowly. Presses overlap:
 * each has its own springs. Draws in the host's `accent` colour; it sits behind the host's content, above its fill.
 */
export function InkLayer() {
  const cv = useRef<HTMLCanvasElement>(null)
  const host = useRef<HTMLElement | null>(null)
  const blots = useRef<Blot[]>([])
  const raf = useRef(0)
  const last = useRef(0)
  const size = useRef({ w: 0, h: 0, dpr: 1 })
  const active = useRef<Blot | null>(null)
  const seedN = useRef(1)

  const draw = () => {
    const c = cv.current
    if (!c) return
    const g = c.getContext('2d')!
    const { w, h, dpr } = size.current
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    const ink = getComputedStyle(c).color
    for (const b of blots.current) {
      const R = b.radius.state.value
      if (R < 0.5) continue
      const ragged = Math.min(1, R / 40) * 0.2
      const pts: Pt[] = []
      for (let i = 0; i < N; i++) {
        const th = (i / N) * Math.PI * 2
        // low-frequency: the blot travels further along some angles (the irregular boundary);
        // high-frequency: a fibrous, ragged edge that roughens as it spreads
        const k = 0.72 + 0.5 * fbm1(Math.cos(th) * 1.3 + Math.sin(th) * 1.3 + 2, b.seed, 2) + 0.28 * fbm1(th * 1.2 + 9, b.seed + 5, 2)
        const rough = 1 + ragged * fbm1(th * 9 + 40, b.seed + 9, 3)
        pts.push({ x: b.x + Math.cos(th) * R * k * rough, y: b.y + Math.sin(th) * R * k * rough })
      }
      g.save()
      g.globalAlpha = Math.max(0, b.alpha.state.value)
      g.fillStyle = ink
      g.strokeStyle = ink
      g.beginPath()
      pts.forEach((p, i) => {
        const q = pts[(i + 1) % N]
        const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
        if (i === 0) g.moveTo((pts[N - 1].x + p.x) / 2, (pts[N - 1].y + p.y) / 2)
        g.quadraticCurveTo(p.x, p.y, m.x, m.y)
      })
      g.closePath()
      g.fill()
      g.globalAlpha *= 0.9
      g.lineWidth = 1.4
      g.stroke() // ink pools at the rim
      g.restore()
    }
    // eat the body with fibre where the blots are
    g.save()
    g.globalCompositeOperation = 'destination-out'
    g.globalAlpha = 0.85
    const tile = fibreTile()
    const pat = g.createPattern(tile, 'repeat')!
    g.fillStyle = pat
    g.fillRect(0, 0, w, h)
    g.restore()
  }

  const loop = (now: number) => {
    const dt = Math.min((now - last.current) / 1000, 1 / 20)
    last.current = now
    let busy = false
    for (const b of blots.current) {
      b.age += dt
      b.radius.step(dt)
      b.alpha.step(dt)
      if (!(b.released && isSettled(b.alpha.state, 0.004) && b.alpha.state.target === 0)) busy = true
      else b.alpha.set(0)
      if (!b.released || !isSettled(b.radius.state, 0.05)) busy = true
    }
    blots.current = blots.current.filter((b) => !(b.released && b.alpha.state.target === 0 && b.alpha.state.value <= 0.004))
    draw()
    raf.current = busy && blots.current.length ? requestAnimationFrame(loop) : 0
    if (!raf.current) draw()
  }
  const kick = () => {
    if (!raf.current) {
      last.current = performance.now()
      raf.current = requestAnimationFrame(loop)
    }
  }

  const down = (e: PointerEvent) => {
    const el = host.current!
    const r = el.getBoundingClientRect()
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const reach = Math.hypot(r.width, r.height) * 0.62
    const b: Blot = {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      seed: (seedN.current += 17),
      radius: createSpring(reduce ? reach * 0.5 : 2, { response: 1.05, damping: 1 }),
      alpha: createSpring(reduce ? 0.46 : 0, { response: 0.28, damping: 1 }),
      released: false,
      age: 0,
    }
    b.radius.to(reach * 0.55)
    b.alpha.to(0.46)
    blots.current.push(b)
    if (blots.current.length > 4) blots.current.shift()
    active.current = b
    if (reduce) draw()
    else kick()
  }
  const up = () => {
    const b = active.current
    if (!b) return
    active.current = null
    b.released = true
    // soak: keep spreading (with the velocity it already has) while fading, far slower than the press
    b.radius.configure({ response: 1.5, damping: 1 })
    b.radius.to(Math.hypot(size.current.w, size.current.h) * 0.75)
    b.alpha.configure({ response: 1.5, damping: 1 })
    b.alpha.to(0)
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      blots.current = blots.current.filter((x) => x !== b)
      draw()
    } else kick()
  }

  useEffect(() => {
    const el = cv.current?.parentElement
    if (!el) return
    host.current = el
    const fit = () => {
      const r = el.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      size.current = { w: r.width, h: r.height, dpr }
      const c = cv.current!
      c.width = Math.round(r.width * dpr)
      c.height = Math.round(r.height * dpr)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    const onDown = (e: PointerEvent) => down(e)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('pointerleave', up)
    return () => {
      ro.disconnect()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('pointerleave', up)
      cancelAnimationFrame(raf.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <canvas ref={cv} aria-hidden className="ink-layer pointer-events-none absolute inset-0 h-full w-full text-accent" />
}
