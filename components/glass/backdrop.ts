/*
 * What is behind the glass: colour resolution, luminance probing for the adaptive light/dark flip,
 * and a cheap downscaled copy of the lidar canvas that the sample path refracts.
 */

import { hasLidarSource, requestLidarRedraw, setLidarFrameListener } from '../lidar/tap'
import { luminance } from './geometry'

export type RGBA = [number, number, number, number]

// ---------------------------------------------------------------- colour resolution

let scratch: CanvasRenderingContext2D | null = null
let epoch = 0
const colorCache = new Map<string, RGBA>()
const probes = new WeakMap<Element, HTMLElement>()

/** Bump when the theme changes so cached var() colours are re-resolved. */
export function invalidateColors(): void {
  epoch++
  colorCache.clear()
}

function canvasParse(css: string): RGBA {
  scratch ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!scratch) return [0, 0, 0, 0]
  scratch.clearRect(0, 0, 1, 1)
  scratch.fillStyle = '#000'
  scratch.fillStyle = css
  scratch.globalCompositeOperation = 'copy'
  scratch.fillRect(0, 0, 1, 1)
  scratch.globalCompositeOperation = 'source-over'
  const d = scratch.getImageData(0, 0, 1, 1).data
  // getImageData is premultiplied-lossy for alpha < 1; recover straight alpha from the css string where possible
  const a = d[3] / 255
  return a > 0 ? [d[0] / 255, d[1] / 255, d[2] / 255, a] : [0, 0, 0, 0]
}

/** Resolve any CSS colour (hex, rgb(), color-mix(), var(--x)) against `host` to straight 0..1 RGBA. */
export function resolveColor(host: Element, css: string, fallback: RGBA = [0, 0, 0, 0]): RGBA {
  if (!css) return fallback
  const key = `${epoch}|${css}|${css.includes('var(') ? getComputedStyle(host).getPropertyValue('--paper') : ''}`
  const hit = colorCache.get(key)
  if (hit) return hit
  let probe = probes.get(host)
  if (!probe) {
    probe = document.createElement('span')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none'
    host.appendChild(probe)
    probes.set(host, probe)
  }
  probe.style.color = ''
  probe.style.color = css
  const computed = getComputedStyle(probe).color
  const out = computed ? canvasParse(computed) : fallback
  if (colorCache.size > 200) colorCache.clear()
  colorCache.set(key, out)
  return out
}

export function colorLuminance(c: RGBA): number {
  return luminance(c[0], c[1], c[2])
}

// ---------------------------------------------------------------- luminance behind an element

const RGB_RE = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/g

function averageGradient(img: string): number | null {
  let sum = 0
  let n = 0
  for (const m of img.matchAll(RGB_RE)) {
    const a = m[4] ? (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])) : 1
    if (a < 0.4) continue
    sum += luminance(+m[1] / 255, +m[2] / 255, +m[3] / 255)
    n++
  }
  return n ? sum / n : null
}

/**
 * Luminance (0..1) of whatever paints behind (x, y), skipping `skip`'s subtree.
 * Honours `data-glass-luminance="0..1"` on any ancestor of the backdrop for images / video.
 * Returns null when nothing opaque was found.
 */
export function luminanceAt(x: number, y: number, skip: Element): number | null {
  const stack = document.elementsFromPoint(x, y)
  for (const el of stack) {
    if (skip.contains(el) || el.closest('[data-glass-container],[data-glass-member]')) continue
    const hint = el.closest('[data-glass-luminance]')?.getAttribute('data-glass-luminance')
    if (hint != null && hint !== '') {
      const v = parseFloat(hint)
      if (Number.isFinite(v)) return Math.min(Math.max(v, 0), 1)
    }
    const cs = getComputedStyle(el)
    const bg = cs.backgroundColor
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
      const c = canvasParse(bg)
      if (c[3] > 0.6) return colorLuminance(c)
    }
    const img = cs.backgroundImage
    if (img && img !== 'none' && /gradient/.test(img)) {
      const l = averageGradient(img)
      if (l != null) return l
    }
  }
  return null
}

// ---------------------------------------------------------------- lidar snapshot (sample path)

/** Scale of the snapshot relative to css px. Phones pay for few pixels, the lens only needs soft detail. */
const SNAP_SCALE = 0.7
const SNAP_MAX_W = 520

let snap: HTMLCanvasElement | null = null
let snapCtx: CanvasRenderingContext2D | null = null
let snapVersion = 0
let snapWanted = 0
let lastSnap = 0
let snapInterval = 50
let lidarEl: HTMLCanvasElement | null = null

export const snapshotVersion = () => snapVersion

const snapSubs = new Set<() => void>()
/** Called (inside the lidar frame task) whenever a fresh snapshot lands. */
export function onSnapshot(fn: () => void): () => void {
  snapSubs.add(fn)
  return () => {
    snapSubs.delete(fn)
  }
}

export function snapshot(): HTMLCanvasElement | null {
  return snapVersion > 0 ? snap : null
}

function onLidarFrame(canvas: HTMLCanvasElement) {
  lidarEl = canvas
  if (snapWanted <= 0) return
  const now = performance.now()
  if (now - lastSnap < snapInterval) return
  lastSnap = now
  const vw = Math.max(1, window.innerWidth)
  const vh = Math.max(1, window.innerHeight)
  const s = Math.min(SNAP_SCALE, SNAP_MAX_W / vw)
  const w = Math.max(2, Math.round(vw * s))
  const h = Math.max(2, Math.round(vh * s))
  if (!snap) {
    snap = document.createElement('canvas')
    snapCtx = snap.getContext('2d', { willReadFrequently: false })
  }
  if (!snapCtx) return
  if (snap.width !== w || snap.height !== h) {
    snap.width = w
    snap.height = h
  }
  snapCtx.clearRect(0, 0, w, h)
  snapCtx.drawImage(canvas, 0, 0, w, h)
  snapVersion++
  snapSubs.forEach((f) => f())
}

/** Ref-counted: the lidar listener is only attached while some field needs the snapshot. */
export function wantSnapshot(on: boolean, intervalMs = 50): () => void {
  if (!on) return () => {}
  snapWanted++
  snapInterval = Math.min(snapInterval, intervalMs)
  if (snapWanted === 1) {
    setLidarFrameListener(onLidarFrame)
    // still-frame lidar (reduced motion) would otherwise never reach us
    if (hasLidarSource()) requestLidarRedraw()
  }
  let released = false
  return () => {
    if (released) return
    released = true
    snapWanted--
    if (snapWanted <= 0) {
      snapWanted = 0
      setLidarFrameListener(null)
    }
  }
}

/** The lidar wrapper's opacity (the page fades the field behind articles). */
export function lidarOpacity(): number {
  const wrap = lidarEl?.parentElement
  if (!wrap) return 1
  const o = parseFloat(getComputedStyle(wrap).opacity)
  return Number.isFinite(o) ? o : 1
}
