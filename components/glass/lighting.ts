/*
 * Light source for specular highlights. Apple's glass lights react to the environment and, in some
 * cases, to device motion. Here:
 *
 *   pointer      the highlight turns towards the cursor / last touch (fine pointers and touch alike)
 *   orientation  DeviceOrientation tilts the light. Android and desktop browsers expose it without a
 *                prompt and are attached automatically. iOS Safari needs a user-gesture permission
 *                request, so it is never prompted implicitly: call `enableGlassMotion()` from a click
 *                handler to opt in. Until then iOS falls back to scroll-driven light drift.
 *   scroll       a slow drift so static pages still feel lit
 *
 * Everything is heavily smoothed (exponential, ~0.45s) and fans out to subscribed fields.
 */

export type LightState = {
  /** Unit vector towards the light, css space (y down). */
  x: number
  y: number
  /** Pointer position in viewport px, or null when no pointer has been seen. */
  px: number | null
  py: number | null
  /** 0..1, how much of the lobes shows (0 when reduced motion and static). */
  strength: number
}

type Listener = () => void

const state: LightState = { x: -0.5, y: -0.86, px: null, py: null, strength: 1 }
const target = { x: -0.5, y: -0.86 }
const listeners = new Set<Listener>()
let raf = 0
let started = false
let tilt: { x: number; y: number } | null = null
let reduced = false
let scrollDrift = 0

export const lightState = (): LightState => state

export function subscribeLight(fn: Listener): () => void {
  listeners.add(fn)
  start()
  return () => {
    listeners.delete(fn)
  }
}

function norm(x: number, y: number): [number, number] {
  const l = Math.hypot(x, y) || 1
  return [x / l, y / l]
}

function retarget() {
  // orientation wins when present, then scroll drift around the default top-left light
  let x = -0.5 + Math.sin(scrollDrift) * 0.35
  let y = -0.86
  if (tilt) {
    x = tilt.x
    y = tilt.y - 0.2
  }
  ;[target.x, target.y] = norm(x, y)
  kick()
}

function kick() {
  if (!raf) raf = requestAnimationFrame(step)
}

function step() {
  raf = 0
  // heavy smoothing: the highlight drifts, it never snaps (time constant ~0.45s at 60Hz)
  const f = reduced ? 1 : 0.04
  const dx = target.x - state.x
  const dy = target.y - state.y
  if (Math.abs(dx) + Math.abs(dy) < 0.002) {
    state.x = target.x
    state.y = target.y
  } else {
    const [nx, ny] = norm(state.x + dx * f, state.y + dy * f)
    state.x = nx
    state.y = ny
    raf = requestAnimationFrame(step)
  }
  listeners.forEach((l) => l())
}

function onPointer(e: PointerEvent) {
  state.px = e.clientX
  state.py = e.clientY
  // Pointer direction is resolved per field (needs the field centre); just wake subscribers.
  kick()
  listeners.forEach((l) => l())
}

function onScroll() {
  scrollDrift = window.scrollY / 600
  if (!tilt) retarget()
}

function onOrientation(e: DeviceOrientationEvent) {
  if (e.gamma == null || e.beta == null) return
  // gamma: left/right tilt -90..90, beta: front/back -180..180 (about 45 when held to read)
  const gx = Math.max(-1, Math.min(1, e.gamma / 35))
  const gy = Math.max(-1, Math.min(1, (e.beta - 45) / 35))
  tilt = { x: gx, y: gy }
  retarget()
}

let motionAttached = false

function attachMotion() {
  if (motionAttached) return
  motionAttached = true
  window.addEventListener('deviceorientation', onOrientation, { passive: true })
}

type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

/** True when device-motion light needs an explicit user gesture (iOS 13+). */
export function motionNeedsGesture(): boolean {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return false
  return typeof (DeviceOrientationEvent as OrientationCtor).requestPermission === 'function'
}

/** Call from a click / touchend handler. Resolves true when motion light is live. */
export async function enableGlassMotion(): Promise<boolean> {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return false
  const ctor = DeviceOrientationEvent as OrientationCtor
  if (typeof ctor.requestPermission === 'function') {
    try {
      if ((await ctor.requestPermission()) !== 'granted') return false
    } catch {
      return false
    }
  }
  attachMotion()
  return true
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  reduced = mq.matches
  state.strength = reduced ? 0.7 : 1
  mq.addEventListener('change', () => {
    reduced = mq.matches
    state.strength = reduced ? 0.7 : 1
  })
  if (!reduced) {
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('pointerdown', onPointer, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    // Chromium on Android and desktop need no permission; iOS does, so it stays off until opted in.
    if (!motionNeedsGesture()) attachMotion()
  }
}

/**
 * Light direction as seen from a field centred at (cx, cy) in viewport px: towards the pointer when
 * one is known and near, blended with the ambient (orientation / scroll) light otherwise.
 */
export function lightFor(cx: number, cy: number): { x: number; y: number; k: number } {
  if (state.px == null || state.py == null || tilt) return { x: state.x, y: state.y, k: state.strength }
  const dx = state.px - cx
  const dy = state.py - cy
  const dist = Math.hypot(dx, dy)
  if (dist < 1) return { x: state.x, y: state.y, k: state.strength }
  const w = Math.min(1, 140 / (dist + 1)) * 0.75 + 0.25
  const [nx, ny] = norm(state.x * (1 - w) + (dx / dist) * w, state.y * (1 - w) + (dy / dist) * w)
  return { x: nx, y: ny, k: state.strength * (0.75 + 0.25 * Math.min(1, 400 / (dist + 50))) }
}
