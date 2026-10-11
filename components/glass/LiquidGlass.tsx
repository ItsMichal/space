'use client'

import { createElement, useRef, type ElementType, type HTMLAttributes } from 'react'
import { useLiquidGlass, type LiquidGlassOptions } from './useLiquidGlass'

export type LiquidGlassProps = HTMLAttributes<HTMLElement> &
  LiquidGlassOptions & {
    as?: ElementType
    pill?: boolean
    /** Extra attributes when rendered as a link or button (href, target, type...). */
    [attr: string]: unknown
  }

/** Floating liquid glass surface: refracted in Chromium, frosted elsewhere. For chrome only, never content. */
export function LiquidGlass({
  as,
  className = '',
  children,
  pill = false,
  bezel,
  refraction,
  blur,
  saturate,
  ...rest
}: LiquidGlassProps) {
  const ref = useRef<HTMLElement | null>(null)
  useLiquidGlass(ref, { bezel, refraction, blur, saturate })
  const cls = `lg${pill ? ' lg--pill' : ''}${className ? ` ${className}` : ''}`
  return createElement(as ?? 'div', { ...rest, ref, className: cls }, children)
}
