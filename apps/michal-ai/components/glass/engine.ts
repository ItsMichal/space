/*
 * Glass engine.
 *
 * A Field is one refraction/displacement field. It belongs to a host element: a GlassEffectContainer,
 * or, for a lone glass element, the element itself. Every member shape in a field is rendered into
 * the same SDF union, so shapes closer than `spacing` bleed together like metaballs and separate again
 * when they move apart.
 *
 *   per frame while something moves (springs, press, fold, light, drag):
 *     1. read member rects, step springs                                (cheap, no layout writes)
 *     2. surface pass  (WebGL2) -> drawImage into the visible canvas     tint, rim, glow, shadow, crease
 *     3. map pass      (WebGL2) -> 2D canvas -> PNG data URL -> feImage  Chromium only (svg engine)
 *        or finished frost (no lens): backdrop blur boxes + rim bevel     Safari / Firefox / iOS (frost engine)
 *   idle: nothing runs.
 */

import { Glass } from './glass'
import {
  PRESS,
  FOLLOW,
  MORPH,
  RIM_PEAK,
  clamp,
  resolveRadius,
  springSettled,
  stepSpring,
  type GlassShape,
  type Spring,
  type SpringConfig,
} from './geometry'
import {
  colorLuminance,
  invalidateColors,
  probeBackdrop,
  resolveColor,
  type RGBA,
} from './backdrop'
import { GlassGL, type DrawParams, type MapTicket } from './gl'
import { MAX_SHAPES } from './shaders'
import { lightFor } from './lighting'
import { decideTone, type Tone } from './theme'

export type GlassTransition = 'materialize' | 'matchedGeometry' | 'identity'
export type GlassAppearance = 'auto' | 'light' | 'dark'
export type GlassEngineMode = 'auto' | 'svg' | 'frost' | 'flat'

export type MemberConfig = {
  effect: Glass
  shape: GlassShape
  id?: string | null
  namespace?: GlassNamespace | null
  union?: string | null
  transition: GlassTransition
  appearance: GlassAppearance
}

type PendingMap = { base: DrawParams; win: [number, number, number, number]; key: string; S: number; blur: number; sat: number }
type MapMeta = { mx0: number; my0: number; mw: number; mh: number; S: number; blur: number; sat: number }

export type FieldOptions = {
  spacing?: number
  engine?: GlassEngineMode
  bezel?: number
  refraction?: number
  blur?: number
  saturate?: number
}

// ---------------------------------------------------------------- environment

const env = {
  ready: false,
  reduceMotion: false,
  reduceTransparency: false,
  moreContrast: false,
  themeDark: false,
  chromium: false,
  coarse: false,
  dpr: 1,
}

/** Minimum gap between displacement-map updates while animating (~30Hz). */
const MAP_INTERVAL = 32
const SVGNS = 'http://www.w3.org/2000/svg'
let envEpoch = 0

function initEnv() {
  if (env.ready || typeof window === 'undefined') return
  env.ready = true
  const q = (s: string) => window.matchMedia(s)
  const read = () => {
    env.reduceMotion = q('(prefers-reduced-motion: reduce)').matches
    env.reduceTransparency = q('(prefers-reduced-transparency: reduce)').matches
    env.moreContrast = q('(prefers-contrast: more)').matches
    env.coarse = q('(pointer: coarse)').matches
    env.dpr = window.devicePixelRatio || 1
    // Edge, Opera, Brave, Samsung Internet and Android Chrome all say "Chrome/"; iOS browsers (CriOS) do not.
    env.chromium = /Chrome\//.test(navigator.userAgent) && !/Edg\/.*Mobile.*iPhone/.test(navigator.userAgent)
  }
  read()
  const onChange = () => {
    read()
    envEpoch++
    fields.forEach((f) => f.envChanged())
  }
  for (const m of [
    '(prefers-reduced-motion: reduce)',
    '(prefers-reduced-transparency: reduce)',
    '(prefers-contrast: more)',
    '(pointer: coarse)',
  ])
    q(m).addEventListener('change', onChange)
  const onTheme = () => {
    invalidateColors()
    envEpoch++
    fields.forEach((f) => f.themeChanged())
  }
  q('(prefers-color-scheme: dark)').addEventListener('change', onTheme)
  new MutationObserver(onTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'data-color-scheme', 'data-reading'],
  })
}

// ---------------------------------------------------------------- map worker

let mapWorker: Worker | null | undefined
let workerSeq = 0
const workerPending = new Map<number, (blob: Blob | null) => void>()

/** Renders displacement maps off the main thread (OffscreenCanvas + WebGL2). Null falls back to PBO readback. */
function getMapWorker(): Worker | null {
  if (mapWorker !== undefined) return mapWorker
  try {
    if (typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined') throw new Error('no worker gl')
    const w = new Worker(new URL('./map.worker.ts', import.meta.url), { type: 'module' })
    const fail = () => {
      mapWorker = null
      w.terminate()
      workerPending.forEach((cb) => cb(null))
      workerPending.clear()
    }
    w.onmessage = (ev: MessageEvent<{ id: number; blob?: Blob; error?: string }>) => {
      const cb = workerPending.get(ev.data.id)
      workerPending.delete(ev.data.id)
      if (ev.data.error) fail()
      cb?.(ev.data.blob ?? null)
    }
    w.onerror = fail
    mapWorker = w
  } catch {
    mapWorker = null
  }
  return mapWorker
}

// ---------------------------------------------------------------- shared GL + scheduler

let gl: GlassGL | null = null
let glFailed = false

function getGL(): GlassGL | null {
  if (gl && !gl.isLost) return gl
  if (glFailed) return null
  gl = GlassGL.create()
  if (!gl) {
    glFailed = true
    return null
  }
  gl.onLost = () => {
    gl = null
    // The context may come back (webglcontextrestored); rebuild lazily on the next draw.
    fields.forEach((f) => f.invalidate())
  }
  return gl
}

const fields = new Set<Field>()
const active = new Set<Field>()
let raf = 0
let lastNow = 0

export type GlassStats = {
  frames: number
  mapGlMs: number
  mapEncodeMs: number
  mapReadMs: number
  mapLatencyMs: number
  surfaceMs: number
  updateMs: number
  maxMapMs: number
  lastMapMs: number
  mapPx: number
  surfacePx: number
  mode: string
}

const stats: GlassStats = {
  frames: 0,
  mapGlMs: 0,
  mapEncodeMs: 0,
  mapReadMs: 0,
  mapLatencyMs: 0,
  surfaceMs: 0,
  updateMs: 0,
  maxMapMs: 0,
  lastMapMs: 0,
  mapPx: 0,
  surfacePx: 0,
  mode: '',
}

export function getGlassStats(): GlassStats {
  return stats
}

export function resetGlassStats(): void {
  Object.assign(stats, { frames: 0, mapGlMs: 0, mapEncodeMs: 0, mapReadMs: 0, mapLatencyMs: 0, surfaceMs: 0, updateMs: 0, maxMapMs: 0, lastMapMs: 0 })
}

let engineOverride: GlassEngineMode | null = null

/** Force a rendering path for every field (testing, or an in-app switch). Pass null to restore auto. */
export function setGlassEngineOverride(mode: GlassEngineMode | null): void {
  engineOverride = mode
  fields.forEach((f) => f.envChanged())
}

function schedule() {
  if (!raf && typeof window !== 'undefined') raf = requestAnimationFrame(tick)
}

function tick(now: number) {
  raf = 0
  const dt = lastNow ? Math.min((now - lastNow) / 1000, 0.05) : 1 / 60
  lastNow = now
  const t0 = performance.now()
  for (const f of Array.from(active)) {
    if (!f.update(now, dt)) active.delete(f)
  }
  stats.updateMs += performance.now() - t0
  if (active.size) schedule()
  else lastNow = 0
}

// ---------------------------------------------------------------- shape state

export class GlassNamespace {
  /** @internal ghosts waiting for a same-id partner to adopt their geometry */
  readonly ghosts = new Map<string, ShapeState>()
  readonly name: string
  constructor(name = 'glass') {
    this.name = name
  }
}

const sp = (x = 0): Spring => ({ x, v: 0 })

class ShapeState {
  cx = sp()
  cy = sp()
  hx = sp()
  hy = sp()
  r = sp()
  mat = sp(0)
  press = sp(0)
  fold = sp(0)
  scale = sp(1)
  // targets
  tcx = 0
  tcy = 0
  thx = 0
  thy = 0
  tr = 0
  tmat = 1
  tpress = 0
  tfold = 0
  tscale = 1
  creaseY = 0
  touchX = 0
  touchY = 0
  dark = 0
  darkTarget = 0
  darkBool = false
  toneSet = false
  group = -1
  tint: RGBA = [0, 0, 0, 0]
  clear = 0
  soft = false
  cfg!: MemberConfig
  initialised = false
  // viewport position of the host when this state was last updated (for cross-field adoption)
  hostX = 0
  hostY = 0
  frost: HTMLElement | null = null
  ghostAt = 0

  /** Steps all springs. Returns true while anything is still moving. */
  step(dt: number, reduce: boolean): boolean {
    if (reduce) {
      this.snap()
      return false
    }
    const cfg: SpringConfig = this.soft || this.cfg?.id ? MORPH : FOLLOW
    let moving = false
    const go = (s: Spring, t: number, c: SpringConfig, eps = 0.02) => {
      if (springSettled(s, t, eps)) {
        s.x = t
        s.v = 0
      } else {
        stepSpring(s, t, c, dt)
        moving = true
      }
    }
    if (this.tpress > 0.5) {
      // direct manipulation: while a finger/cursor holds the glass it tracks 1:1 from the first frame
      this.cx.x = this.tcx
      this.cy.x = this.tcy
      this.cx.v = this.cy.v = 0
    } else {
      go(this.cx, this.tcx, cfg)
      go(this.cy, this.tcy, cfg)
    }
    go(this.hx, this.thx, cfg)
    go(this.hy, this.thy, cfg)
    go(this.r, this.tr, cfg)
    go(this.mat, this.tmat, MORPH, 0.004)
    go(this.press, this.tpress, MORPH, 0.004)
    go(this.fold, this.tfold, MORPH, 0.004)
    go(this.scale, this.tscale, PRESS, 0.0008)
    if (this.soft && !moving) this.soft = false
    // tone cross-fades in about 200ms (tint here, glyph colour via the CSS transition on the same attribute)
    if (Math.abs(this.dark - this.darkTarget) > 0.002) {
      this.dark += (this.darkTarget - this.dark) * (1 - Math.exp(-dt / 0.07))
      moving = true
    } else this.dark = this.darkTarget
    return moving
  }

  snap() {
    this.cx.x = this.tcx
    this.cy.x = this.tcy
    this.hx.x = this.thx
    this.hy.x = this.thy
    this.r.x = this.tr
    this.mat.x = this.tmat
    this.press.x = this.tpress
    this.fold.x = this.tfold
    this.scale.x = 1
    for (const s of [this.cx, this.cy, this.hx, this.hy, this.r, this.mat, this.press, this.fold, this.scale]) s.v = 0
    this.dark = this.darkTarget
  }
}

class Member extends ShapeState {
  readonly el: HTMLElement
  field: Field
  concR = 0
  lastW = -1
  lastH = -1
  private cleanups: Array<() => void> = []
  constructor(el: HTMLElement, field: Field, cfg: MemberConfig) {
    super()
    this.el = el
    this.field = field
    this.cfg = cfg
  }

  bindInteraction() {
    this.unbindInteraction()
    if (!this.cfg.effect.isInteractive) return
    const el = this.el
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const hr = this.field.host.getBoundingClientRect()
      this.touchX = e.clientX - hr.left
      this.touchY = e.clientY - hr.top
      this.tpress = 1
      this.tscale = env.reduceMotion ? 1 : 0.975
      this.field.wake()
    }
    const move = (e: PointerEvent) => {
      if (this.tpress < 1) return
      const hr = this.field.host.getBoundingClientRect()
      this.touchX = e.clientX - hr.left
      this.touchY = e.clientY - hr.top
      this.field.wake()
    }
    const up = () => {
      if (this.tpress === 0) return
      this.tpress = 0
      this.tscale = 1
      this.field.wake()
    }
    el.addEventListener('pointerdown', down, { passive: true })
    el.addEventListener('pointermove', move, { passive: true })
    el.addEventListener('pointerup', up, { passive: true })
    el.addEventListener('pointercancel', up, { passive: true })
    el.addEventListener('pointerleave', up, { passive: true })
    this.cleanups.push(() => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('pointerleave', up)
      el.style.removeProperty('scale')
    })
  }

  unbindInteraction() {
    this.cleanups.forEach((c) => c())
    this.cleanups = []
  }

  /** Read the DOM box and set spring targets. */
  measure(hr: DOMRect) {
    const r = this.el.getBoundingClientRect()
    const w = r.width
    const h = r.height
    this.hostX = hr.left
    this.hostY = hr.top
    const present = w >= 2 && h >= 2 && this.cfg.effect.variant !== 'identity'
    if (present) {
      this.tcx = r.left - hr.left + w / 2
      this.tcy = r.top - hr.top + h / 2
      this.thx = w / 2
      this.thy = h / 2
      if (w !== this.lastW || h !== this.lastH || !this.initialised) {
        this.lastW = w
        this.lastH = h
        if (this.cfg.shape === 'containerConcentric') this.concR = concentricRadius(this.el, r)
        else if (this.cfg.shape === 'inherit') this.concR = parseFloat(getComputedStyle(this.el).borderTopLeftRadius) || 0
      }
      this.tr = resolveRadius(this.cfg.shape, w, h, this.concR)
    }
    this.tmat = present ? 1 : 0
    this.clear = this.cfg.effect.variant === 'clear' ? 1 : 0
    if (!this.initialised) {
      this.initialised = true
      const fresh = this.field.settled // field finished its first paint: new members materialise
      this.cx.x = this.tcx
      this.cy.x = this.tcy
      this.hx.x = this.thx
      this.hy.x = this.thy
      this.r.x = this.tr
      this.mat.x = present && (!fresh || this.cfg.transition === 'identity') ? 1 : 0
    }
  }

  detachDom() {
    this.unbindInteraction()
    this.el.removeAttribute('data-glass-live')
    this.el.removeAttribute('data-glass-tone')
    this.el.style.removeProperty('scale')
  }
}

function concentricRadius(el: HTMLElement, r: DOMRect): number {
  let p = el.parentElement
  while (p) {
    const cs = getComputedStyle(p)
    const pr = parseFloat(cs.borderTopLeftRadius)
    if (pr > 0) {
      const pb = p.getBoundingClientRect()
      const inset = Math.max(0, Math.min(r.left - pb.left, r.top - pb.top, pb.right - r.right, pb.bottom - r.bottom))
      return Math.max(0, pr - inset)
    }
    p = p.parentElement
  }
  return 0
}

// ---------------------------------------------------------------- Field

const PAD_SURFACE = 34
const HOST_FIELD = new WeakMap<HTMLElement, Field>()
const MEMBER_OF = new WeakMap<Element, Member>()
let uid = 0

function cssNumber(el: Element, name: string, fallback: number): number {
  const v = parseFloat(getComputedStyle(el).getPropertyValue(name))
  return Number.isFinite(v) ? v : fallback
}

export class Field {
  readonly host: HTMLElement
  readonly standalone: boolean
  readonly members = new Map<HTMLElement, Member>()
  private ghosts: ShapeState[] = []
  private opts: FieldOptions = {}
  private unions = new Map<string, number>()
  mode: Exclude<GlassEngineMode, 'auto'> = 'flat'
  private requested: GlassEngineMode = 'auto'
  private layer: HTMLDivElement | null = null
  private surface: HTMLCanvasElement | null = null
  private sctx: CanvasRenderingContext2D | null = null
  private fx: HTMLDivElement | null = null
  private svg: SVGSVGElement | null = null
  private filterId = `glass-f-${++uid}`
  private feImage: SVGFEImageElement | null = null
  private filterEl: SVGFilterElement | null = null
  private feBlur: SVGFEGaussianBlurElement | null = null
  private feDisp: SVGFEDisplacementMapElement[] = []
  private feSat: SVGFEColorMatrixElement | null = null
  private mapCanvas: HTMLCanvasElement | null = null
  private mctx: CanvasRenderingContext2D | null = null
  private mapCache = new Map<string, string>()
  private tickets: MapTicket[] = []
  private pendingMap: PendingMap | null = null
  private lastMapAt = 0
  private inflight = 0
  private mapApplied = 0
  private readBuf: Uint8ClampedArray<ArrayBuffer> | null = null
  private mapIssueMs = 0
  private mapCap = env.coarse ? 8000 : 16000
  private visible = true
  private io: IntersectionObserver | null = null
  private ro: ResizeObserver | null = null
  private mo: MutationObserver | null = null
  private hover: { x: number; y: number } | null = null
  private hoverPt = { x: 0, y: 0 }
  private hoverT = 0
  private onPointerEnter = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    this.hover = this.hoverPt = { x: e.clientX, y: e.clientY }
    this.invalidate()
  }
  private onPointerLeave = () => {
    this.hover = null
    this.invalidate()
  }
  private onFocusIn = () => {
    const r = this.host.getBoundingClientRect()
    this.hover = this.hoverPt = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    this.invalidate()
  }
  private onFocusOut = () => {
    this.hover = null
    this.invalidate()
  }
  private lastSig = ''
  private dirty = true
  private pollUntil = 0
  private lastProbe = 0
  private created = performance.now()
  private disposed = false
  private cssEpoch = -1
  private css = {
    tintLight: [0.98, 0.976, 0.953, 0.44] as RGBA,
    tintDark: [0.106, 0.125, 0.106, 0.48] as RGBA,
    rim: [1, 1, 1, 0.95] as RGBA,
    edge: [0, 0, 0, 0.05] as RGBA,
    rimDark: [1, 1, 1, 0.28] as RGBA,
    edgeDark: [0, 0, 0, 0.55] as RGBA,
    fgLight: [0.094, 0.129, 0.106, 1] as RGBA,
    fgDark: [0.922, 0.906, 0.855, 1] as RGBA,
    blur: 10,
    sat: 1.6,
    backdrop: '',
    refraction: 36,
    pageLum: 0.9,
    themeDark: 0,
  }
  private transitionEvt = () => {
    this.pollUntil = performance.now() + 700
    this.wake()
  }

  constructor(host: HTMLElement, standalone: boolean) {
    this.host = host
    this.standalone = standalone
    initEnv()
    fields.add(this)
    HOST_FIELD.set(host, this)
    this.setup()
  }

  /** True once the first paint window has passed; later members materialise instead of popping in. */
  get settled(): boolean {
    return performance.now() - this.created > 220
  }

  configure(opts: FieldOptions) {
    const prev = JSON.stringify(this.opts)
    this.opts = { ...opts }
    const eng = opts.engine ?? 'auto'
    if (JSON.stringify(this.opts) !== prev || eng !== this.requested) {
      this.requested = eng
      this.resolveMode()
      this.invalidate(true)
    }
  }

  // ------------------------------------------------------------ setup / teardown

  private setup() {
    const host = this.host
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
    const layer = document.createElement('div')
    layer.className = 'glass-field'
    layer.setAttribute('aria-hidden', 'true')
    this.layer = layer
    host.insertBefore(layer, host.firstChild)

    this.io = new IntersectionObserver(
      (entries) => {
        this.visible = entries.some((e) => e.isIntersecting)
        if (this.visible) this.invalidate()
      },
      { rootMargin: '120px' },
    )
    this.io.observe(host)
    this.ro = new ResizeObserver(() => this.invalidate())
    this.ro.observe(host)
    // React (or a text update) can wipe foreign children; put the layer back.
    this.mo = new MutationObserver(() => {
      if (this.layer && this.layer.parentNode !== host) host.insertBefore(this.layer, host.firstChild)
    })
    this.mo.observe(host, { childList: true })
    for (const t of ['transitionrun', 'transitionstart', 'transitionend', 'transitioncancel', 'animationstart', 'animationend', 'animationcancel'])
      host.addEventListener(t, this.transitionEvt)
    // The glass reacts to the pointer only while it is over THIS element (or focused): listeners live on the host, none on window.
    host.addEventListener('pointerenter', this.onPointerEnter, { passive: true })
    host.addEventListener('pointermove', this.onPointerEnter, { passive: true })
    host.addEventListener('pointerleave', this.onPointerLeave, { passive: true })
    host.addEventListener('focusin', this.onFocusIn)
    host.addEventListener('focusout', this.onFocusOut)
    this.resolveMode()
  }

  private resolveMode() {
    const want = engineOverride ?? this.requested
    let mode: Field['mode']
    if (env.reduceTransparency || env.moreContrast || want === 'flat') mode = 'flat'
    else if (want === 'svg' || (want === 'auto' && env.chromium)) mode = 'svg'
    else mode = 'frost'
    if (mode !== 'flat' && !getGL()) mode = 'flat'
    this.setMode(mode)
  }

  private setMode(mode: Field['mode']) {
    if (mode === this.mode && this.layer?.childElementCount) {
      this.applyLive()
      return
    }
    this.mode = mode
    stats.mode = mode
    const layer = this.layer!
    this.teardownLayerContents()
    this.host.setAttribute('data-glass-engine', mode)
    if (mode === 'flat') {
      this.applyLive()
      return
    }
    // surface canvas
    const surface = document.createElement('canvas')
    surface.className = 'glass-surface'
    this.surface = surface
    this.sctx = surface.getContext('2d')
    if (mode === 'svg') {
      const fx = document.createElement('div')
      fx.className = 'glass-fx'
      this.fx = fx
      layer.appendChild(fx)
      this.buildFilter(layer)
      this.mapCanvas = document.createElement('canvas')
      this.mctx = this.mapCanvas.getContext('2d', { willReadFrequently: true })
    } else {
    }
    layer.appendChild(surface)
    this.applyLive()
  }

  private teardownLayerContents() {
    const layer = this.layer
    if (!layer) return
    layer.replaceChildren()
    this.surface = this.sctx = this.fx = this.svg = this.feImage = this.mapCanvas = this.mctx = null
    this.filterEl = null
    this.feDisp = []
    this.members.forEach((m) => (m.frost = null))
    this.ghosts.forEach((g) => (g.frost = null))
    this.mapCache.clear()
    this.lastSig = ''
  }

  private applyLive() {
    const on = this.mode !== 'flat'
    this.members.forEach((m) => {
      if (on) m.el.setAttribute('data-glass-live', this.mode)
      else m.el.removeAttribute('data-glass-live')
    })
    if (this.standalone) {
      if (on) this.host.setAttribute('data-glass-live', this.mode)
      else this.host.removeAttribute('data-glass-live')
    }
  }

  private buildFilter(layer: HTMLElement) {
    const svg = document.createElementNS(SVGNS, 'svg')
    svg.setAttribute('width', '0')
    svg.setAttribute('height', '0')
    svg.setAttribute('aria-hidden', 'true')
    svg.style.cssText = 'position:absolute;pointer-events:none'
    const mk = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>) => {
      const e = document.createElementNS(SVGNS, tag)
      for (const k in attrs) e.setAttribute(k, attrs[k])
      return e
    }
    const f = mk('filter', {
      id: this.filterId,
      x: '0',
      y: '0',
      width: '100',
      height: '100',
      filterUnits: 'userSpaceOnUse',
      'color-interpolation-filters': 'sRGB',
    })
    this.filterEl = f
    this.feBlur = mk('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '3', result: 'soft' })
    f.appendChild(this.feBlur)
    this.feImage = mk('feImage', { x: '0', y: '0', width: '100', height: '100', result: 'map', preserveAspectRatio: 'none' })
    f.appendChild(this.feImage)
    const chan = (ch: 'r' | 'g' | 'b') => {
      const d = mk('feDisplacementMap', {
        in: 'soft',
        in2: 'map',
        scale: '30',
        xChannelSelector: 'R',
        yChannelSelector: 'G',
        result: `d${ch}`,
      })
      this.feDisp.push(d)
      f.appendChild(d)
      const rows: Record<string, string> = {
        r: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
        g: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
        b: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
      }
      f.appendChild(mk('feColorMatrix', { in: `d${ch}`, type: 'matrix', values: rows[ch], result: ch }))
    }
    chan('r')
    chan('g')
    chan('b')
    f.appendChild(mk('feBlend', { in: 'r', in2: 'g', mode: 'screen', result: 'rg' }))
    f.appendChild(mk('feBlend', { in: 'rg', in2: 'b', mode: 'screen', result: 'rgb' }))
    this.feSat = mk('feColorMatrix', { in: 'rgb', type: 'saturate', values: '1.6', result: 'col' })
    f.appendChild(this.feSat)
    // coverage lives in the blue channel of the map
    f.appendChild(mk('feColorMatrix', { in: 'map', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0', result: 'cov' }))
    f.appendChild(mk('feComposite', { in: 'col', in2: 'cov', operator: 'in' }))
    svg.appendChild(f)
    layer.appendChild(svg)
    this.svg = svg
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    fields.delete(this)
    active.delete(this)
    this.io?.disconnect()
    this.ro?.disconnect()
    this.mo?.disconnect()
    this.host.removeEventListener('pointerenter', this.onPointerEnter)
    this.host.removeEventListener('pointermove', this.onPointerEnter)
    this.host.removeEventListener('pointerleave', this.onPointerLeave)
    this.host.removeEventListener('focusin', this.onFocusIn)
    this.host.removeEventListener('focusout', this.onFocusOut)
    for (const t of ['transitionrun', 'transitionstart', 'transitionend', 'transitioncancel', 'animationstart', 'animationend', 'animationcancel'])
      this.host.removeEventListener(t, this.transitionEvt)
    this.members.forEach((m) => m.detachDom())
    this.members.clear()
    this.layer?.remove()
    this.host.removeAttribute('data-glass-engine')
    this.host.removeAttribute('data-glass-live')
    if (HOST_FIELD.get(this.host) === this) HOST_FIELD.delete(this.host)
  }

  // ------------------------------------------------------------ membership

  addMember(el: HTMLElement, cfg: MemberConfig): Member {
    const m = new Member(el, this, cfg)
    MEMBER_OF.set(el, m)
    this.members.set(el, m)
    this.adopt(m)
    m.bindInteraction()
    this.ro?.observe(el)
    if (this.mode !== 'flat') el.setAttribute('data-glass-live', this.mode)
    this.invalidate(true)
    return m
  }

  updateMember(el: HTMLElement, cfg: MemberConfig) {
    const m = this.members.get(el)
    if (!m) return
    const interactiveChanged = m.cfg.effect.isInteractive !== cfg.effect.isInteractive
    m.cfg = cfg
    if (interactiveChanged) m.bindInteraction()
    this.lastSig = ''
    this.invalidate(true)
  }

  removeMember(el: HTMLElement) {
    const m = this.members.get(el)
    if (!m) return
    this.members.delete(el)
    this.ro?.unobserve(el)
    MEMBER_OF.delete(el)
    m.detachDom()
    const cfg = m.cfg
    if (!this.disposed && cfg.transition !== 'identity' && m.mat.x > 0.05 && cfg.effect.variant !== 'identity') {
      // The glass lingers as a ghost: it dematerialises, or hands its geometry to a same-id newcomer.
      m.tmat = 0
      m.tpress = 0
      m.tscale = 1
      m.ghostAt = performance.now()
      this.ghosts.push(m)
      if (cfg.id && cfg.namespace && cfg.transition === 'matchedGeometry') cfg.namespace.ghosts.set(cfg.id, m)
    }
    this.invalidate(true)
  }

  private adopt(m: Member) {
    const { id, namespace, transition } = m.cfg
    if (!id || !namespace || transition !== 'matchedGeometry') return
    const g = namespace.ghosts.get(id)
    if (!g || performance.now() - g.ghostAt > 400) return
    namespace.ghosts.delete(id)
    // Start from the ghost's last geometry (converted between hosts), then spring to the new rect.
    const hr = this.host.getBoundingClientRect()
    const dx = g.hostX - hr.left
    const dy = g.hostY - hr.top
    m.initialised = true
    m.cx = { x: g.cx.x + dx, v: g.cx.v }
    m.cy = { x: g.cy.x + dy, v: g.cy.v }
    m.hx = { ...g.hx }
    m.hy = { ...g.hy }
    m.r = { ...g.r }
    m.mat = { ...g.mat } // keeps value and velocity: reversing a morph halfway continues smoothly
    m.soft = true
    for (const f of fields) f.dropGhost(g)
  }

  dropGhost(g: ShapeState) {
    const i = this.ghosts.indexOf(g)
    if (i >= 0) {
      this.ghosts.splice(i, 1)
      g.frost?.remove()
      g.frost = null
    }
  }

  /** Fold impulse: crease line at `y` (px, host space) that eases out. */
  pulseFold(el: HTMLElement, y: number, amount = 1) {
    const m = this.members.get(el)
    if (!m) return
    m.creaseY = y
    m.fold.x = amount
    m.tfold = 0
    this.wake()
  }

  // ------------------------------------------------------------ invalidation

  invalidate(force = false) {
    if (this.disposed) return
    this.dirty = true
    if (force) this.lastSig = ''
    active.add(this)
    schedule()
  }

  wake() {
    this.invalidate()
  }

  envChanged() {
    this.resolveMode()
    this.cssEpoch = -1
    this.invalidate(true)
  }

  themeChanged() {
    this.cssEpoch = -1
    this.lastProbe = 0 // re-decide every tone now, not at the next 240ms probe
    this.invalidate(true)
  }

  // ------------------------------------------------------------ per-frame

  private readCss() {
    if (this.cssEpoch === envEpoch) return
    this.cssEpoch = envEpoch
    const h = this.host
    const c = this.css
    const paper = resolveColor(h, 'var(--paper)', [0.96, 0.95, 0.91, 1])
    c.pageLum = colorLuminance(paper)
    c.themeDark = c.pageLum < 0.25 ? 1 : 0
    c.tintLight = resolveColor(h, 'var(--glass-tint-light, rgba(251,249,243,.64))', c.tintLight)
    c.tintDark = resolveColor(h, 'var(--glass-tint-dark, rgba(18,22,18,.8))', c.tintDark)
    c.rim = resolveColor(h, 'var(--glass-rim-light, rgba(255,255,255,.95))', c.rim)
    c.edge = resolveColor(h, 'var(--glass-edge-light, rgba(24,33,27,.1))', c.edge)
    c.rimDark = resolveColor(h, 'var(--glass-rim-dark, rgba(255,255,255,.28))', c.rimDark)
    c.edgeDark = resolveColor(h, 'var(--glass-edge-dark, rgba(0,0,0,.55))', c.edgeDark)
    // frost blur and saturation follow the page theme (dark pages get Apple's heavier dark material)
    const blurLight = cssNumber(h, '--glass-blur', 10)
    const satLight = cssNumber(h, '--glass-saturate', 1.6)
    c.blur = this.opts.blur ?? (c.themeDark ? cssNumber(h, '--glass-blur-dark', blurLight) : blurLight)
    c.sat = this.opts.saturate ?? (c.themeDark ? cssNumber(h, '--glass-saturate-dark', satLight) : satLight)
    c.refraction = this.opts.refraction ?? cssNumber(h, '--glass-refraction', 36)
    // optional extra backdrop-filter functions for the frost path, e.g. "brightness(1.1) contrast(.8)": a luminance clamp
    // that lets a low tint stay legible over very dark or very bright content. Empty (the default) adds nothing.
    c.backdrop = getComputedStyle(h).getPropertyValue('--glass-backdrop').trim()
  }

  /** Returns true to keep the field in the active set. */
  update(now: number, dt: number): boolean {
    if (this.disposed || !this.host.isConnected) return false
    if (this.mode === 'flat') return false
    if (!this.visible) {
      this.dirty = false
      return false
    }
    const gl = getGL()
    if (!gl) {
      this.setMode('flat')
      return false
    }
    this.readCss()
    let pendingMaps = false
    if (this.mode === 'svg') {
      pendingMaps = this.pumpMaps(gl)
      if (this.pendingMap) {
        this.flushMap(gl, now)
        pendingMaps = pendingMaps || this.pendingMap !== null
      }
    }
    const hr = this.host.getBoundingClientRect()
    const reduce = env.reduceMotion
    let moving = false
    const list: ShapeState[] = []

    // union groups: stable index per union id in this field
    this.unions.clear()
    const groupOf = (m: ShapeState) => {
      const u = m.cfg.union
      if (!u) return -1
      const key = `${m.cfg.namespace?.name ?? ''}|${u}`
      let g = this.unions.get(key)
      if (g === undefined) {
        g = this.unions.size
        this.unions.set(key, g)
      }
      return g
    }

    const probe = now - this.lastProbe > 240
    if (probe) this.lastProbe = now

    for (const m of this.members.values()) {
      if (m.cfg.effect.variant === 'identity') continue
      m.measure(hr)
      m.group = groupOf(m)
      if (probe) this.probeTone(m, hr)
      moving = m.step(dt, reduce) || moving
      // press scale is applied to the element itself so its content bounces with the glass
      if (m.cfg.effect.isInteractive && !reduce) {
        const s = m.scale.x
        if (Math.abs(s - 1) > 0.0005) m.el.style.setProperty('scale', s.toFixed(4))
        else m.el.style.removeProperty('scale')
      }
      if (m.cfg.effect.tintColor) {
        const tc = resolveColor(this.host, m.cfg.effect.tintColor)
        // an opaque tint reads as a translucent wash of that colour; explicit alpha is honoured as given
        m.tint = [tc[0], tc[1], tc[2], tc[3] >= 0.999 ? 0.42 : tc[3]]
      } else m.tint = [0, 0, 0, 0]
      m.el.setAttribute('data-glass-tone', m.dark > 0.5 ? 'dark' : 'light')
      if (m.mat.x > 0.004 || m.tmat > 0) list.push(m)
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i]
      g.group = groupOf(g)
      moving = g.step(dt, reduce) || moving
      if (g.mat.x < 0.01 && g.tmat === 0) {
        this.ghosts.splice(i, 1)
        g.frost?.remove()
        if (g.cfg.id && g.cfg.namespace?.ghosts.get(g.cfg.id) === g) g.cfg.namespace.ghosts.delete(g.cfg.id)
        continue
      }
      list.push(g)
    }

    const shapes = list.length > MAX_SHAPES ? list.slice(0, MAX_SHAPES) : list
    // Ease the local light in and out (about 250ms); once settled at rest nothing here keeps the loop alive.
    const want = this.hover ? 1 : 0
    this.hoverT += (want - this.hoverT) * Math.min(1, dt * 9)
    if (Math.abs(want - this.hoverT) < 0.01) this.hoverT = want
    if (this.hoverT !== want) moving = true
    const light = lightFor(hr.left + hr.width / 2, hr.top + hr.height / 2, this.hoverT > 0 ? { x: this.hoverPt.x, y: this.hoverPt.y, w: this.hoverT } : null)
    const sig = this.signature(shapes, hr, light)
    if (sig !== this.lastSig) {
      this.lastSig = sig
      this.render(gl, shapes, hr, light)
    }
    this.dirty = false
    if (moving || pendingMaps || this.tickets.length > 0 || this.inflight > 0) return true
    if (now < this.pollUntil) return true
    return false
  }

  private probeTone(m: Member, hr: DOMRect) {
    const eff = m.cfg.effect
    let tone: Tone
    if (eff.variant === 'clear') tone = 'light'
    else {
      const adaptiveText = m.el.hasAttribute('data-glass-adaptive-text')
      const wantsBackdrop = m.cfg.appearance === 'auto' && adaptiveText
      tone = decideTone({
        appearance: m.cfg.appearance,
        adaptiveText,
        pageTheme: this.css.themeDark ? 'dark' : 'light',
        backdropLum: wantsBackdrop ? probeBackdrop(hr.left + m.cx.x, hr.top + m.cy.x, this.host) : null,
        prev: m.darkBool ? 'dark' : 'light',
      })
    }
    const target = tone === 'dark'
    m.darkBool = target
    m.darkTarget = target ? 1 : 0
    if (!m.toneSet) {
      m.toneSet = true
      m.dark = m.darkTarget // first decision: no fade-in from the wrong tone
    }
  }

  private signature(shapes: ShapeState[], hr: DOMRect, light: { x: number; y: number; k: number }): string {
    let s = `${this.mode}|${envEpoch}|${(light.x * 60) | 0},${(light.y * 60) | 0}|`
    for (const m of shapes) {
      s +=
        `${Math.round(m.cx.x * 8)},${Math.round(m.cy.x * 8)},${Math.round(m.hx.x * 8)},${Math.round(m.hy.x * 8)},${Math.round(m.r.x * 4)},` +
        `${Math.round(m.mat.x * 200)},${Math.round(m.press.x * 100)},${Math.round(m.fold.x * 100)},${Math.round(m.dark * 40)},${m.group};` +
        (m.press.x > 0.002 ? `${Math.round(m.touchX)},${Math.round(m.touchY)};` : '')
    }
    return s
  }

  // ------------------------------------------------------------ rendering

  private render(gl: GlassGL, shapes: ShapeState[], hr: DOMRect, light: { x: number; y: number; k: number }) {
    const layer = this.layer
    if (!layer || !this.surface || !this.sctx) return
    if (!shapes.length) {
      this.surface.style.display = 'none'
      if (this.fx) this.fx.style.display = 'none'
      return
    }
    this.surface.style.display = ''
    const n = shapes.length
    const rect = new Float32Array(MAX_SHAPES * 4)
    const par = new Float32Array(MAX_SHAPES * 4)
    const tint = new Float32Array(MAX_SHAPES * 4)
    const misc = new Float32Array(MAX_SHAPES * 4)
    const fold = new Float32Array(MAX_SHAPES * 4)
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    const radii: number[] = []
    let gap = 0
    for (let i = 0; i < n; i++) {
      const m = shapes[i]
      rect.set([m.cx.x, m.cy.x, Math.max(m.hx.x, 1), Math.max(m.hy.x, 1)], i * 4)
      par.set([Math.max(m.r.x, 0), clamp(m.mat.x, 0, 1), m.group, m.dark], i * 4)
      tint.set(m.tint, i * 4)
      misc.set([m.clear, clamp(m.press.x, 0, 1), m.touchX, m.touchY], i * 4)
      fold.set([m.creaseY, clamp(m.fold.x, 0, 1), 0, 0], i * 4)
      minX = Math.min(minX, m.cx.x - m.hx.x)
      maxX = Math.max(maxX, m.cx.x + m.hx.x)
      minY = Math.min(minY, m.cy.x - m.hy.x)
      maxY = Math.max(maxY, m.cy.x + m.hy.x)
      radii.push(Math.min(m.r.x, 24))
      gap = Math.max(gap, 0)
    }
    radii.sort((a, b) => a - b)
    const bezel = this.opts.bezel ?? clamp(radii[radii.length >> 1] || 16, 8, 24)
    const k = this.opts.spacing ?? 24
    // glassEffectUnion fuses shapes completely: wide enough to bridge the widest gap between members
    const unionK = Math.max(k, 36)
    const c = this.css
    const dark = c.themeDark

    const base: DrawParams = {
      pass: 1,
      n,
      rect,
      par,
      tint,
      misc,
      fold,
      k,
      unionK,
      win: [0, 0, 1, 1],
      px: 1,
      bezel,
      light: [light.x, light.y],
      lightK: light.k * (1 + 0.5 * Math.max(...shapes.map((s) => s.press.x), 0)),
      tintLight: c.tintLight,
      tintDark: c.tintDark,
      rim: c.rim,
      edge: c.edge,
      rimDark: c.rimDark,
      edgeDark: c.edgeDark,
      shadow: [10, 40, dark ? 0.32 : 0.075],
      shadowCol: dark ? [0, 0, 0] : [0.094, 0.129, 0.106],
      glow: dark ? [1, 1, 1, 0.3] : [1, 1, 1, 0.55],
      themeDark: dark,
      frost: this.mode === 'frost',
    }

    // ---- surface pass
    const t0 = performance.now()
    const q = 8
    const wx0 = Math.floor((minX - PAD_SURFACE) / q) * q
    const wy0 = Math.floor((minY - PAD_SURFACE) / q) * q
    const wx1 = Math.ceil((maxX + PAD_SURFACE) / q) * q
    const wy1 = Math.ceil((maxY + PAD_SURFACE) / q) * q
    const ww = wx1 - wx0
    const wh = wy1 - wy0
    let dpr = Math.min(env.dpr, 2)
    const maxPx = env.coarse ? 1.1e6 : 2.2e6
    while (ww * wh * dpr * dpr > maxPx && dpr > 0.6) dpr *= 0.85
    const wpx = Math.max(1, Math.round(ww * dpr))
    const hpx = Math.max(1, Math.round(wh * dpr))
    const surf = this.surface
    if (surf.width !== wpx || surf.height !== hpx) {
      surf.width = wpx
      surf.height = hpx
    }
    surf.style.left = `${wx0}px`
    surf.style.top = `${wy0}px`
    surf.style.width = `${ww}px`
    surf.style.height = `${wh}px`
    base.win = [wx0, wy0, ww, wh]
    base.px = wpx / ww
    const sy = gl.draw(base, wpx, hpx)
    const sctx = this.sctx!
    sctx.globalCompositeOperation = 'copy'
    sctx.drawImage(gl.canvas, 0, sy, wpx, hpx, 0, 0, wpx, hpx)
    stats.surfaceMs += performance.now() - t0
    stats.surfacePx = wpx * hpx

    // ---- frost boxes (frost mode): backdrop blur per member, under the canvas
    if (this.mode === 'frost') this.updateFrost(shapes, c.blur, c.sat, c.backdrop)

    // ---- displacement map (svg mode): rendered at most every MAP_INTERVAL ms, read back asynchronously
    if (this.mode === 'svg' && this.fx && this.feImage && this.mapCanvas && this.mctx && this.filterEl) {
      const pad = bezel + k * 0.25 + 3
      const mx0 = Math.floor(minX - pad)
      const my0 = Math.floor(minY - pad)
      const mw = Math.ceil(maxX + pad) - mx0
      const mh = Math.ceil(maxY + pad) - my0
      const clearAll = this.dominantClear(shapes)
      const key =
        `${mx0},${my0},${mw},${mh},${bezel},${k}|` +
        shapes.map((s) => `${Math.round(s.cx.x * 4)},${Math.round(s.cy.x * 4)},${Math.round(s.hx.x * 4)},${Math.round(s.hy.x * 4)},${Math.round(s.r.x * 2)},${Math.round(s.mat.x * 100)},${s.group}`).join(';')
      this.pendingMap = {
        base,
        win: [mx0, my0, mw, mh],
        key,
        S: c.refraction * Math.min(1, bezel / 24),
        blur: clearAll ? c.blur / 8 : c.blur / 3,
        sat: clearAll ? 1.2 : c.sat,
      }
      this.flushMap(gl, performance.now())
    }
  }

  /** Issues the pending map if the interval allows; cached maps apply immediately. */
  private flushMap(gl: GlassGL, now: number) {
    const pm = this.pendingMap
    if (!pm || !this.mctx || !this.mapCanvas) return
    const [mx0, my0, mw, mh] = pm.win
    const meta: MapMeta = { mx0, my0, mw, mh, S: pm.S, blur: pm.blur, sat: pm.sat }
    const cached = this.mapCache.get(pm.key)
    if (cached) {
      this.applyMap(meta, cached)
      this.pendingMap = null
      return
    }
    if (this.tickets.length >= 3 || this.inflight >= 2 || now - this.lastMapAt < MAP_INTERVAL) return
    // Tiny map: the lens profile is low frequency and feImage upsamples bilinearly. The cost is the
    // GPU->CPU readback latency, not the pixel count, so the size is fixed.
    const sc = Math.min(1, Math.sqrt(this.mapCap / (mw * mh)))
    const pw = Math.max(2, Math.round(mw * sc))
    const ph = Math.max(2, Math.round(mh * sc))
    const t1 = performance.now()
    const mp: DrawParams = { ...pm.base, pass: 0, win: pm.win, px: pw / mw, frost: false }
    const worker = getMapWorker()
    if (worker) {
      const id = ++workerSeq
      this.inflight++
      workerPending.set(id, (blob) => {
        this.inflight--
        if (!blob) {
          this.invalidate(true)
          return
        }
        if (this.disposed || id < this.mapApplied) return
        this.mapApplied = id
        const url = URL.createObjectURL(blob)
        this.cacheMap(pm.key, url)
        this.applyMap(meta, url)
        stats.mapLatencyMs += performance.now() - t1
        if (this.pendingMap) this.invalidate()
      })
      worker.postMessage({ id, params: mp, w: pw, h: ph })
      this.lastMapAt = now
      this.pendingMap = null
      const dt = performance.now() - t1
      stats.mapGlMs += dt
      stats.frames++
      stats.mapPx = pw * ph
      stats.lastMapMs = dt
      stats.maxMapMs = Math.max(stats.maxMapMs, dt)
      return
    }
    const ticket = gl.issueMap(mp, pw, ph, { ...meta, key: pm.key })
    if (ticket) this.tickets.push(ticket)
    this.lastMapAt = now
    this.pendingMap = null
    const dt = performance.now() - t1
    stats.mapGlMs += dt
    stats.frames++
    stats.mapPx = pw * ph
    this.mapIssueMs = dt
  }

  private cacheMap(key: string, url: string) {
    if (this.mapCache.size > 24) {
      const k = this.mapCache.keys().next().value as string
      const old = this.mapCache.get(k)
      this.mapCache.delete(k)
      if (old?.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(old), 400)
    }
    this.mapCache.set(key, url)
  }

  private applyMap(m: MapMeta, url: string) {
    const fx = this.fx
    if (!fx || !this.feImage || !this.filterEl) return
    fx.style.display = ''
    fx.style.left = `${m.mx0}px`
    fx.style.top = `${m.my0}px`
    fx.style.width = `${m.mw}px`
    fx.style.height = `${m.mh}px`
    this.filterEl.setAttribute('width', String(m.mw))
    this.filterEl.setAttribute('height', String(m.mh))
    this.feImage.setAttribute('width', String(m.mw))
    this.feImage.setAttribute('height', String(m.mh))
    if (this.feImage.getAttribute('href') !== url) this.feImage.setAttribute('href', url)
    this.feBlur?.setAttribute('stdDeviation', String(m.blur))
    this.feDisp[0]?.setAttribute('scale', String(m.S * 1.06))
    this.feDisp[1]?.setAttribute('scale', String(m.S))
    this.feDisp[2]?.setAttribute('scale', String(m.S * 0.94))
    this.feSat?.setAttribute('values', String(m.sat))
    if (!fx.style.backdropFilter) fx.style.backdropFilter = `url(#${this.filterId})`
  }

  /** Picks up finished map readbacks (newest ready wins) and applies them. */
  private pumpMaps(gl: GlassGL): boolean {
    if (!this.tickets.length) return false
    let ready = -1
    for (let i = this.tickets.length - 1; i >= 0; i--) {
      if (gl.isMapReady(this.tickets[i])) {
        ready = i
        break
      }
    }
    if (ready < 0) return true
    const t0 = performance.now()
    const t = this.tickets[ready]
    for (let i = 0; i <= ready; i++) {
      if (i !== ready) gl.releaseMap(this.tickets[i])
    }
    this.tickets.splice(0, ready + 1)
    const meta = t.meta as MapMeta & { key: string }
    const need = t.w * t.h * 4
    if (!this.readBuf || this.readBuf.length < need) this.readBuf = new Uint8ClampedArray(new ArrayBuffer(need))
    const tr0 = performance.now()
    gl.readMap(t, this.readBuf)
    stats.mapReadMs += performance.now() - tr0
    gl.releaseMap(t)
    const mc = this.mapCanvas!
    if (mc.width !== t.w || mc.height !== t.h) {
      mc.width = t.w
      mc.height = t.h
    }
    this.mctx!.putImageData(new ImageData(this.readBuf.subarray(0, need), t.w, t.h), 0, 0)
    const url = mc.toDataURL()
    this.cacheMap(meta.key, url)
    this.applyMap(meta, url)
    const cost = performance.now() - t0 + this.mapIssueMs
    stats.mapEncodeMs += performance.now() - t0
    stats.lastMapMs = cost
    stats.maxMapMs = Math.max(stats.maxMapMs, cost)
    return this.tickets.length > 0 || this.pendingMap !== null
  }

  private dominantClear(shapes: ShapeState[]): boolean {
    return shapes.every((s) => s.clear > 0.5)
  }

  private updateFrost(shapes: ShapeState[], blur: number, sat: number, extra: string) {
    const layer = this.layer!
    const live = new Set<HTMLElement>()
    for (const s of shapes) {
      let fr = s.frost
      if (!fr) {
        fr = document.createElement('div')
        fr.className = 'glass-frost'
        layer.insertBefore(fr, this.surface)
        s.frost = fr
      }
      live.add(fr)
      const w = Math.max(s.hx.x * 2, 1)
      const h = Math.max(s.hy.x * 2, 1)
      fr.style.transform = `translate(${s.cx.x - w / 2}px, ${s.cy.x - h / 2}px)`
      fr.style.width = `${w}px`
      fr.style.height = `${h}px`
      fr.style.borderRadius = `${Math.max(s.r.x, 0)}px`
      fr.style.opacity = String(clamp(s.mat.x, 0, 1))
      const b = s.clear > 0.5 ? blur * 0.25 : blur
      const f = `blur(${b}px) saturate(${s.clear > 0.5 ? 1.15 : sat})${extra && s.clear <= 0.5 ? ' ' + extra : ''}`
      if (fr.style.backdropFilter !== f) {
        fr.style.backdropFilter = f
        fr.style.setProperty('-webkit-backdrop-filter', f)
      }
    }
    layer.querySelectorAll('.glass-frost').forEach((n) => {
      if (!live.has(n as HTMLElement)) n.remove()
    })
  }
}

// ---------------------------------------------------------------- public attach API

export type Attached = { update(cfg: MemberConfig): void; detach(): void }

export function fieldFor(host: HTMLElement): Field {
  return HOST_FIELD.get(host) ?? new Field(host, false)
}

/** Registers a container host. Members find it through `[data-glass-container]`. */
export function attachContainer(host: HTMLElement, opts: FieldOptions): { update(o: FieldOptions): void; detach(): void; field: Field } {
  initEnv()
  const field = fieldFor(host)
  field.configure(opts)
  return {
    field,
    update: (o) => field.configure(o),
    detach: () => field.dispose(),
  }
}

/**
 * Attaches `el` as a glass member. Inside a `[data-glass-container]` it joins that container's field;
 * otherwise it becomes its own one-shape field.
 */
export function attachMember(el: HTMLElement, cfg: MemberConfig, opts: FieldOptions = {}): Attached {
  initEnv()
  if (process.env.NODE_ENV !== 'production') (window as unknown as { __glassFields?: Set<Field> }).__glassFields = fields
  const containerEl = el.parentElement?.closest<HTMLElement>('[data-glass-container]') ?? null
  let field: Field
  if (containerEl) {
    field = fieldFor(containerEl)
  } else {
    field = new Field(el, true)
    field.configure(opts)
  }
  field.addMember(el, cfg)
  return {
    update: (next) => field.updateMember(el, next),
    detach: () => {
      field.removeMember(el)
      if (field.standalone) {
        // let a dematerialising ghost finish before the field goes; the element is usually gone already
        field.dispose()
      }
    },
  }
}

export function getMemberField(el: Element): Field | null {
  return MEMBER_OF.get(el)?.field ?? null
}

export { RIM_PEAK }
