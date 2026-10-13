'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPresenceClient, EMPTY_PRESENCE, type PresenceClient } from '@/lib/presence/client'
import { PRESENCE_PINS } from '@/lib/presence/flag'
import { createMockPresence } from '@/lib/presence/mock'
import { GLOBE_FALLBACK_VIEW } from '@/lib/presence/globe-fallback'
import { gmst, positionEcef } from '@/lib/starlink/orbit.mjs'
import { buildLinks } from '@/lib/starlink/links.mjs'
import { loadLand } from './globe/data'
import { loadStarlink, type Packed } from './globe/starlink'
import { buildAtlas, loadPortrait } from './globe/portrait'
import { createRenderer, PING_CAP, projectPoint, rotation, SHELL_SCALE, SPHERE_FRACTION, type GlobeRenderer, type PingSet, type PortraitSpec } from './globe/renderer'
import './presence.css'

const DEG_PER_S = 2.4
const START = { lat: 18, lon: -100 } // must match GLOBE_FALLBACK_VIEW
const FALLBACK_FRACTION = GLOBE_FALLBACK_VIEW.radius / (GLOBE_FALLBACK_VIEW.size / 2) / SHELL_SCALE
/** Constellation dot strength (of the ink alpha) and fade-in time. */
const SAT_ALPHA = 0.7
const SAT_FADE_MS = 1600
/** Keep every n-th satellite (and trail): fewer on small canvases. `base` is the globe box in CSS px (the canvas is SHELL_SCALE larger). */
const thinFor = (base: number) => (base < 520 ? 5 : 3)
/** Drawn orbit radius range, in globe radii. EXAGGERATED: the real shells are at 1.05 to 1.10 (docs/presence.md). */
const SHELL: [number, number] = [1.34, 1.58]
const trailFor = (base: number) => (base < 520 ? 45 : 90) // seconds of path
const pingsFor = (base: number) => (base < 520 ? 8 : 20) // simultaneous mesh pings
/** The phrase's own enter animation: 160 ms delay + 320 ms, cubic-bezier(0.22, 1, 0.36, 1) (app/styles/craft.css, --ease-out-soft). */
const CUT_MS = 480
const PUSH_RADIUS = 100 // CSS px
const PUSH_MAX = 12 // CSS px
const PTR_IDLE_MS = 1500

const PORTRAIT_FADE_MS = 1400
/** Hero layout switch: below this the portrait is a small bust beside the name, from here it stands over the globe. */
const FIGURE_MIN_WIDTH = 768

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
    maskT0: -1e9,
    links: null as null | { a: Int32Array; b: Int32Array },
    pg: null as null | { a: Float32Array; ad: Float32Array; b: Float32Array; bd: Float32Array; t: Float32Array; next: Float32Array },
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

  // The hero text as a soft halo mask: every glyph of the name, tagline, "I've built" and the phrase on screen (and "Selected work") is
  // drawn at its real position into a small offscreen canvas (1/4 of the canvas size) with a blurred shadow, and the shader shrinks and
  // fades dots by it, so the clearing follows the letter shapes and has no straight edges. Rebuilt only when the phrase changes, on
  // resize and when fonts arrive, never per frame; the old and new masks cross-fade over the phrase's own transition.
  const measureText = (animate = false) => {
    const s = st.current
    const el = wrap.current
    if (!s.r || !el || !s.size) return
    const w = el.getBoundingClientRect()
    const px = Math.round(s.size * s.dpr)
    const k = px / (w.width || 1) / 4 // CSS px -> mask px
    const M = Math.max(8, Math.ceil(px / 4))
    const c = document.createElement('canvas')
    c.width = M
    c.height = M
    const g = c.getContext('2d')
    if (!g) return
    g.fillStyle = '#000'
    g.fillRect(0, 0, M, M)
    g.fillStyle = '#fff'
    g.shadowColor = '#fff'
    g.shadowBlur = 15 * k
    g.textBaseline = 'alphabetic'
    const range = document.createRange()
    const drawNode = (tn: Text) => {
      const parent = tn.parentElement
      const text = tn.textContent
      if (!parent || !text || !text.trim()) return
      const cs = getComputedStyle(parent)
      g.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * k}px ${cs.fontFamily}`
      const asc = g.measureText('M').fontBoundingBoxAscent ?? parseFloat(cs.fontSize) * k * 0.8
      for (let i = 0; i < text.length; i++) {
        if (!text[i].trim()) continue
        range.setStart(tn, i)
        range.setEnd(tn, i + 1)
        const r = range.getBoundingClientRect()
        if (!r.width || !r.height) continue
        g.fillText(text[i], (r.left - w.left) * k, (r.top - w.top) * k + asc)
      }
    }
    const drawIn = (root: Element | null) => {
      if (!root) return
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let tn = walker.nextNode(); tn; tn = walker.nextNode()) drawNode(tn as Text)
    }
    document.querySelectorAll<HTMLElement>('[data-hero-text]').forEach((t) => {
      // The rotating line: the stem and the phrase on screen, not every phrase stacked in the rotator.
      const live = t.querySelector<HTMLElement>('[data-hook]')
      if (live) {
        drawIn(live.querySelector('.hook__stem'))
        drawIn(live.querySelector('.hook__item[data-current] .hook__link'))
      } else drawIn(t)
    })
    drawIn(document.getElementById('work-h'))
    const fade = animate && !s.reduced && s.active
    s.r.setMask(c, fade)
    s.maskT0 = fade ? performance.now() : -1e9
    kick()
  }

  /** Where the portrait goes, in canvas px: a figure over the globe from 768px, a small bust beside the name below. */
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
    let crop: PortraitSpec['crop'] = [0, 0, 1, 1]
    let edge = 0
    let sideTaper = false
    if (vw >= FIGURE_MIN_WIDTH) {
      const hb = document.getElementById('work-h')?.getBoundingClientRect()
      // He runs down behind the first card (the card is on top and crops him): bottom is 150px below the heading.
      const anchor = hb ? hb.bottom + 10 : w.top + w.height * 0.7
      bottom = anchor + 150
      height = Math.max(300, Math.min(760, bottom - 64))
      width = height * 0.75
      left = w.left + w.width / 2 + 0.04 * (w.width / SHELL_SCALE) - 0.44 * width
      cellW = sc >= 1.4 ? 2 : 2.4
      sideTaper = true
      edge = 18 * sc // a short dot taper where the figure passes the right edge of the card
    } else {
      // A small bust (head, neck, shoulders, upper jacket) at the top right. The picture is 3:4 and the head is about 0.56 of its
      // width tall, so a bust Wb wide has a head about 0.56 Wb tall (about 95 px at 375). The head must clear the name's last
      // glyph; whatever of the shoulders runs under text is dimmed by the same tight text cutout as the globe, and the bust bleeds
      // off the right edge of the page instead of being squeezed.
      let nameRight = 0
      const h1 = document.querySelector<HTMLElement>('h1[data-hero-text]')
      if (h1) {
        const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT)
        for (let tn = walker.nextNode(); tn; tn = walker.nextNode()) {
          if (!tn.textContent?.trim()) continue
          const range = document.createRange()
          range.selectNodeContents(tn)
          nameRight = Math.max(nameRight, range.getBoundingClientRect().right)
        }
      }
      const Wb = Math.max(140, Math.min(200, vw * 0.5))
      const headCentre = Math.max(nameRight + 6, vw * 0.7) + 0.18 * Wb
      left = headCentre - 0.4 * Wb
      const top = 62
      crop = [0, 0, 1, 0.57]
      width = Wb
      height = 0.57 * (4 / 3) * Wb
      bottom = top + height
      cellW = 1.1
      edge = 13 * sc // dots shrink to nothing over the last 13 CSS px, following the matte: no straight cut
    }
    // Halftone dots on a square grid are the default at every DPR (measured at 1x and 2x: glasses, eyes and mouth hold; monospace
    // glyphs read as texture). Glyphs (atlas from ui-monospace) are opt-in with `?portrait=glyphs`, desktop only.
    const force = new URLSearchParams(window.location.search).get('portrait')
    const dots = vw < FIGURE_MIN_WIDTH || force !== 'glyphs'
    const cellH = cellW / s.portrait.aspect
    // Whole device pixels everywhere (rect origin and size, cell size, at least 3 px per cell): the dot grid then lands on the pixel
    // grid at every DPR (1, 1.25, 1.5, 2, 3) and cannot beat against it into a moire.
    const cellPx = Math.max(3, Math.round(cellW * sc))
    const rx = Math.round((left - w.left) * sc)
    const ry = Math.round(px - (bottom - w.top) * sc)
    s.pspec = {
      rect: [rx, ry, Math.round(width * sc), Math.round(height * sc)],
      crop,
      cell: dots ? [cellPx, cellPx] : [2.6 * sc, (2.6 / s.portrait.aspect) * sc],
      sideTaper,
      dots,
      strength: 1,
      edge,
      push: { radius: 90 * s.dpr, max: 5 * s.dpr },
    }
    void cellH
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
    // Mesh pings: a few new ones per second, chosen from the precomputed neighbour table among links on the visible hemisphere.
    const base = s.size / SHELL_SCALE
    let pings: PingSet | undefined
    if (sat && s.links && s.links.a.length && !s.reduced && gl) {
      const P = (s.pg ??= { a: new Float32Array(PING_CAP * 4), ad: new Float32Array(PING_CAP), b: new Float32Array(PING_CAP * 4), bd: new Float32Array(PING_CAP), t: new Float32Array(PING_CAP * 2), next: new Float32Array(PING_CAP) })
      const K = Math.min(PING_CAP, pingsFor(base))
      const tNow = now / 1000
      const rot = rotation(lat, lon)
      const zOf = (i: number) => {
        const [x, y, z] = positionEcef(sat.data, i, sat.refEpoch, nowS)
        const r = Math.hypot(x, y, z)
        return (rot[2] * y + rot[5] * z + rot[8] * x) / r
      }
      for (let i = 0; i < K; i++) {
        if (tNow < P.t[i * 2] + P.t[i * 2 + 1] || tNow < P.next[i]) continue
        let done = false
        for (let tries = 0; tries < 14 && !done; tries++) {
          const li = (Math.random() * s.links.a.length) | 0
          const ia = s.links.a[li]
          const ib = s.links.b[li]
          if (zOf(ia) > 0.3 && zOf(ib) > 0.3) {
            for (let k = 0; k < 4; k++) {
              P.a[i * 4 + k] = sat.data[ia * 5 + k]
              P.b[i * 4 + k] = sat.data[ib * 5 + k]
            }
            P.ad[i] = sat.data[ia * 5 + 4]
            P.bd[i] = sat.data[ib * 5 + 4]
            P.t[i * 2] = tNow
            P.t[i * 2 + 1] = 0.6 + Math.random() * 0.6
            P.next[i] = tNow + P.t[i * 2 + 1] + 0.15 + Math.random() * 1.4
            done = true
          }
        }
        if (!done) P.next[i] = tNow + 0.25
      }
      pings = { count: K, a: P.a, ad: P.ad, b: P.b, bd: P.bd, t: P.t, now: tNow }
    }
    s.r?.draw(lat, lon, {
      shell: SHELL,
      trailSeconds: sat ? trailFor(base) : 0,
      pings,
      satT: sat ? nowS - sat.refEpoch : 0,
      gmst: sat ? gmst(nowS) : 0,
      satAlpha,
      satThin: thinFor(base),
      globeA: s.globeA,
      maskMix: s.reduced ? 1 : easeOutSoft(Math.min(1, (now - s.maskT0) / CUT_MS)),
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
    if (process.env.NODE_ENV !== 'production') {
      const q = new URLSearchParams(window.location.search)
      st.current.freeze = q.get('spin') === '0'
      // Dev only: ?lon=-100 starts the globe at that longitude (with spin=0 it stays), to put dense land behind the text.
      if (q.get('lon') !== null && Number.isFinite(Number(q.get('lon')))) st.current.lon = Number(q.get('lon'))
    }
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
          st.current.links = buildLinks(p.data, p.count)
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
      s.dpr = Math.min(s.size / SHELL_SCALE < 600 ? 3 : 1.5, window.devicePixelRatio || 1)
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
