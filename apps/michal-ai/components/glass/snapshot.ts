/*
 * Page snapshot for the lens on engines without a backdrop lens (Safari, iOS, Firefox).
 *
 * Those engines cannot refract the real backdrop (no `backdrop-filter: url()`), so the page content is rendered once
 * into a canvas (html2canvas-pro, the capture liquid-glass-js uses) and the glass shader samples it, bent by the same
 * Snell rim as the svg engine. The snapshot covers the whole document in document coordinates, so scrolling never
 * recaptures: the shader only moves its lookup. Fixed layers (the page backdrop canvas) and the glass itself are left
 * out; where the snapshot is transparent the live frost box underneath shows through.
 *
 * Cost: one capture per page, on idle, never while the page scrolls or a finger is down; again only when the document
 * changes size or the route changes. An image that loads later is painted into the existing snapshot (one drawImage),
 * not recaptured. A capture that fails, or takes longer than
 * SLOW_MS, turns the lens off for the session and the glass stays plain frost (the fallback).
 */

export type Snapshot = { canvas: HTMLCanvasElement; w: number; h: number; scale: number; epoch: number }

/** Longest acceptable capture; a slower device keeps the frost finish. */
const SLOW_MS = 1500
/** Texture height cap in pixels (long pages capture at a lower scale; the rim is blurred anyway). */
const MAX_PX = 8192
const SETTLE_MS = 900

let current: Snapshot | null = null
let disabled = false
let started = false
let busy = false
let timer = 0
let lastScroll = 0
let touching = false
let epoch = 0
const listeners = new Set<() => void>()

export function getSnapshot(): Snapshot | null {
  return disabled ? null : current
}

/** Subscribes to new snapshots; starts capturing on first use. Returns an unsubscribe. */
export function onSnapshot(fn: () => void): () => void {
  listeners.add(fn)
  start()
  return () => listeners.delete(fn)
}

/** Ask for a fresh capture (route change, content swap). Debounced and deferred to idle. */
export function refreshSnapshot(): void {
  if (!started || disabled) return
  schedule(SETTLE_MS)
}

function start() {
  if (started || disabled || typeof window === 'undefined') return
  started = true
  addEventListener('scroll', () => (lastScroll = performance.now()), { passive: true })
  addEventListener('touchstart', () => (touching = true), { passive: true })
  addEventListener('touchend', () => (touching = false), { passive: true })
  addEventListener('touchcancel', () => (touching = false), { passive: true })
  addEventListener('resize', () => schedule(SETTLE_MS), { passive: true })
  // late images: paint them into the snapshot where they sit instead of capturing the page again
  document.addEventListener('load', (e) => e.target instanceof HTMLImageElement && patch(e.target), true)
  let lastH = 0
  new ResizeObserver(() => {
    const h = document.documentElement.scrollHeight
    if (Math.abs(h - lastH) > 4) {
      lastH = h
      schedule(SETTLE_MS)
    }
  }).observe(document.body)
  schedule(document.readyState === 'complete' ? SETTLE_MS : SETTLE_MS * 2)
}

function schedule(ms: number) {
  clearTimeout(timer)
  timer = window.setTimeout(attempt, ms)
}

function attempt() {
  if (disabled) return
  // never capture under a moving page: the work is on the main thread
  if (busy || touching || performance.now() - lastScroll < 400 || document.hidden) return schedule(400)
  void capture()
}

let patchTimer = 0

function patch(img: HTMLImageElement) {
  const s = current
  if (!s || busy || !img.naturalWidth) return
  const r = img.getBoundingClientRect()
  if (r.width < 2 || r.height < 2 || img.closest('[data-glass-engine]') || getComputedStyle(img).position === 'fixed') return
  const ctx = s.canvas.getContext('2d')
  if (!ctx) return
  // object-fit: cover, the way the site sets its pictures
  const k = Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight)
  const sw = r.width / k
  const sh = r.height / k
  const x = (r.left + scrollX) * s.scale
  const y = (r.top + scrollY) * s.scale
  try {
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, r.width * s.scale, r.height * s.scale)
  } catch {
    return // cross-origin without CORS: leave the gap
  }
  // a burst of loads is one texture upload
  clearTimeout(patchTimer)
  patchTimer = window.setTimeout(() => {
    if (current !== s) return
    current = { ...s, epoch: ++epoch }
    listeners.forEach((fn) => fn())
  }, 250)
}

function skip(el: Element): boolean {
  if (el.hasAttribute('data-glass-engine')) return true
  if (el.tagName === 'SCRIPT' || el.tagName === 'NOSCRIPT') return true
  return getComputedStyle(el).position === 'fixed'
}

async function capture() {
  busy = true
  const t0 = performance.now()
  try {
    const { default: html2canvas } = await import('html2canvas-pro')
    const de = document.documentElement
    const w = de.scrollWidth
    const h = de.scrollHeight
    const scale = Math.min(1, MAX_PX / h, MAX_PX / w)
    const canvas = await html2canvas(document.body, {
      backgroundColor: null,
      scale,
      logging: false,
      useCORS: true,
      x: 0,
      y: 0,
      width: w,
      height: h,
      windowWidth: de.clientWidth,
      windowHeight: innerHeight,
      scrollX: 0,
      scrollY: 0,
      ignoreElements: skip,
    })
    const ms = performance.now() - t0
    if (ms > SLOW_MS) {
      disabled = true
      current = null
    } else current = { canvas, w, h, scale, epoch: ++epoch }
    if (process.env.NODE_ENV !== 'production') console.info(`[glass] snapshot ${w}x${h} @${scale.toFixed(2)} in ${ms.toFixed(0)}ms${disabled ? ' (too slow, lens off)' : ''}`)
  } catch (err) {
    disabled = true
    current = null
    if (process.env.NODE_ENV !== 'production') console.warn('[glass] snapshot failed, frost only', err)
  } finally {
    busy = false
  }
  listeners.forEach((fn) => fn())
}
