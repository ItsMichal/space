'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { HAWTHORNE } from '@/lib/presence/constants'
import { createPresenceClient, EMPTY_PRESENCE, type PresenceClient } from '@/lib/presence/client'
import { PRESENCE_PINS } from '@/lib/presence/flag'
import { createMockPresence } from '@/lib/presence/mock'
import { GLOBE_FALLBACK_VIEW } from '@/lib/presence/globe-fallback'
import { loadLand } from './globe/data'
import { createRenderer, projectPoint, rotation, SPHERE_FRACTION, type GlobeRenderer } from './globe/renderer'
import './presence.css'

const DEG_PER_S = 2.4
const START = { lat: 18, lon: -100 } // must match GLOBE_FALLBACK_VIEW
const FALLBACK_FRACTION = GLOBE_FALLBACK_VIEW.radius / (GLOBE_FALLBACK_VIEW.size / 2)

interface Props {
  /** Show small dots for live visitors and the Hawthorne mark. Defaults to the PRESENCE_PINS flag (off). */
  pins?: boolean
  /** Demo only: fixed made-up visitors instead of the Worker. */
  mock?: boolean
  /** 'bleed' (default): positioned by the component's CSS to run off the right/top edge of a `position:relative; overflow:hidden` hero. 'full': fills its parent as a square; the parent positions it. */
  variant?: 'slot' | 'bleed' | 'full'
  className?: string
}

/**
 * Decorative background globe: fine dot-grid land, hairline coast and graticule, very slow constant rotation.
 * Not interactive (pointer-events none, aria-hidden, nothing focusable). Fills its parent's width as a square; the parent
 * decides position, size and opacity (see docs/presence.md). Static image under reduced motion or without WebGL2.
 */
export function HeroGlobe({ pins = PRESENCE_PINS, mock = false, variant = 'slot', className = '' }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'pending' | 'gl' | 'fallback'>('pending')
  const [active, setActive] = useState(false)
  const st = useRef({ lon: START.lon, size: 0, dpr: 1, raf: 0, last: 0, r: null as GlobeRenderer | null, reduced: false, active: false, mode: 'pending' as string })
  st.current.mode = mode
  st.current.active = active

  const client = useMemo<PresenceClient | null>(() => (pins ? (mock ? createMockPresence() : createPresenceClient()) : null), [pins, mock])
  const presence = useSyncExternalStore(
    (cb) => (client ? client.subscribe(cb) : () => {}),
    () => (client ? client.getState() : EMPTY_PRESENCE),
    () => EMPTY_PRESENCE,
  )
  const dots = useMemo(() => {
    if (!pins) return []
    const out = presence.live.filter((p) => Number.isFinite(p.lat)).map((p) => ({ k: p.id, lat: p.lat, lon: p.lon, cls: 'hg-dot' }))
    if (presence.you && Number.isFinite(presence.you.lat)) out.push({ k: 'you', lat: presence.you.lat, lon: presence.you.lon, cls: 'hg-dot' })
    return out
  }, [pins, presence])

  // Where the hero text sits, in canvas pixels: the dots thin out behind it (see the shader). Measured on resize and when fonts
  // arrive, never per frame. Elements opt in with data-hero-text; the value is how much of the dot alpha stays behind them.
  const measureText = () => {
    const s = st.current
    const el = wrap.current
    if (!s.r || !el || !s.size) return
    const w = el.getBoundingClientRect()
    const sc = Math.round(s.size * s.dpr) / (w.width || 1)
    const px = Math.round(s.size * s.dpr)
    const list: { box: [number, number, number, number]; dim: number }[] = []
    document.querySelectorAll<HTMLElement>('[data-hero-text]').forEach((t) => {
      const range = document.createRange()
      range.selectNodeContents(t)
      const r = range.getBoundingClientRect()
      if (!r.width || !r.height) return
      const dim = Number(t.dataset.heroText) || 0.15
      list.push({ box: [(r.left - w.left) * sc, px - (r.bottom - w.top) * sc, (r.right - w.left) * sc, px - (r.top - w.top) * sc], dim })
    })
    s.r.setBoxes(list, 26 * sc)
  }

  const draw = () => {
    const s = st.current
    s.raf = 0
    const now = performance.now()
    const dt = Math.min(0.05, (now - s.last) / 1000)
    s.last = now
    const gl = s.mode === 'gl'
    if (!s.reduced && s.active) s.lon += DEG_PER_S * dt
    const lat = gl ? START.lat : GLOBE_FALLBACK_VIEW.lat
    const lon = gl ? s.lon : GLOBE_FALLBACK_VIEW.lon
    s.r?.draw(lat, lon, HAWTHORNE)
    const L = layer.current
    if (L && s.size) {
      const rot = rotation(lat, lon)
      const R = (s.size / 2) * (gl ? SPHERE_FRACTION : FALLBACK_FRACTION)
      for (let i = 0; i < L.children.length; i++) {
        const el = L.children[i] as HTMLElement
        const p = projectPoint(Number(el.dataset.lat), Number(el.dataset.lon), rot)
        el.style.opacity = String(Math.max(0, Math.min(1, (p.z - 0.02) / 0.14)))
        el.style.transform = `translate3d(${(s.size / 2 + p.x * R).toFixed(1)}px, ${(s.size / 2 - p.y * R).toFixed(1)}px, 0)`
      }
    }
    if (s.active && !s.reduced && gl) s.raf = requestAnimationFrame(draw)
  }
  const kick = () => {
    const s = st.current
    if (!s.raf) {
      s.last = performance.now()
      s.raf = requestAnimationFrame(draw)
    }
  }

  // Active only while near the viewport and the tab is visible.
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    st.current.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let near = false
    const update = () => setActive(near && document.visibilityState === 'visible')
    const io = new IntersectionObserver(([e]) => {
      near = e.isIntersecting
      update()
    }, { rootMargin: '120px' })
    io.observe(el)
    document.addEventListener('visibilitychange', update)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  // Renderer: created the first time the globe is near the viewport.
  useEffect(() => {
    if (!active || st.current.r || mode === 'fallback') return
    let cancelled = false
    loadLand()
      .then((rings) => {
        if (cancelled || !canvas.current) return
        // The hero's own ink colour, so the dots take the surface they sit on (opacity does the rest).
        const m = /rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(getComputedStyle(wrap.current!).color)
        const ink: [number, number, number] = m ? [+m[1] / 255, +m[2] / 255, +m[3] / 255] : [0.13, 0.13, 0.11]
        const r = createRenderer(canvas.current, rings, { ink, accent: [0.24, 0.42, 0.21] })
        if (!r) return setMode('fallback')
        st.current.r = r
        r.resize(st.current.size || 300, st.current.dpr)
        setMode('gl')
        void document.fonts?.ready.then(() => measureText())
      })
      .catch(() => !cancelled && setMode('fallback'))
    return () => {
      cancelled = true
    }
  }, [active, mode])

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const apply = () => {
      const s = st.current
      s.size = el.clientWidth
      s.dpr = Math.min(1.5, window.devicePixelRatio || 1)
      s.r?.resize(s.size, s.dpr)
      measureText()
      kick()
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => {
    kick()
    const s = st.current
    return () => {
      cancelAnimationFrame(s.raf)
      s.raf = 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, mode, dots])

  useEffect(() => {
    if (!client) return
    if (active) client.start()
    else client.pause()
  }, [active, client])
  useEffect(() => () => client?.destroy(), [client])
  useEffect(
    () => () => {
      const s = st.current
      s.r?.destroy()
      s.r = null
    },
    [],
  )

  return (
    <div ref={wrap} className={`hero-globe hero-globe--${variant} ${className}`} data-mode={mode} aria-hidden="true">
      {/* Static drawing of the same globe: server-rendered, shown under reduced motion / without WebGL2. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="hero-globe__still" src="/globe/fallback.png" alt="" width={400} height={400} decoding="async" />
      <canvas ref={canvas} className="hero-globe__canvas" />
      <div ref={layer} className="hero-globe__pins">
        {dots.map((d) => (
          <i key={d.k} data-lat={d.lat} data-lon={d.lon} className={d.cls} />
        ))}
      </div>
    </div>
  )
}
