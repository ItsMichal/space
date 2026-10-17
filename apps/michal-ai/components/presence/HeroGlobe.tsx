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
import { createRenderer, PING_CAP, projectPoint, rotation, SHELL_SCALE, SPHERE_FRACTION, type GlobeRenderer, type PingSet } from './globe/renderer'
import './presence.css'

const DEG_PER_S = 2.4
const START = { lat: 18, lon: -100 } // must match GLOBE_FALLBACK_VIEW
const FALLBACK_FRACTION = GLOBE_FALLBACK_VIEW.radius / (GLOBE_FALLBACK_VIEW.size / 2)
/** Constellation dot strength (of the ink alpha) and fade-in time. */
const SAT_ALPHA = 0.45
const SAT_FADE_MS = 1600
/** Keep every n-th satellite (and trail): fewer on small canvases. `base` is the globe box in CSS px (the canvas is SHELL_SCALE larger). */
const thinFor = (base: number) => (base < 520 ? 14 : 8)
/** Drawn orbit radius range, in globe radii. EXAGGERATED: the real shells are at 1.05 to 1.10 (docs/presence.md). */
const SHELL: [number, number] = [2.6, 3.1]
const trailFor = (base: number) => (base < 520 ? 60 : 90) // seconds of path (about 3 and 5 minutes)
const pingsFor = (base: number) => (base < 520 ? 4 : 10) // simultaneous mesh pings (comets)
/** The phrase's own enter animation: 160 ms delay + 320 ms, cubic-bezier(0.22, 1, 0.36, 1) (app/styles/craft.css, --ease-out-soft). */
const CUT_MS = 480
const PUSH_RADIUS = 130 // CSS px (gaussian field)
const PUSH_MAX = 14 // CSS px
const SPRING_W = 13 // rad/s, pointer field spring
const SPRING_ZETA = 0.65 // under-damped: a little overshoot, a slow settle
const WAKE_GAIN = 0.07 // px of drag per px/s of pointer velocity
/** The shell canvas (satellites, trails, pings) is drawn at low resolution: at most this many pixels, at most 1.25 device pixels per CSS pixel. */
const shellDprFor = (box: number, deviceDpr: number) => {
  const cap = box < 520 ? 1.2e6 : 2.5e6
  return Math.max(0.6, Math.min(1.25, deviceDpr, Math.sqrt(cap) / (box * SHELL_SCALE)))
}
const PTR_IDLE_MS = 1500

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
  const shellCanvas = useRef<HTMLCanvasElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'pending' | 'gl' | 'fallback'>('pending')
  const [active, setActive] = useState(false)
  const st = useRef({
    lon: START.lon, size: 0, dpr: 1, raf: 0, last: 0, r: null as GlobeRenderer | null, sr: null as GlobeRenderer | null, sdpr: 1, devT: null as number | null, pingDemo: false, demoLink: -1, reduced: false, active: false, mode: 'pending' as string,
    sat: null as Packed | null, satFrom: 0,
    globeA: 0.4,
    maskT0: -1e9,
    links: null as null | { a: Int32Array; b: Int32Array },
    pg: null as null | { a: Float32Array; ad: Float32Array; b: Float32Array; bd: Float32Array; t: Float32Array; next: Float32Array; hops: Int8Array; lastA: Int32Array; lastB: Int32Array },
    adj: null as null | Int32Array[],
    stats: { frames: 0, satsDrawn: 0, pings: 0, firstFrameMs: 0, readyMs: 0 },
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
    g.shadowBlur = 26 * k
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
        g.fillText(text[i], (r.left - w.left) * k, (r.top - w.top) * k + asc)   // twice: a denser, rounder cloud
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
    s.sr?.setMask(c, fade)
    s.maskT0 = fade ? performance.now() : -1e9
    kick()
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
    // Pointer: an under-damped spring follows the mouse (a little overshoot, a slow settle) and its velocity becomes a wake, so dots flow
    // around the cursor and close up behind it. Strength eases to 0 when idle or away. Nothing runs for k == 0.
    let ptr: { x: number; y: number; k: number } | undefined
    let wake: [number, number] = [0, 0]
    if (s.fine && !s.reduced && s.r) {
      const wantK = s.pin || (s.over && now - s.lastMove < PTR_IDLE_MS) ? 1 : 0
      if (wantK > 0 && s.pk.x < 0.01) {
        s.px.x = s.tx; s.py.x = s.ty; s.px.v = s.py.v = 0
      }
      if (wantK > 0 || s.pk.x > 0.002) {
        const steps = 2
        for (let i = 0; i < steps; i++) {
          const h = dt / steps
          s.px.v += (SPRING_W * SPRING_W * (s.tx - s.px.x) - 2 * SPRING_ZETA * SPRING_W * s.px.v) * h
          s.py.v += (SPRING_W * SPRING_W * (s.ty - s.py.x) - 2 * SPRING_ZETA * SPRING_W * s.py.v) * h
          s.px.x += s.px.v * h
          s.py.x += s.py.v * h
        }
        damp(s.pk, wantK, 10, dt)
        s.pk.x = Math.max(0, Math.min(1, s.pk.x))
        const cap = 20 * s.dpr
        wake = [Math.max(-cap, Math.min(cap, s.px.v * WAKE_GAIN)), Math.max(-cap, Math.min(cap, s.py.v * WAKE_GAIN))]
        if (s.pk.x > 0.002) ptr = { x: s.px.x, y: s.py.x, k: s.pk.x }
      }
    }
    const sat = s.sat
    const nowS = Date.now() / 1000
    const satAlpha = sat ? SAT_ALPHA * (s.reduced ? 1 : Math.min(1, (now - s.satFrom) / SAT_FADE_MS)) : 0
    // Mesh pings: a few new ones per second, chosen from the precomputed neighbour table among links on the visible hemisphere.
    const base = s.size
    const tClock = s.devT ?? now / 1000
    let pings: PingSet | undefined
    if (sat && s.links && s.links.a.length && !s.reduced && gl) {
      const P = (s.pg ??= { a: new Float32Array(PING_CAP * 4), ad: new Float32Array(PING_CAP), b: new Float32Array(PING_CAP * 4), bd: new Float32Array(PING_CAP), t: new Float32Array(PING_CAP * 2), next: new Float32Array(PING_CAP), hops: new Int8Array(PING_CAP), lastA: new Int32Array(PING_CAP), lastB: new Int32Array(PING_CAP) })
      const K = Math.min(PING_CAP, pingsFor(base))
      const tNow = tClock
      const rot = rotation(lat, lon)
      const zOf = (i: number) => {
        const [x, y, z] = positionEcef(sat.data, i, sat.refEpoch, nowS)
        const r = Math.hypot(x, y, z)
        return (rot[2] * y + rot[5] * z + rot[8] * x) / r
      }
      const launch = (i: number, ia: number, ib: number, dur: number) => {
        for (let k = 0; k < 4; k++) {
          P.a[i * 4 + k] = sat.data[ia * 5 + k]
          P.b[i * 4 + k] = sat.data[ib * 5 + k]
        }
        P.ad[i] = sat.data[ia * 5 + 4]
        P.bd[i] = sat.data[ib * 5 + 4]
        P.t[i * 2] = tNow
        P.t[i * 2 + 1] = dur
        P.lastA[i] = ia
        P.lastB[i] = ib
      }
      if (s.pingDemo && s.devT !== null) {
        // Dev only (?pingdemo=1 with ?t=): one fixed ping on the clock s.devT, to look at the comet frame by frame. The link is the first
        // visible one whose ends are in the open hero (not behind the first card), and demoPos reports where they are on screen.
        const wr = wrap.current?.getBoundingClientRect()
        const Rc = (s.size / 2) * SPHERE_FRACTION
        const at = (i: number) => {
          const [x, y, z] = positionEcef(sat.data, i, sat.refEpoch, nowS)
          const rr = Math.hypot(x, y, z)
          const shellR = SHELL[0] + (SHELL[1] - SHELL[0]) * Math.max(0, Math.min(1, (rr - 1.045) / 0.05))
          const q = rotation(lat, lon)
          const wx = (q[0] * y + q[3] * z + q[6] * x) / rr
          const wy = (q[1] * y + q[4] * z + q[7] * x) / rr
          return wr ? [wr.left + wr.width / 2 + wx * shellR * Rc, wr.top + wr.height / 2 - wy * shellR * Rc] : [0, 0]
        }
        const open = (i: number) => {
          const [x, y] = at(i)
          return y > 150 && y < 520 && x > 150 && x < window.innerWidth - 150
        }
        if (s.demoLink < 0) {
          for (let li = 0; li < s.links.a.length && s.demoLink < 0; li++) if (zOf(s.links.a[li]) > 0.35 && zOf(s.links.b[li]) > 0.35 && open(s.links.a[li]) && open(s.links.b[li])) s.demoLink = li
        }
        if (s.demoLink >= 0) {
          launch(0, s.links.a[s.demoLink], s.links.b[s.demoLink], 1.2)
          P.t[0] = 0
          ;(s as unknown as { demoPos?: number[][] }).demoPos = [at(s.links.a[s.demoLink]), at(s.links.b[s.demoLink])]
        }
        pings = { count: s.demoLink >= 0 ? 1 : 0, a: P.a, ad: P.ad, b: P.b, bd: P.bd, t: P.t, now: tNow }
      }
      for (let i = 0; i < K && !(s.pingDemo && s.devT !== null); i++) {
        // a slot is free once its comet and the bloom at the receiver are done (duration x 1.3)
        if (tNow < P.t[i * 2] + P.t[i * 2 + 1] * 1.3 || tNow < P.next[i]) continue
        const dur = 0.8 + Math.random() * 0.8
        // chains: the message carries on from the receiver to one of its neighbours (2 to 4 hops in total)
        if (P.hops[i] > 0 && s.adj) {
          const nb = s.adj[P.lastB[i]]
          let to = -1
          for (let tries = 0; tries < 6 && to < 0 && nb && nb.length; tries++) {
            const c = nb[(Math.random() * nb.length) | 0]
            if (c !== P.lastA[i] && zOf(c) > 0.3) to = c
          }
          P.hops[i]--
          if (to >= 0) {
            launch(i, P.lastB[i], to, dur)
            P.next[i] = tNow + dur * 0.55
            continue
          }
        }
        let done = false
        for (let tries = 0; tries < 14 && !done; tries++) {
          const li = (Math.random() * s.links.a.length) | 0
          const flip = Math.random() < 0.5
          const ia = flip ? s.links.b[li] : s.links.a[li]
          const ib = flip ? s.links.a[li] : s.links.b[li]
          if (zOf(ia) > 0.3 && zOf(ib) > 0.3) {
            launch(i, ia, ib, dur)
            P.hops[i] = Math.random() < 0.6 ? 1 + ((Math.random() * 3) | 0) : 0
            P.next[i] = tNow + dur * 1.3 + 0.1 + Math.random() * 1.8
            done = true
          }
        }
        if (!done) P.next[i] = tNow + 0.25
      }
      if (!(s.pingDemo && s.devT !== null)) pings = { count: K, a: P.a, ad: P.ad, b: P.b, bd: P.bd, t: P.t, now: tNow }
    }
    const maskMix = s.reduced ? 1 : easeOutSoft(Math.min(1, (now - s.maskT0) / CUT_MS))
    // The globe canvas: the dot-matrix sphere, at the device pixel ratio, the size of the globe box.
    s.r?.draw(lat, lon, { globeA: s.globeA, maskMix, ptr, wake, push: { radius: PUSH_RADIUS * s.dpr, max: PUSH_MAX * s.dpr } })
    // The shell canvas: satellites, trails and pings at low resolution on a box SHELL_SCALE times larger, same centre. Pointer, rect and
    // edge are converted from globe pixels to shell pixels through CSS pixels; 
    if (s.sr) {
      const k = s.sdpr / s.dpr
      const off = (s.size * (SHELL_SCALE - 1)) / 2
      const toShell = (v: number) => (v / s.dpr + off) * s.sdpr
      const sptr = ptr ? { x: toShell(ptr.x), y: toShell(ptr.y), k: ptr.k } : undefined
      s.sr.draw(lat, lon, {
        shell: SHELL,
        trailSeconds: sat ? trailFor(base) : 0,
        pings,
        satT: sat ? nowS - sat.refEpoch : 0,
        gmst: sat ? gmst(nowS) : 0,
        satAlpha,
        satThin: thinFor(base),
        globeA: s.globeA,
        maskMix,
        ptr: sptr,
        wake: [wake[0] * k, wake[1] * k],
        push: { radius: PUSH_RADIUS * s.sdpr, max: PUSH_MAX * s.sdpr },
      })
    }
    const stt = s.stats
    stt.frames++
    stt.satsDrawn = s.sr && sat && satAlpha > 0.05 ? Math.ceil(sat.count / thinFor(base)) : 0
    stt.pings = pings ? pings.count : 0
    if (!stt.firstFrameMs) stt.firstFrameMs = Math.round(now)
    if (!stt.readyMs && stt.satsDrawn > 0 && satAlpha >= SAT_ALPHA * 0.99) stt.readyMs = Math.round(now)
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
      // Dev only: ?t=<seconds> drives the materialise sweep and the ping clock deterministically (set window.__globe.devT to step it).
      if (q.get('t') !== null && Number.isFinite(Number(q.get('t')))) st.current.devT = Number(q.get('t'))
      st.current.pingDemo = q.get('pingdemo') === '1'
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
        // The satellite shell gets its own larger canvas at low resolution (and its own context); without it the globe simply has no shell.
        const sr = shellCanvas.current ? createRenderer(shellCanvas.current, null, { ink }, 'shell') : null
        st.current.sr = sr
        st.current.sdpr = shellDprFor(st.current.size || 300, window.devicePixelRatio || 1)
        sr?.resize((st.current.size || 300) * SHELL_SCALE, st.current.sdpr)
        setMode('gl')
        void document.fonts?.ready.then(() => measureText())
        // The constellation arrives after the globe is up and fades in; without it (offline, stale elements) nothing is drawn.
        // Dev only: ?bare=1 draws the plain globe (no satellites), which is how public/globe/fallback.png is regenerated.
        const bare = process.env.NODE_ENV !== 'production' && new URLSearchParams(window.location.search).get('bare') === '1'
        if (!bare) void loadStarlink().then((p) => {
          if (!p || st.current.r !== r) return
          st.current.sr?.setSatellites(p.data)
          st.current.sat = p
          const lk = buildLinks(p.data, p.count)
          st.current.links = lk
          const lists: number[][] = Array.from({ length: p.count }, () => [])
          for (let i = 0; i < lk.a.length; i++) {
            lists[lk.a[i]].push(lk.b[i])
            lists[lk.b[i]].push(lk.a[i])
          }
          st.current.adj = lists.map((l) => Int32Array.from(l))
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
      const size = el.clientWidth
      const dpr = Math.min(size < 600 ? 3 : 1.5, window.devicePixelRatio || 1)
      // Height-only viewport changes (the iOS toolbar showing and hiding) do not change the globe box: nothing to redo, and the
      // canvas is not touched, so it cannot flash blank during scroll.
      if (size === s.size && dpr === s.dpr && s.r) return
      s.size = size
      s.dpr = dpr
      s.r?.resize(s.size, s.dpr)
      s.sdpr = shellDprFor(s.size, window.devicePixelRatio || 1)
      s.sr?.resize(s.size * SHELL_SCALE, s.sdpr)
      const ga = parseFloat(getComputedStyle(el).getPropertyValue('--hero-globe-opacity'))
      if (Number.isFinite(ga)) s.globeA = ga
      measureText()
      // A real resize clears the drawing buffer: draw again in the same task instead of waiting for the next frame.
      if (s.r && s.mode === 'gl') {
        if (s.raf) cancelAnimationFrame(s.raf)
        s.raf = 0
        draw()
      } else kick()
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
    // A read-only, non-enumerable snapshot for scripts/hero-smoke.mjs (also in production builds): what has been drawn and whether the
    // two contexts are alive.
    Object.defineProperty(window, '__hero', {
      configurable: true,
      enumerable: false,
      value: () => ({ ...s.stats, mode: s.mode, size: s.size, dpr: s.dpr, globe: s.r?.probe() ?? null, shell: s.sr?.probe() ?? null, hasShell: !!s.sr }),
    })
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
      const { r, sr } = s
      s.r = null
      s.sr = null
      // Losing a WebGL context is synchronous and costs tens of ms (180 ms at 4x CPU), which landed in the commit of the route change that
      // leaves the home page and froze the view transition. The canvases are already out of the document; release them when idle.
      const release = () => {
        r?.destroy()
        sr?.destroy()
      }
      'requestIdleCallback' in window ? requestIdleCallback(release, { timeout: 1500 }) : setTimeout(release, 600)
    },
    [],
  )

  return (
    <div ref={wrap} className={`hero-globe hero-globe--${variant} ${className}`} data-mode={mode} aria-hidden="true">
      {/* Static drawing of the same globe: server-rendered, shown under reduced motion / without WebGL2. */}
      <img className="hero-globe__still" src="/globe/fallback.png" alt="" width={400} height={400} decoding="async" />
      <canvas ref={canvas} className="hero-globe__canvas" />
      <canvas ref={shellCanvas} className="hero-globe__canvas hero-globe__shell" />
      <div ref={layer} className="hero-globe__pins">
        {dots.map((d) => (
          <i key={d.k} data-lat={d.lat} data-lon={d.lon} className={d.cls} />
        ))}
      </div>
    </div>
  )
}
