'use client'

import { useEffect, useRef } from 'react'
import { createPetal, petalScaleX, stepPetal, type PetalState } from '@space/motion/petalPhysics'

/**
 * One petal, cut from the owner's own cherry-blossom photograph, falling like a petal: a thin plate that tumbles, so it
 * alternately stalls face-on and slips edge-on, swinging in arcs instead of falling along a line. Its apparent width is
 * the cosine of the tumble (foreshortening), and a faint dimming when it turns edge-on stands in for light. A breath of
 * air follows the pointer; a tap flicks it. Off-screen or in a hidden tab the loop stops. Reduced motion draws the
 * petal at rest and nothing else.
 */
export function DriftingPetal({ width = 34, className = '', global = false }: { width?: number; className?: string; global?: boolean }) {
  const stage = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = stage.current!
    const c = cv.current!
    const g = c.getContext('2d')!
    const img = new Image()
    img.src = '/motion/petal.png'
    let W = 0
    let H = 0
    let dpr = 1
    const fit = () => {
      const r = el.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      W = r.width
      H = r.height
      c.width = Math.round(W * dpr)
      c.height = Math.round(H * dpr)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)

    let seed = 3
    let p: PetalState = createPetal(W * 0.3, -20, seed)
    let fadeIn = 0
    const wind = { x: 0, y: 0, tx: 0, ty: 0 }
    let running = false
    let raf = 0
    let last = 0
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

    const render = () => {
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, W, H)
      if (!img.complete || !img.naturalWidth) return
      const h = width * (img.naturalHeight / img.naturalWidth)
      const sx = reduce ? 1 : petalScaleX(p.theta)
      g.save()
      g.translate(p.x, p.y)
      g.rotate(p.rot)
      g.scale(sx, 1)
      g.globalAlpha = Math.min(1, fadeIn) * (0.78 + 0.22 * sx)
      g.drawImage(img, -width / 2, -h / 2, width, h)
      g.restore()
    }

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20)
      last = now
      // air follows the pointer's last push and relaxes back to still
      wind.x += (wind.tx - wind.x) * Math.min(1, dt * 2.5)
      wind.y += (wind.ty - wind.y) * Math.min(1, dt * 2.5)
      wind.tx *= Math.pow(0.25, dt)
      wind.ty *= Math.pow(0.25, dt)
      p = stepPetal(p, dt, wind)
      fadeIn = Math.min(1, fadeIn + dt * 1.4)
      if (p.y > H + 30 || p.x < -40 || p.x > W + 40) {
        seed += 1
        p = createPetal(W * (0.15 + 0.7 * ((seed * 0.618) % 1)), -24, seed)
        fadeIn = 0
      }
      render()
      raf = running ? requestAnimationFrame(tick) : 0
    }
    const start = () => {
      if (reduce || running) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(tick)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
      raf = 0
    }

    img.onload = () => {
      if (reduce) {
        p = { ...createPetal(W * 0.5, H * 0.62, 5), theta: 0.5, rot: -0.5 }
        fadeIn = 1
        render()
      } else if (!running) {
        render()
      }
    }

    const io = new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? start() : stop()))
    io.observe(el)
    const vis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', vis)

    let lx = 0
    let ly = 0
    let lt = 0
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      const now = performance.now()
      const dt = Math.max(8, now - lt) / 1000
      if (lt && now - lt < 200) {
        const near = Math.exp(-Math.hypot(x - p.x, y - p.y) / 140) // pointer only stirs the air near the petal
        wind.tx = Math.max(-260, Math.min(260, ((x - lx) / dt) * 0.35 * near))
        wind.ty = Math.max(-200, Math.min(200, ((y - ly) / dt) * 0.25 * near))
      }
      lx = x
      ly = y
      lt = now
    }
    const flick = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const dx = p.x - (e.clientX - r.left)
      const dy = p.y - (e.clientY - r.top)
      const d = Math.hypot(dx, dy) || 1
      const k = Math.exp(-d / 130)
      p = { ...p, vx: p.vx + (dx / d) * 220 * k, vy: p.vy + (dy / d) * 140 * k - 40 * k, omega: p.omega + 4 * k }
    }
    // `global`: the stage is a pointer-transparent overlay, so the air is stirred by the window's pointer instead.
    const tgt: HTMLElement | Window = global ? window : el
    tgt.addEventListener('pointermove', move as EventListener, { passive: true })
    tgt.addEventListener('pointerdown', flick as EventListener, { passive: true })
    return () => {
      stop()
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', vis)
      tgt.removeEventListener('pointermove', move as EventListener)
      tgt.removeEventListener('pointerdown', flick as EventListener)
    }
  }, [width, global])

  return (
    <div ref={stage} className={`relative overflow-hidden ${className}`} style={{ touchAction: 'pan-y' }}>
      <canvas ref={cv} aria-hidden className="absolute inset-0 h-full w-full" />
    </div>
  )
}
