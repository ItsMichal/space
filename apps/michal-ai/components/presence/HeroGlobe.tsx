'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPresenceClient, EMPTY_PRESENCE, type PresenceClient } from '@/lib/presence/client'
import { PRESENCE_PINS } from '@/lib/presence/flag'
import { createMockPresence } from '@/lib/presence/mock'
import { GLOBE_FALLBACK_VIEW } from '@/lib/presence/globe-fallback'
import { gmst } from '@/lib/starlink/orbit.mjs'
import { loadLand } from './globe/data'
import { loadStarlink, type Packed } from './globe/starlink'
import { buildAtlas, loadPortrait } from './globe/portrait'
import { createRenderer, projectPoint, rotation, SPHERE_FRACTION, type GlobeRenderer, type PortraitSpec } from './globe/renderer'
import './presence.css'

const DEG_PER_S = 2.4
const START = { lat: 18, lon: -100 } // must match GLOBE_FALLBACK_VIEW
const FALLBACK_FRACTION = GLOBE_FALLBACK_VIEW.radius / (GLOBE_FALLBACK_VIEW.size / 2)
/** Constellation dot strength (of the ink alpha) and fade-in time. */
const SAT_ALPHA = 0.7
const SAT_FADE_MS = 1600
/** Keep every n-th satellite on small canvases. */
const thinFor = (cssSize: number) => (cssSize < 520 ? 3 : 2)
/** The phrase's own enter animation: 160 ms delay + 320 ms, cubic-bezier(0.22, 1, 0.36, 1) (app/styles/craft.css, --ease-out-soft). */
const CUT_MS = 480
const PUSH_RADIUS = 100 // CSS px
const PUSH_MAX = 12 // CSS px
const PTR_IDLE_MS = 1500

const PORTRAIT_FADE_MS = 1400
/** Hero layout switch: below this the portrait is a small circle beside the name, from here it stands over the globe. */
const FIGURE_MIN_WIDTH = 768

type Cut = { box: [number, number, number, number]; dim: number }

/** cubic-bezier(x1,y1,x2,y2) as a function of progress (Newton on x, 5 steps is plenty for these curves). */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  return (x: number) => {
    let t = x
    for (let i = 0; i < 6; i++) {
      const e = ((ax * t + bx) * t + cx) * t - x
      const d = (3 * ax * t + 2 * bx) * t + cx
      if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break
      t -= e / d
    }
    return ((ay * t + by) * t + cy) * t
  }
}
const easeOutSoft = bezier(0.22, 1, 0.36, 1)

function currentCut(s: { cut: Cut[]; anim: null | { from: Cut[]; to: Cut[]; t0: number } }, now: number): Cut[] {
  const a = s.anim
  if (!a) return s.cut
  const e = easeOutSoft(Math.min(1, (now - a.t0) / CUT_MS))
  return a.to.map((c, i) => ({ dim: c.dim, box: c.box.map((v, k) => a.from[i].box[k] + (v - a.from[i].box[k]) * e) as Cut['box'] }))
}

/** Critically damped follow: advances (x, v) towards target with angular frequency w. */
function damp(o: { x: number; v: number }, target: number, w: number, dt: number) {
  const a = o.x - target
  const t = o.v + w * a
  const e = Math.exp(-w * dt)
  o.x = target + (a + t * dt) * e
  o.v = (o.v - w * t * dt) * e
}

interface Props {
  /** Show small dots for live visitors. Defaults to the PRESENCE_PINS flag (off). */
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
  const st = useRef({
    lon: START.lon, size: 0, dpr: 1, raf: 0, last: 0, r: null as GlobeRenderer | null, reduced: false, active: false, mode: 'pending' as string,
    sat: null as Packed | null, satFrom: 0,
    portrait: null as null | { aspect: number; from: number }, pspec: null as PortraitSpec | null, pstr: 0, globeA: 0.4,
    cut: [] as Cut[], cutFeather: 24, anim: null as null | { from: Cut[]; to: Cut[]; t0: number },
    freeze: false, fine: false, pin: null as null | [number, number],
    px: { x: 0, v: 0 }, py: { x: 0, v: 0 }, pk: { x: 0, v: 0 }, tx: 0, ty: 0, over: false, lastMove: 0,
  })
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
  const measureText = (animate = false) => {
    const s = st.current
    const el = wrap.current
    if (!s.r || !el || !s.size) return
    const w = el.getBoundingClientRect()
    const sc = Math.round(s.size * s.dpr) / (w.width || 1)
    const px = Math.round(s.size * s.dpr)
    const list: Cut[] = []
    document.querySelectorAll<HTMLElement>('[data-hero-text]').forEach((t) => {
      // The rotating line: the cutout follows the stem and the phrase on screen, not the union of every phrase.
      const live = t.querySelector<HTMLElement>('[data-hook]')
      const parts = live
        ? [live.querySelector<HTMLElement>('.hook__stem'), live.querySelector<HTMLElement>('.hook__item[data-current] .hook__link')].filter((n): n is HTMLElement => !!n)
        : [t]
      let l = Infinity, tp = Infinity, rt = -Infinity, bt = -Infinity
      // Union of the actual text runs, not the element boxes: block-level lines (the name's two spans) would otherwise
      // report the full container width and dim everything to the right of the text.
      for (const n of parts) {
        const walker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT)
        for (let tn = walker.nextNode(); tn; tn = walker.nextNode()) {
          if (!tn.textContent?.trim()) continue
          const range = document.createRange()
          range.selectNodeContents(tn)
          const r = range.getBoundingClientRect()
          if (!r.width || !r.height) continue
          l = Math.min(l, r.left); tp = Math.min(tp, r.top); rt = Math.max(rt, r.right); bt = Math.max(bt, r.bottom)
        }
      }
      if (!Number.isFinite(l)) return
      const dim = Number(t.dataset.heroText) || 0.15
      list.push({ box: [(l - w.left) * sc, px - (bt - w.top) * sc, (rt - w.left) * sc, px - (tp - w.top) * sc], dim })
    })
    const prev = s.anim ? currentCut(s, performance.now()) : s.cut
    const same = prev.length === list.length && prev.every((c, i) => c.box.every((v, k) => Math.abs(v - list[i].box[k]) < 1))
    if (same) return
    s.cutFeather = 26 * sc
    if (animate && !s.reduced && prev.length === list.length && s.active) {
      s.anim = { from: prev.map((c) => ({ ...c, box: [...c.box] as Cut['box'] })), to: list, t0: performance.now() }
    } else {
      s.anim = null
      s.cut = list
      s.r.setBoxes(list, s.cutFeather)
      kick()
    }
  }

  /** Where the portrait goes, in canvas px: a figure over the globe from 768px, a small circle beside the name below. */
  const layoutPortrait = () => {
    const s = st.current
    const el = wrap.current
    if (!s.portrait || !el || !s.size) return
    const w = el.getBoundingClientRect()
    const px = Math.round(s.size * s.dpr)
    const sc = px / (w.width || 1)
    const vw = window.innerWidth
    let left: number, bottom: number, width: number, height: number
    let cellW: number
    let circle = false
    let crop: PortraitSpec['crop'] = [0, 0, 1, 1]
    let strength = 0.72
    let edge = 0
    let boost = 1
    if (vw >= FIGURE_MIN_WIDTH) {
      const hb = document.getElementById('work-h')?.getBoundingClientRect()
      // He runs down behind the first card (the card is on top and crops him): bottom is 150px below the heading.
      const anchor = hb ? hb.bottom + 10 : w.top + w.height * 0.7
      bottom = anchor + 150
      height = Math.max(300, Math.min(760, bottom - 64))
      width = height * 0.75
      left = w.left + w.width * 0.54 - 0.44 * width
      cellW = 3.2
      edge = 70 * sc // the part below the card's right edge fades out in dots
    } else {
      const box = document.querySelector<HTMLElement>('h1[data-hero-text]')?.parentElement?.getBoundingClientRect()
      const D = Math.max(72, Math.min(104, Math.round(vw * 0.26)))
      width = height = D
      left = Math.min((box?.right ?? vw - 16) + 6, vw - 10) - D
      bottom = 60 + D
      cellW = 1.7
      circle = true
      boost = 1.9
      // forehead to chin fills about 80% of the circle
      crop = [0.083, 0.033, 0.709, 0.503]
      strength = Math.min(1, s.globeA + 0.35)
    }
    // Glyphs where they resolve (desktop); density dots on a square grid in the small circle, where a glyph would be a smudge.
    const cellH = cellW / s.portrait.aspect
    // Measured: at 1x the glyphs (5-6 px tall) smear into a texture and the face is lost; halftone dots on a square 2.4 px grid hold the likeness.
    // From 1.5x device pixels the glyphs resolve, so desktop gets real monospace glyphs there. `?portrait=dots|glyphs` forces one.
    const force = new URLSearchParams(window.location.search).get('portrait')
    const dots = circle || force === 'dots' || (force !== 'glyphs' && sc < 1.4)
    const sq = circle ? cellW : Math.min(cellW, 2.4)
    // Thin glyph strokes carry less ink than dots at the same strength.
    if (!dots) strength = Math.min(1, strength * 1.35)
    s.pspec = {
      rect: [(left - w.left) * sc, px - (bottom - w.top) * sc, width * sc, height * sc],
      crop,
      cell: dots ? [sq * sc, sq * sc] : [cellW * sc, cellH * sc],
      circle,
      dots,
      strength,
      edge,
      boost,
      push: { radius: 90 * s.dpr, max: 5 * s.dpr },
    }
  }

  const draw = () => {
    const s = st.current
    s.raf = 0
    const now = performance.now()
    const dt = Math.min(0.05, (now - s.last) / 1000)
    s.last = now
    const gl = s.mode === 'gl'
    if (!s.reduced && s.active && !s.freeze) s.lon += DEG_PER_S * dt
    const lat = gl ? START.lat : GLOBE_FALLBACK_VIEW.lat
    const lon = gl ? s.lon : GLOBE_FALLBACK_VIEW.lon
    if (s.r && s.anim) {
      s.r.setBoxes(currentCut(s, now), s.cutFeather)
      if (now - s.anim.t0 >= CUT_MS) {
        s.cut = s.anim.to
        s.anim = null
      }
    }
    // Pointer: critically damped follow, strength eases to 0 when idle or away (spring back). Nothing runs for k == 0.
    let ptr: { x: number; y: number; k: number } | undefined
    if (s.fine && !s.reduced && s.r) {
      const wantK = s.pin || (s.over && now - s.lastMove < PTR_IDLE_MS) ? 1 : 0
      if (wantK > 0 && s.pk.x < 0.01) {
        s.px.x = s.tx; s.py.x = s.ty; s.px.v = s.py.v = 0
      }
      if (wantK > 0 || s.pk.x > 0.002) {
        damp(s.px, s.tx, 16, dt); damp(s.py, s.ty, 16, dt); damp(s.pk, wantK, 9, dt)
        s.pk.x = Math.max(0, Math.min(1, s.pk.x))
        if (s.pk.x > 0.002) ptr = { x: s.px.x, y: s.py.x, k: s.pk.x }
      }
    }
    const sat = s.sat
    const nowS = Date.now() / 1000
    const satAlpha = sat ? SAT_ALPHA * (s.reduced ? 1 : Math.min(1, (now - s.satFrom) / SAT_FADE_MS)) : 0
    s.r?.draw(lat, lon, {
      satT: sat ? nowS - sat.refEpoch : 0,
      gmst: sat ? gmst(nowS) : 0,
      satAlpha,
      satThin: thinFor(s.size),
      globeA: s.globeA,
      portrait: s.pspec && s.portrait ? { ...s.pspec, strength: s.pspec.strength * (s.reduced ? 1 : Math.min(1, (now - s.portrait.from) / PORTRAIT_FADE_MS)) } : undefined,
      ptr,
      push: { radius: PUSH_RADIUS * s.dpr, max: PUSH_MAX * s.dpr },
    })
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
    // Dev only: ?spin=0 freezes the decorative spin (satellites keep moving in real time), for motion screenshots.
    if (process.env.NODE_ENV !== 'production') st.current.freeze = new URLSearchParams(window.location.search).get('spin') === '0'
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
        const r = createRenderer(canvas.current, rings, { ink })
        if (!r) return setMode('fallback')
        st.current.r = r
        r.resize(st.current.size || 300, st.current.dpr)
        setMode('gl')
        void document.fonts?.ready.then(() => measureText())
        // The constellation arrives after the globe is up and fades in; without it (offline, stale elements) nothing is drawn.
        // The portrait: picture + a glyph atlas from the system monospace, after the globe is up and fonts are ready.
        void Promise.all([loadPortrait(), document.fonts?.ready]).then(([pic]) => {
          const atlas = buildAtlas(st.current.dpr)
          if (!pic || !atlas || st.current.r !== r) return
          r.setPortrait(pic, atlas.canvas, atlas.n)
          st.current.portrait = { aspect: atlas.aspect, from: performance.now() }
          layoutPortrait()
          kick()
        })
        void loadStarlink().then((p) => {
          if (!p || st.current.r !== r) return
          r.setSatellites(p.data)
          st.current.sat = p
          if (wrap.current) wrap.current.dataset.sats = String(p.count)
          st.current.satFrom = performance.now()
          kick()
        })
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
      s.dpr = Math.min(s.size < 600 ? 2 : 1.5, window.devicePixelRatio || 1)
      s.r?.resize(s.size, s.dpr)
      const ga = parseFloat(getComputedStyle(el).getPropertyValue('--hero-globe-opacity'))
      if (Number.isFinite(ga)) s.globeA = ga
      measureText()
      layoutPortrait()
      kick()
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // Pointer: window-level listener (the canvas never takes pointer events). Fine hover-capable pointers only, never under reduced motion.
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const s = st.current
    s.fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __globe?: unknown }).__globe = s
    if (!s.fine) return
    if (process.env.NODE_ENV !== 'production') {
      // Dev only: ?ptr=fx,fy pins the pointer at that fraction of the globe box (y down), for screenshots.
      const q = new URLSearchParams(window.location.search).get('ptr')
      const m = q ? q.split(',').map(Number) : null
      if (m && m.length === 2 && m.every(Number.isFinite)) {
        s.pin = [m[0], m[1]]
        const px = Math.round(s.size * s.dpr) || 1
        s.tx = m[0] * px
        s.ty = (1 - m[1]) * px
      }
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || s.pin) return
      const r = el.getBoundingClientRect()
      const px = Math.round(s.size * s.dpr)
      const k = px / (r.width || 1)
      s.over = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      s.tx = (e.clientX - r.left) * k
      s.ty = px - (e.clientY - r.top) * k
      s.lastMove = performance.now()
    }
    const leave = () => {
      s.over = false
    }
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    window.addEventListener('blur', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', leave)
      window.removeEventListener('blur', leave)
    }
  }, [])

  // The cutout follows the phrase on screen: remeasure (and ease) whenever the rotator marks another phrase current.
  useEffect(() => {
    if (mode !== 'gl') return
    const list = document.querySelector('.hook__list')
    if (!list) return
    const mo = new MutationObserver(() => measureText(true))
    mo.observe(list, { attributes: true, attributeFilter: ['data-current'], subtree: true })
    return () => mo.disconnect()
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
