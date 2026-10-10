'use client'

import { useEffect, useRef } from 'react'
import { makeBloom, mulberry32, type ColorKey, type Mark, type Species } from './blooms'

/**
 * Point-cloud wildflowers that bloom where you linger and dissolve when you move on.
 * One 2D canvas, DPR <= 2, a handful of blooms (<= 4 live), idle when nothing is alive.
 *
 * Motion law (Apple): every value is a critically damped spring, so any change of target (pointer returns,
 * scroll reverses) continues from the current value and velocity. Nothing queues, snaps or locks input.
 */

type Spring = { x: number; v: number }
/** Critically damped step toward `target`. `w` is the angular frequency (1/s); time constant is about 1/w. */
function step(s: Spring, target: number, w: number, dt: number) {
  const a = -2 * w * s.v - w * w * (s.x - target)
  s.v += a * dt
  s.x += s.v * dt
}

type Bloom = {
  species: Species
  marks: Mark[]
  x: number
  y: number
  scale: number
  open: Spring
  dissolve: Spring
  lean: Spring
  mode: 'held' | 'released'
  born: number
  away: number // seconds the pointer has been far from this bloom
  kind: 'pointer' | 'ambient' | 'scroll'
  seed: number
  target?: number
}

const MAX_LIVE = 4
const COLORS: Record<ColorKey, string> = {
  lupine: '--bloom-lupine',
  lupineSoft: '--bloom-lupine-soft',
  poppy: '--bloom-poppy',
  cream: '--bloom-poppy-cream',
  campion: '--bloom-campion',
  stem: '--bloom-stem',
  leaf: '--bloom-leaf',
  aqua: '--bloom-aqua',
}
const FALLBACK: Record<ColorKey, string> = {
  lupine: '#7d6ab8',
  lupineSoft: '#b3a5dc',
  poppy: '#d9a92f',
  cream: '#eadfb8',
  campion: '#c46f95',
  stem: '#6f8f62',
  leaf: '#5f9a4f',
  aqua: '#3f9db3',
}
// Unit shapes (no circles): a petal pointing up with a soft base, a highlight streak, a lopsided water drop.
const PETAL_D = 'M0 0 C0.95 -0.18 0.85 -0.8 0 -1 C-0.85 -0.8 -0.95 -0.18 0 0 Z'
const GLOSS_D = 'M-0.3 -0.2 Q-0.46 -0.55 -0.14 -0.82 Q-0.24 -0.5 -0.3 -0.2 Z'
const DROP_D = 'M0.05 -1 C0.75 -0.5 1.05 0.15 0.62 0.7 C0.25 1.1 -0.55 1.05 -0.85 0.55 C-1.1 0 -0.5 -0.5 0.05 -1 Z'
const SPARK_D = 'M-0.42 -0.1 Q-0.5 -0.45 -0.2 -0.58 Q-0.34 -0.35 -0.32 -0.05 Z'
let PETAL!: Path2D
let GLOSS!: Path2D
let DROP!: Path2D
let SPARK!: Path2D
function initShapes() {
  PETAL = new Path2D(PETAL_D)
  GLOSS = new Path2D(GLOSS_D)
  DROP = new Path2D(DROP_D)
  SPARK = new Path2D(SPARK_D)
}
const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

export function BloomCanvas({ anchorSelector = '[data-bloom-anchor]' }: { anchorSelector?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    initShapes()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const dark = window.matchMedia('(prefers-color-scheme: dark)')

    let dpr = 1
    let w = 0
    let h = 0
    const colors = { ...FALLBACK }
    const readColors = () => {
      const cs = getComputedStyle(canvas)
      for (const k of Object.keys(COLORS) as ColorKey[]) colors[k] = cs.getPropertyValue(COLORS[k]).trim() || FALLBACK[k]
    }
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      if (reduce.matches) draw(0)
    }

    const rnd = mulberry32((Date.now() & 0xffff) + 7)
    const blooms: Bloom[] = []
    const baseScale = () => (w < 640 ? 1.05 : 1.45)
    const species = (): Species => {
      const r = rnd()
      return r < 0.45 ? 'lupine' : r < 0.75 ? 'poppy' : 'campion'
    }
    const plant = (kind: Bloom['kind'], x: number, y: number, sp?: Species, openNow = 0): Bloom => {
      const s = sp ?? species()
      const seed = Math.floor(rnd() * 1e9)
      const b: Bloom = {
        species: s,
        marks: makeBloom(s, seed),
        x,
        y,
        scale: baseScale() * (0.85 + rnd() * 0.3),
        open: { x: openNow, v: 0 },
        dissolve: { x: 0, v: 0 },
        lean: { x: 0, v: 0 },
        mode: 'held',
        born: performance.now() / 1000,
        away: 0,
        kind,
        seed,
      }
      blooms.push(b)
      return b
    }

    // pointer state (smoothed so a jittery hand does not jitter the flowers)
    const ptr = { x: -1e4, y: -1e4, sx: -1e4, sy: -1e4, has: false, lastMove: 0, dwell: 0, speed: 0 }
    const onMove = (e: PointerEvent) => {
      ptr.x = e.clientX
      ptr.y = e.clientY
      if (!ptr.has) {
        ptr.sx = ptr.x
        ptr.sy = ptr.y
        ptr.has = true
      }
      ptr.lastMove = performance.now() / 1000
      wake()
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') onLeave()
    }
    const onLeave = () => {
      ptr.has = false
      ptr.x = ptr.y = ptr.sx = ptr.sy = -1e4
    }

    let raf = 0
    let last = 0
    let ambientAt = 0
    let lastPlant = 0
    const live = () => blooms.filter((b) => b.mode === 'held' && b.kind !== 'scroll').length

    function wake() {
      if (reduce.matches || raf || document.hidden) return
      last = performance.now() / 1000
      raf = requestAnimationFrame(frame)
    }

    function anchorBloom() {
      const el = document.querySelector(anchorSelector)
      let b = blooms.find((x) => x.kind === 'scroll')
      if (!el) {
        if (b) b.mode = 'released'
        return
      }
      const r = el.getBoundingClientRect()
      if (r.bottom < -200 || r.top > h + 200) {
        if (b) blooms.splice(blooms.indexOf(b), 1) // off screen: nothing to animate, the loop can sleep
        return
      }
      if (!b) b = plant('scroll', 0, 0, 'lupine')
      b.mode = 'held'
      b.x = r.left + r.width / 2
      b.y = r.bottom - 12
      b.scale = Math.min(r.height / 118, 2.3)
      // progress: 0 as the anchor's top meets the lower third of the viewport, 1 when its middle reaches the viewport middle
      const p = (h * 0.92 - r.top) / (h * 0.92 - (h * 0.5 - r.height / 2))
      b.target = Math.min(1, Math.max(0, p))
    }

    function frame(tms: number) {
      const now = tms / 1000
      const dt = Math.min(0.05, now - last)
      last = now
      raf = 0

      // smooth the pointer
      const k = 1 - Math.exp(-dt * 6)
      if (ptr.has) {
        const px = ptr.sx
        const py = ptr.sy
        ptr.sx += (ptr.x - ptr.sx) * k
        ptr.sy += (ptr.y - ptr.sy) * k
        ptr.speed = Math.hypot(ptr.sx - px, ptr.sy - py) / Math.max(dt, 1e-3)
        ptr.dwell = ptr.speed < 55 ? ptr.dwell + dt : 0
      }

      // plant where the pointer lingers (not on every move; never more than MAX_LIVE; never crowding)
      if (
        ptr.has &&
        ptr.dwell > 0.55 &&
        live() < MAX_LIVE &&
        now - lastPlant > 2.6 &&
        blooms.every((b) => b.kind === 'scroll' || Math.hypot(b.x - ptr.sx, b.y - ptr.sy) > 190 * (b.scale / 1.45))
      ) {
        plant('pointer', ptr.sx, ptr.sy + 36)
        lastPlant = now
      }

      // a single quiet ambient bloom when the visitor is still
      if (now > ambientAt && now - ptr.lastMove > 3 && live() < 2) {
        const x = w * (w < 640 ? 0.15 + rnd() * 0.7 : 0.58 + rnd() * 0.34)
        const y = h * (0.62 + rnd() * 0.28)
        plant('ambient', x, y)
        ambientAt = now + 9 + rnd() * 5
      }
      if (ambientAt === 0) ambientAt = now + 2.5

      anchorBloom()

      for (const b of blooms) {
        const t = b.target
        if (b.kind === 'scroll') {
          step(b.open, t ?? 0, 1.6, dt)
          continue
        }
        const age = now - b.born
        const near = ptr.has && Math.hypot(b.x - ptr.sx, b.y - b.scale * 40 - ptr.sy) < 120 * b.scale
        // Released blooms return to life if the pointer comes back, continuing from where they are.
        if (b.mode === 'released' && near && b.dissolve.x < 0.75) b.mode = 'held'
        if (b.mode === 'held') {
          b.away = near || !ptr.has ? 0 : Math.hypot(b.x - ptr.sx, b.y - ptr.sy) > 220 ? b.away + dt : b.away
          const lifespan = b.kind === 'ambient' ? 15 : 13
          if (age > lifespan || (b.kind === 'pointer' && b.away > 1.6)) b.mode = 'released'
        }
        step(b.open, 1, 0.55, dt) // petals stay unfolded while they fade
        step(b.dissolve, b.mode === 'released' ? 1 : 0, b.mode === 'released' ? 0.38 : 0.9, dt)
        const lean = ptr.has ? Math.max(-0.12, Math.min(0.12, (ptr.sx - b.x) / 1800)) : 0
        step(b.lean, lean, 1.1, dt)
      }
      for (let i = blooms.length - 1; i >= 0; i--) {
        const b = blooms[i]
        if (b.kind !== 'scroll' && b.mode === 'released' && b.dissolve.x > 0.995) blooms.splice(i, 1)
      }

      draw(now)
      const active = blooms.length > 0 || ptr.has
      if (active && !document.hidden) raf = requestAnimationFrame(frame)
      else if (!document.hidden) {
        // sleep until the next ambient bloom; pointer or scroll wakes sooner
        window.setTimeout(wake, Math.max(500, (ambientAt - now) * 1000))
      }
    }

    function draw(now: number) {
      const c = ctx!
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      c.clearRect(0, 0, w, h)
      for (const b of blooms) {
        const open = b.open.x
        const d = b.dissolve.x
        const fade = Math.min(1, open * 3)
        const shear = b.lean.x + Math.sin(now * 0.45 + b.seed) * 0.012
        const u = b.scale
        const growth = smooth(open * 1.15)
        for (const m of b.marks) {
          const o = smooth((open - m.delay) / 0.55)
          if (o <= 0.002) continue
          let dx = 0
          let dy = 0
          let alpha = m.alpha * o * fade
          if (d > 0.001) {
            const dd = smooth(d * 1.5 - m.rnd * 0.5)
            dx = (m.vx * 26 + Math.sin(now * 0.3 + m.rnd * 9) * 6) * dd
            dy = (-14 - m.rnd * 26) * dd * dd
            alpha *= 1 - dd
          }
          if (alpha <= 0.004) continue
          if (m.kind === 'stem' && m.pts) {
            const n = m.pts.length / 2 - 1
            const reach = growth * n
            c.strokeStyle = colors[m.color]
            c.lineCap = 'round'
            c.globalAlpha = alpha
            for (let i = 0; i < n && i < reach; i++) {
              const f = Math.min(1, reach - i)
              const x0 = m.pts[i * 2]
              const y0 = m.pts[i * 2 + 1]
              const x1 = x0 + (m.pts[i * 2 + 2] - x0) * f
              const y1 = y0 + (m.pts[i * 2 + 3] - y0) * f
              c.lineWidth = Math.max(0.5, m.wid * (1 - 0.55 * (i / n)) * u)
              c.beginPath()
              c.moveTo(b.x + (x0 - y0 * shear + dx) * u, b.y + (y0 + dy) * u)
              c.lineTo(b.x + (x1 - y1 * shear + dx) * u, b.y + (y1 + dy) * u)
              c.stroke()
            }
            continue
          }
          const x = m.hx * growth + m.ox * o + dx
          const y = m.hy * growth + m.oy * o + dy
          const px = b.x + (x - y * shear) * u
          const py = b.y + y * u
          const s = u * (0.55 + 0.45 * o) * (1 - 0.3 * smooth(d))
          c.setTransform(dpr, 0, 0, dpr, px * dpr, py * dpr)
          if (m.kind === 'drop') {
            const r = m.len * s
            c.scale(r, r)
            c.fillStyle = colors.aqua
            c.globalAlpha = alpha * 0.26
            c.fill(DROP)
            c.strokeStyle = colors.aqua
            c.lineWidth = 0.16
            c.globalAlpha = alpha * 0.7
            c.stroke(DROP)
            c.fillStyle = '#fff'
            c.globalAlpha = alpha * 0.9
            c.fill(SPARK)
          } else {
            c.rotate(m.rot + shear * 0.9 + (m.kind === 'petal' ? Math.sin(now * 0.5 + m.rnd * 6) * 0.02 : 0))
            c.scale(m.wid * m.len * s, m.len * s)
            c.fillStyle = colors[m.color]
            // watercolor edge: a faint, slightly larger bleed under the body
            c.globalAlpha = alpha * 0.2
            c.scale(1.16, 1.08)
            c.fill(PETAL)
            c.scale(1 / 1.16, 1 / 1.08)
            c.globalAlpha = alpha
            c.fill(PETAL)
            if (m.gloss) {
              c.fillStyle = '#fff'
              c.globalAlpha = alpha * 0.34
              c.fill(GLOSS)
            }
          }
          c.setTransform(dpr, 0, 0, dpr, 0, 0)
        }
      }
      c.globalAlpha = 1
    }

    // Reduced motion: one still frame, two mature blooms, no loop.
    const still = () => {
      blooms.length = 0
      const a = plant('ambient', w * (w < 640 ? 0.3 : 0.72), h * 0.82, 'lupine', 1)
      const b = plant('ambient', w * (w < 640 ? 0.72 : 0.88), h * 0.86, 'poppy', 1)
      for (const x of [a, b]) x.born = 1e9
      draw(0)
    }

    const boot = () => {
      readColors()
      resize()
      cancelAnimationFrame(raf)
      raf = 0
      if (reduce.matches) still()
      else {
        blooms.length = 0
        ambientAt = 0
        wake()
      }
    }

    const onScroll = () => wake()
    const onVis = () => {
      if (!document.hidden) wake()
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVis)
    dark.addEventListener('change', boot)
    reduce.addEventListener('change', boot)
    boot()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onMove)
      document.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVis)
      dark.removeEventListener('change', boot)
      reduce.removeEventListener('change', boot)
    }
  }, [anchorSelector])

  return <canvas ref={ref} aria-hidden="true" className="mood-layer" />
}
