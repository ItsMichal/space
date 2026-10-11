'use client'

import type { ElementType, HTMLAttributes } from 'react'
import { Glass } from './react'
import { glass } from './glass'

export type LiquidGlassProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType
  pill?: boolean
  /** Width of the refracting rim in px. Default min(radius, 24). */
  bezel?: number
  /** Lens strength. Default var(--glass-refraction). */
  refraction?: number
  /** Frost in px. Default var(--glass-blur). */
  blur?: number
  /** Backdrop saturation. Default var(--glass-saturate). */
  saturate?: number
  /** Extra attributes when rendered as a link or button (href, target, type...). */
  [attr: string]: unknown
}

/**
 * Compatibility wrapper over the glass engine (see ./README.md). Same props as before; inside a
 * GlassEffectContainer it joins the container's field, otherwise it is its own one-shape field.
 * Regular glass; the shape follows the CSS border-radius (`pill` adds .lg--pill, otherwise var(--radius-lg)).
 */
export function LiquidGlass({ pill = false, className = '', ...rest }: LiquidGlassProps) {
  return (
    <Glass
      effect={glass.regular}
      shape="inherit"
      className={`${pill ? 'lg--pill ' : ''}${className}`.trim()}
      {...rest}
    />
  )
}
