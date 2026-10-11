import { project, springCoeffs } from '@space/motion/spring'
/*
 * Pure maths for the glass engine. Nothing here touches the DOM, so it is unit-tested; the GLSL in
 * shaders.ts mirrors these functions line for line.
 */

// ---------------------------------------------------------------- shapes

/** SwiftUI `Shape` equivalents. `{ cornerRadius }` is `.rect(cornerRadius:)`. */
/** 'inherit' takes the radius from the element's CSS border-radius (used by the LiquidGlass wrapper). */
export type GlassShape = 'capsule' | 'circle' | 'squircle' | 'rect' | 'containerConcentric' | 'inherit' | { cornerRadius: number }

export const shapes = {
  capsule: 'capsule',
  circle: 'circle',
  squircle: 'squircle',
  rect: (cornerRadius = 0): GlassShape => ({ cornerRadius }),
  containerConcentric: 'containerConcentric',
} as const

/**
 * Corner radius in px for a w x h box.
 * `concentricRadius` is the parent's radius minus the inset (resolved by the engine from the DOM).
 */
export function resolveRadius(shape: GlassShape, w: number, h: number, concentricRadius = 0): number {
  const half = Math.min(w, h) / 2
  if (shape === 'capsule' || shape === 'circle') return half
  // soft, organic silhouette: rounder than a rounded rect, calmer than a capsule
  if (shape === 'squircle') return half * 0.74
  if (shape === 'rect') return 0
  if (shape === 'containerConcentric' || shape === 'inherit') return Math.min(Math.max(concentricRadius, 0), half)
  return Math.min(Math.max(shape.cornerRadius, 0), half)
}

// ---------------------------------------------------------------- SDF

/** Signed distance to a rounded rectangle centred on (cx, cy) with half extents (hx, hy). */
export function sdRoundRect(px: number, py: number, cx: number, cy: number, hx: number, hy: number, r: number): number {
  const qx = Math.abs(px - cx) - (hx - r)
  const qy = Math.abs(py - cy) - (hy - r)
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r
}

/**
 * Polynomial smooth minimum (the metaball union). Shapes start to bleed into each other when
 * their distance fields differ by less than `k` and are fully fused around a gap of k / 2.
 */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b)
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

export type SdfShape = { cx: number; cy: number; hx: number; hy: number; r: number; group?: number }

/** Smooth union of shapes. Shapes sharing a non-negative `group` (glassEffectUnion) fuse with `unionK`. */
export function unionSdf(px: number, py: number, list: readonly SdfShape[], k: number, unionK = k): number {
  let d = Infinity
  let g = -1
  for (const s of list) {
    const di = sdRoundRect(px, py, s.cx, s.cy, s.hx, s.hy, s.r)
    const sg = s.group ?? -1
    if (d === Infinity) {
      d = di
      g = sg
    } else {
      const same = sg >= 0 && sg === g
      d = smin(d, di, same ? unionK : k)
      if (!same) g = -1
    }
  }
  return d
}

// ---------------------------------------------------------------- lens profile

/** Convex squircle height h(t), t = 0 at the silhouette, 1 at `bezel` px inside. */
export function rimHeight(t: number): number {
  const u = 1 - Math.min(Math.max(t, 0), 1)
  return Math.pow(1 - u * u * u * u, 0.25)
}

/** dh/dt of rimHeight, analytic: u^3 (1 - u^4)^(-3/4). Clamped near the silhouette where it diverges. */
export function rimSlope(t: number): number {
  const u = 1 - Math.min(Math.max(t, 0), 1)
  const w = Math.max(1 - u * u * u * u, 1e-4)
  return (u * u * u) / Math.pow(w, 0.75)
}

/** Refractive index of the glass (Snell). Apple's glass reads as roughly 1.5. */
export const GLASS_IOR = 1.5

/**
 * Lateral ray shift (in thickness units) of a ray entering normal to the flat top and leaving through
 * the curved rim. The surface tangent is the slope; the ray bends by Snell's law about the normal.
 */
export function rimShift(t: number, thickness = 1, ior = GLASS_IOR): number {
  const n = Math.atan(rimSlope(t))
  const refracted = n - Math.asin(Math.sin(n) / ior)
  return Math.tan(refracted) * thickness * rimHeight(t)
}

/** Peak of rimShift over t, used to normalise the map to [-1, 1]. 512 samples, evaluated once. */
export const RIM_PEAK: number = (() => {
  let m = 0
  for (let i = 1; i <= 512; i++) m = Math.max(m, Math.abs(rimShift(i / 512)))
  return m || 1
})()

// ---------------------------------------------------------------- springs

export type Spring = { x: number; v: number }

export type SpringConfig = { stiffness: number; damping: number }

/** Geometry following the DOM: critically damped, no overshoot, ~80ms. Slowness lives in the layout transition. */
export const FOLLOW: SpringConfig = { stiffness: 2200, damping: 2 * Math.sqrt(2200) }
/** Matched-geometry morphs, materialise, crease decay: viscous, critically damped, settles in about 600ms. */
export const MORPH: SpringConfig = { stiffness: 49, damping: 2 * Math.sqrt(49) }
/** Press scale: critically damped, soft settle, no wobble. */
export const PRESS: SpringConfig = { stiffness: 260, damping: 2 * Math.sqrt(260) }
/** @deprecated kept for imports; identical to PRESS (the design has no bounce). */
export const BOUNCE: SpringConfig = PRESS

/**
 * Spring from perceptual terms (WWDC18 "Designing Fluid Interfaces"): `response` is the time in seconds
 * of one undamped period, `damping` the ratio (1 = critically damped, ~0.85 = a hint of bounce, used
 * only when the user threw something).
 */
export function springFor(response: number, damping = 1): SpringConfig {
  // One spring maths for the whole site: the coefficients come from @space/motion/spring.ts. This file only keeps the
  // mutable {x, v} stepper because the glass engine runs it in a hot loop over many shapes.
  const { k, c } = springCoeffs({ response: Math.max(response, 0.05), damping })
  return { stiffness: k, damping: c }
}

/** Where a throw lands: velocity (px/s) projected with iOS-style deceleration (rate 0.998 per ms). */
export function projectMomentum(velocity: number, rate = 0.998): number {
  return project(0, velocity, rate)
}

/** Resistance beyond a limit: moves with the finger at first, then progressively less. */
export function rubberBand(x: number, min: number, max: number, dim = 120): number {
  if (x >= min && x <= max) return x
  const over = x < min ? min - x : x - max
  const damped = (1 - 1 / ((over * 0.55) / dim + 1)) * dim
  return x < min ? min - damped : max + damped
}

/** Semi-implicit Euler with sub-steps; stable for dt up to ~50ms at these stiffnesses. */
export function stepSpring(s: Spring, target: number, cfg: SpringConfig, dt: number): void {
  const steps = Math.max(1, Math.ceil(dt / 0.008))
  const h = dt / steps
  for (let i = 0; i < steps; i++) {
    const a = cfg.stiffness * (target - s.x) - cfg.damping * s.v
    s.v += a * h
    s.x += s.v * h
  }
}

export function springSettled(s: Spring, target: number, eps = 0.02): boolean {
  return Math.abs(s.x - target) < eps && Math.abs(s.v) < eps * 4
}

// ---------------------------------------------------------------- misc

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
export const mix = (a: number, b: number, t: number) => a + (b - a) * t
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Relative luminance of an sRGB colour (0..1 channels). */
export function luminance(r: number, g: number, b: number): number {
  const f = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/**
 * Light/dark flip with hysteresis, as Apple's small glass flips on what is behind it.
 * Returns whether the glass should be dark given the backdrop luminance and the previous state.
 */
export function flipTone(lum: number, prevDark: boolean, lo = 0.36, hi = 0.5): boolean {
  return prevDark ? lum < hi : lum < lo
}
