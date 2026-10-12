'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createSpring, project as throwTo, SPRING_MOMENTUM, SPRING_SOFT } from '@space/motion/spring'
import { HAWTHORNE, VISIT_EMOJI } from '@/lib/presence/constants'
import { GLOBE_FALLBACK_VIEW } from '@/lib/presence/globe-fallback'
import type { LivePin, PastPin } from '@/lib/presence/protocol'
import { loadLand } from './globe/data'
import { createRenderer, projectPoint, rotation, SPHERE_FRACTION, type GlobeRenderer } from './globe/renderer'

interface Props {
  you: LivePin | null
  live: LivePin[]
  past: PastPin[]
  /** Run animation and drawing. False when the card is off screen or the tab is hidden. */
  active: boolean
  /** Where to look first (the visitor's area). */
  faceTo: { lat: number; lon: number } | null
  reducedMotion: boolean
}

const glyphOf = (id: string) => VISIT_EMOJI.find((e) => e.id === id)?.glyph ?? ''
const IDLE_DEG_PER_S = 3.2
const FALLBACK_FRACTION = GLOBE_FALLBACK_VIEW.radius / (GLOBE_FALLBACK_VIEW.size / 2)

type PinKind = 'you' | 'live' | 'past' | 'home'
interface PinRec {
  key: string
  kind: PinKind
  lat: number
  lon: number
  city: string
  glyph: string
}

export function GlobeView({ you, live, past, active, faceTo, reducedMotion }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const tip = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'pending' | 'gl' | 'fallback'>('pending')

  const pins = useMemo<PinRec[]>(() => {
    const out: PinRec[] = []
    past.forEach((p, i) => out.push({ key: 'p' + i, kind: 'past', lat: p.lat, lon: p.lon, city: p.city || p.country, glyph: glyphOf(p.emoji) }))
    live.forEach((p) => Number.isFinite(p.lat) && out.push({ key: 'l' + p.id, kind: 'live', lat: p.lat, lon: p.lon, city: p.city || p.country, glyph: glyphOf(p.emoji) }))
    out.push({ key: 'home', kind: 'home', lat: HAWTHORNE.lat, lon: HAWTHORNE.lon, city: HAWTHORNE.label, glyph: '' })
    if (you && Number.isFinite(you.lat)) out.push({ key: 'you', kind: 'you', lat: you.lat, lon: you.lon, city: you.city || you.country, glyph: glyphOf(you.emoji) })
    return out
  }, [you, live, past])

  const s = useRef({
    lon: createSpring(HAWTHORNE.lon, SPRING_SOFT),
    lat: createSpring(20, SPRING_SOFT),
    dragging: false,
    last: 0,
    raf: 0,
    size: 0,
    dpr: 1,
    renderer: null as GlobeRenderer | null,
    faced: false,
    tipKey: '' as string,
    pinned: false,
    activeNow: false,
    reduced: false,
    mode: 'pending' as 'pending' | 'gl' | 'fallback',
  })
  s.current.mode = mode
  s.current.reduced = reducedMotion
  s.current.activeNow = active

  const frame = useCallback((now: number) => {
    const st = s.current
    st.raf = 0
    const dt = Math.min(0.05, Math.max(0, (now - st.last) / 1000))
    st.last = now
    if (!st.dragging) {
      st.lon.step(dt)
      st.lat.step(dt)
    }
    const settled = Math.abs(st.lon.state.velocity) < 0.05 && Math.abs(st.lon.state.target - st.lon.state.value) < 0.02 && Math.abs(st.lat.state.velocity) < 0.05 && Math.abs(st.lat.state.target - st.lat.state.value) < 0.02
    let idle = false
    if (!st.dragging && settled && !st.reduced && !st.pinned) {
      st.lon.set(st.lon.state.value + IDLE_DEG_PER_S * dt)
      idle = true
    }
    const lon0 = st.lon.state.value
    const lat0 = st.lat.state.value
    st.renderer?.draw(lat0, lon0)
    place(lat0, lon0)
    if (st.activeNow && (st.dragging || idle || !settled)) st.raf = requestAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const kick = useCallback(() => {
    const st = s.current
    if (!st.raf) {
      st.last = performance.now()
      st.raf = requestAnimationFrame(frame)
    }
  }, [frame])

  /** Position every pin from the same projection the shader uses. */
  function place(lat0: number, lon0: number) {
    const st = s.current
    const L = layer.current
    if (!L || !st.size) return
    const rot = rotation(st.mode === 'fallback' ? GLOBE_FALLBACK_VIEW.lat : lat0, st.mode === 'fallback' ? GLOBE_FALLBACK_VIEW.lon : lon0)
    const R = (st.size / 2) * (st.mode === 'fallback' ? FALLBACK_FRACTION : SPHERE_FRACTION)
    const kids = L.children
    for (let i = 0; i < kids.length; i++) {
      const el = kids[i] as HTMLElement
      const lat = Number(el.dataset.lat)
      const lon = Number(el.dataset.lon)
      const p = projectPoint(lat, lon, rot)
      const vis = Math.max(0, Math.min(1, (p.z - 0.02) / 0.14))
      el.style.opacity = vis > 0 ? String(vis) : '0'
      el.style.pointerEvents = vis > 0.5 ? 'auto' : 'none'
      el.style.transform = `translate3d(${(st.size / 2 + p.x * R).toFixed(1)}px, ${(st.size / 2 - p.y * R).toFixed(1)}px, 0)`
    }
    // keep the tooltip on its pin
    const T = tip.current
    if (T && st.tipKey) {
      const el = L.querySelector<HTMLElement>(`[data-key="${st.tipKey}"]`)
      if (!el || el.style.opacity === '0') T.style.opacity = '0'
      else {
        T.style.transform = el.style.transform
        T.style.opacity = '1'
      }
    }
  }

  // Load land, set up the renderer (or fall back).
  useEffect(() => {
    let cancelled = false
    const st = s.current
    if (!active || st.renderer || mode === 'fallback') return
    loadLand()
      .then((rings) => {
        if (cancelled || !canvas.current) return
        const r = createRenderer(canvas.current, rings)
        if (!r) return setMode('fallback')
        st.renderer = r
        r.resize(st.size || 300, st.dpr)
        setMode('gl')
      })
      .catch(() => !cancelled && setMode('fallback'))
    return () => {
      cancelled = true
    }
  }, [active, mode])

  useEffect(
    () => () => {
      const st = s.current
      cancelAnimationFrame(st.raf)
      st.renderer?.destroy()
      st.renderer = null
    },
    [],
  )

  // Size and DPR (capped at 2).
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const apply = () => {
      const st = s.current
      st.size = el.clientWidth
      st.dpr = Math.min(2, window.devicePixelRatio || 1)
      st.renderer?.resize(st.size, st.dpr)
      kick()
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [kick, mode])

  // Ease to the visitor's area the first time we know where they are.
  useEffect(() => {
    const st = s.current
    if (!faceTo || st.faced) return
    st.faced = true
    const wrapLon = ((((faceTo.lon - st.lon.state.value) % 360) + 540) % 360) - 180
    if (st.reduced) {
      st.lon.set(st.lon.state.value + wrapLon)
      st.lat.set(Math.max(-55, Math.min(60, faceTo.lat * 0.7 + 8)))
    } else {
      st.lon.configure({ response: 1.6, damping: 1 })
      st.lat.configure({ response: 1.6, damping: 1 })
      st.lon.to(st.lon.state.value + wrapLon)
      st.lat.to(Math.max(-55, Math.min(60, faceTo.lat * 0.7 + 8)))
    }
    kick()
  }, [faceTo, kick])

  // Run only while active; draw one still frame otherwise.
  useEffect(() => {
    kick()
    return () => cancelAnimationFrame(s.current.raf)
  }, [active, mode, pins, kick])

  // Drag to rotate with inertia. Touch: horizontal only (vertical gestures scroll the page: touch-action pan-y).
  const drag = useRef({ x: 0, y: 0, t: 0, vx: 0, vy: 0, moved: 0 })
  const onDown = (e: React.PointerEvent) => {
    const st = s.current
    st.dragging = true
    st.pinned = false
    drag.current = { x: e.clientX, y: e.clientY, t: performance.now(), vx: 0, vy: 0, moved: 0 }
    st.lon.set(st.lon.state.value)
    st.lat.set(st.lat.state.value)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    kick()
  }
  const onMove = (e: React.PointerEvent) => {
    const st = s.current
    if (!st.dragging || !st.size) return
    const d = drag.current
    const now = performance.now()
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    const R = (st.size / 2) * SPHERE_FRACTION
    const k = (180 / Math.PI) / R
    const cosLat = Math.max(0.35, Math.cos((st.lat.state.value * Math.PI) / 180))
    st.lon.set(st.lon.state.value - (dx * k) / cosLat)
    if (e.pointerType !== 'touch') st.lat.set(Math.max(-70, Math.min(70, st.lat.state.value + dy * k)))
    const dtm = Math.max(1, now - d.t) / 1000
    d.vx = d.vx * 0.6 + ((-dx * k) / cosLat / dtm) * 0.4
    d.vy = d.vy * 0.6 + ((e.pointerType !== 'touch' ? dy * k : 0) / dtm) * 0.4
    d.moved += Math.abs(dx) + Math.abs(dy)
    d.x = e.clientX
    d.y = e.clientY
    d.t = now
    kick()
  }
  const onUp = () => {
    const st = s.current
    if (!st.dragging) return
    st.dragging = false
    const d = drag.current
    const fresh = performance.now() - d.t < 90
    const vx = fresh ? Math.max(-240, Math.min(240, d.vx)) : 0
    const vy = fresh ? Math.max(-120, Math.min(120, d.vy)) : 0
    st.lon.configure(SPRING_MOMENTUM)
    st.lat.configure(SPRING_MOMENTUM)
    if (st.reduced) {
      st.lon.set(st.lon.state.value)
    } else {
      st.lon.to(throwTo(st.lon.state.value, vx), vx)
      st.lat.to(Math.max(-70, Math.min(70, throwTo(st.lat.state.value, vy))), vy)
    }
    kick()
  }

  // Tooltip: hover on mouse, tap toggles on touch.
  const showTip = (key: string, pinned: boolean) => {
    const st = s.current
    const rec = pins.find((p) => p.key === key)
    const T = tip.current
    if (!rec || !T || rec.kind === 'home') return
    st.tipKey = key
    st.pinned = pinned
    T.textContent = rec.kind === 'you' ? `${rec.glyph} ${rec.city || ''}`.trim() : `${rec.glyph} ${rec.city}`.trim()
    place(st.lat.state.value, st.lon.state.value)
  }
  const hideTip = () => {
    const st = s.current
    st.tipKey = ''
    st.pinned = false
    if (tip.current) tip.current.style.opacity = '0'
  }
  const keyOf = (t: EventTarget | null) => (t as HTMLElement | null)?.closest<HTMLElement>('[data-key]')?.dataset.key

  return (
    <div
      ref={wrap}
      className="presence-globe"
      data-mode={mode}
      onPointerDown={onDown}
      onPointerMove={(e) => {
        onMove(e)
        if (!s.current.dragging && e.pointerType === 'mouse') {
          const k = keyOf(e.target)
          if (k) showTip(k, false)
          else if (!s.current.pinned) hideTip()
        }
      }}
      onPointerUp={(e) => {
        const moved = drag.current.moved
        onUp()
        if (moved < 6 && e.pointerType !== 'mouse') {
          const k = keyOf(e.target)
          if (k && k !== s.current.tipKey) showTip(k, true)
          else hideTip()
        }
      }}
      onPointerCancel={onUp}
      onPointerLeave={() => !s.current.pinned && hideTip()}
    >
      {/* Static drawing of the same coastlines: server-rendered placeholder, no-WebGL fallback. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="presence-globe__still" src="/globe/fallback.svg" alt="" width={400} height={400} decoding="async" draggable={false} />
      <canvas ref={canvas} className="presence-globe__canvas" aria-hidden />
      <div ref={layer} className="presence-globe__pins" aria-hidden>
        {pins.map((p) => (
          <div key={p.key} data-key={p.key} data-lat={p.lat} data-lon={p.lon} className={`pr pr--${p.kind}`}>
            <i />
            {p.kind === 'home' ? <span className="pr__label">{HAWTHORNE.label}</span> : null}
            {p.kind === 'you' && p.glyph ? <span className="pr__you">{p.glyph}</span> : null}
          </div>
        ))}
        <div ref={tip} className="pr-tip" style={{ opacity: 0 }} />
      </div>
    </div>
  )
}
