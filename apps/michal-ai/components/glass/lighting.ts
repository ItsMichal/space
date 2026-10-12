/*
 * Light source for specular highlights. The resting state is fully static: a fixed light from the upper left, no listeners,
 * no timers, no per-frame work. There is no global pointer, scroll or device-motion tracking any more.
 *
 * A glass element responds to the pointer ONLY while the pointer is over that element: the engine's field attaches
 * pointerenter / pointermove / pointerleave to its own host, passes the local pointer to `lightFor`, and eases the weight
 * back to zero (about 250ms) on leave. Touch has no hover tracking (press feedback is separate). Keyboard focus lights the
 * element the same way, with the highlight centred.
 */

export type LightState = {
  /** Unit vector towards the light, css space (y down). */
  x: number
  y: number
  px: number | null
  py: number | null
  /** 0..1, how much of the lobes shows. */
  strength: number
}

const state: LightState = { x: -0.5, y: -0.86, px: null, py: null, strength: 1 }
;[state.x, state.y] = (() => {
  const l = Math.hypot(state.x, state.y) || 1
  return [state.x / l, state.y / l]
})()

export const lightState = (): LightState => state

/** Kept for API compatibility: nothing is ever emitted, so there is nothing to subscribe to. */
export function subscribeLight(): () => void {
  return () => {}
}

/** Device-motion light was removed with the global listeners. */
export function motionNeedsGesture(): boolean {
  return false
}
export async function enableGlassMotion(): Promise<boolean> {
  return false
}

/**
 * Light direction for a field centred at (cx, cy) in viewport px. `local` is the pointer over THIS element (with a 0..1
 * weight that eases in and out); without it the light is the static resting light.
 */
export function lightFor(cx: number, cy: number, local?: { x: number; y: number; w: number } | null): { x: number; y: number; k: number } {
  if (!local || local.w <= 0) return { x: state.x, y: state.y, k: state.strength }
  const dx = local.x - cx
  const dy = local.y - cy
  const dist = Math.hypot(dx, dy)
  if (dist < 1) return { x: state.x, y: state.y, k: state.strength * (1 + 0.2 * local.w) }
  const w = Math.min(0.85, 0.35 + 0.5 * local.w) * local.w
  const nx = state.x * (1 - w) + (dx / dist) * w
  const ny = state.y * (1 - w) + (dy / dist) * w
  const l = Math.hypot(nx, ny) || 1
  return { x: nx / l, y: ny / l, k: state.strength * (1 + 0.2 * local.w) }
}
