'use client'

import { useEffect, useRef } from 'react'
import { acquire, getTrails, onTrailActivity, pruneTrails, pushSelfPointer, release } from '@/lib/presence/store'
import { readFieldColors, readPresenceColors } from './colors'
import { drawTrails } from './trails'
import { createGLRenderer } from './renderer-gl'
import { create2DRenderer } from './renderer-2d'
import type { FieldColors, Renderer } from './field'
import { notifyLidarFrame, registerLidarSource } from './tap'

/**
 * Fixed full-viewport lidar field behind the page, plus visitor trails.
 *
 * Two stacked canvases inside one wrapper: the field (WebGL2, or Canvas2D
 * fallback) and a small 2D overlay for trails. Presence is self-contained: no
 * provider required. Fade it behind articles with `--lidar-opacity` (e.g. 0.4).
 */
export default function LidarBackground() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLCanvasElement>(null)
  const trailRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current!
    const fieldCanvas = fieldRef.current!
    const trailCanvas = trailRef.current!
    const tctx = trailCanvas.getContext('2d')
    if (!tctx) return

    acquire()

    let renderer: Renderer | null = createGLRenderer(fieldCanvas, () => stop())
    if (!renderer) renderer = create2DRenderer(fieldCanvas)
    if (!renderer) {
      release()
      return
    }

    const mqReduce = matchMedia('(prefers-reduced-motion: reduce)')
    const mqDark = matchMedia('(prefers-color-scheme: dark)')
    let reduce = mqReduce.matches
    let colors: FieldColors = readFieldColors(wrap)
    let presenceColors = readPresenceColors(wrap)
    let w = 1
    let h = 1
    let dpr = 1
    let t = 0
    let px = 0
    let py = 0
    let tx = 0
    let ty = 0
    let raf = 0
    let last = 0
    let onScreen = true
    let trailsDirty = false
    let disposed = false

    const running = () => !document.hidden && onScreen && !disposed

    const frame = (scan: boolean) => {
      renderer!.draw({ t, scan, px, py, scrollY: window.scrollY, colors })
      notifyLidarFrame() // glass engine may sample the canvas in this task (see ./tap)
    }

    const drawTrailLayer = (now: number) => {
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      tctx.clearRect(0, 0, w, h)
      const alive = pruneTrails(now)
      if (alive) drawTrails(tctx, getTrails(), presenceColors, w, h, now)
      trailsDirty = alive
    }

    const resize = () => {
      w = Math.max(1, wrap.clientWidth)
      h = Math.max(1, wrap.clientHeight)
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      renderer!.resize(w, h, dpr)
      trailCanvas.width = Math.round(w * dpr)
      trailCanvas.height = Math.round(h * dpr)
      frame(!reduce)
      drawTrailLayer(performance.now())
    }

    const tick = (now: number) => {
      raf = 0
      if (!running()) return
      if (reduce) {
        // Still frame for the field; only trails keep a (cheap) loop while visible.
        drawTrailLayer(now)
        if (trailsDirty) raf = requestAnimationFrame(tick)
        return
      }
      raf = requestAnimationFrame(tick)
      const dt = now - last
      if (dt < 15) return // cap at ~60fps on 90/120Hz displays
      last = now
      t += Math.min(dt, 100) / 1000
      px += (tx - px) * 0.05
      py += (ty - py) * 0.05
      frame(true)
      drawTrailLayer(now)
    }

    const start = () => {
      if (raf || !running()) return
      last = performance.now()
      raf = requestAnimationFrame(tick)
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }

    const refreshColors = () => {
      colors = readFieldColors(wrap)
      presenceColors = readPresenceColors(wrap)
      frame(!reduce)
    }

    // pointer / touch -> own trail (+ parallax target)
    const onPointer = (e: PointerEvent) => {
      const vw = window.innerWidth || 1
      const vh = window.innerHeight || 1
      pushSelfPointer(e.clientX / vw, e.clientY / vh)
      tx = (e.clientX / vw) * 2 - 1
      ty = (e.clientY / vh) * 2 - 1
    }
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('pointerdown', onPointer, { passive: true })

    onTrailActivity(() => {
      if (!raf) start()
    })

    const onVisibility = () => {
      if (document.hidden) stop()
      else {
        refreshColors()
        start()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      if (onScreen) start()
      else stop()
    })
    io.observe(wrap)

    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const onReduceChange = () => {
      reduce = mqReduce.matches
      stop()
      frame(!reduce)
      start()
    }
    mqReduce.addEventListener('change', onReduceChange)
    mqDark.addEventListener('change', refreshColors)
    // Theme toggles that flip a class / data attribute instead of the OS setting.
    const mo = new MutationObserver(refreshColors)
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'data-color-scheme', 'style'],
    })

    registerLidarSource({ canvas: fieldCanvas, redraw: () => frame(!reduce) })
    resize()
    start()

    return () => {
      registerLidarSource(null)
      disposed = true
      stop()
      onTrailActivity(null)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('visibilitychange', onVisibility)
      io.disconnect()
      ro.disconnect()
      mo.disconnect()
      mqReduce.removeEventListener('change', onReduceChange)
      mqDark.removeEventListener('change', refreshColors)
      renderer?.destroy()
      release()
    }
  }, [])

  const layer = { position: 'absolute', inset: 0, width: '100%', height: '100%' } as const
  return (
    <div
      ref={wrapRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        opacity: 'var(--lidar-opacity, 1)',
        transition: 'opacity 240ms ease',
      }}
    >
      <canvas ref={fieldRef} style={layer} />
      <canvas ref={trailRef} style={layer} />
    </div>
  )
}
