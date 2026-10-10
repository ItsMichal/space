export type ShaderVariant = 'stipple' | 'scan' | 'bleed'

export const SHADER_VARIANTS: ShaderVariant[] = ['stipple', 'scan', 'bleed']

/** Recommended default. See docs/shaders/design.md. */
export const DEFAULT_VARIANT: ShaderVariant = 'stipple'

export const VARIANT_INDEX: Record<ShaderVariant, number> = { stipple: 0, scan: 1, bleed: 2 }

export type ShaderTuning = {
  variant?: ShaderVariant
  /** 0 = true image always (edge blend only), 1 = full effect. Default 1. */
  intensity?: number
  /** Multiplier on the resolve and scan speed. Default 1 (about a one second spring, scan 3.2s). */
  speed?: number
  /** Hold the resolve at a fixed 0..1 (dev comparison). null = scroll-driven. */
  progress?: number | null
}
