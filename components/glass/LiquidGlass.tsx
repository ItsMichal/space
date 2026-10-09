import { createElement, type ElementType, type HTMLAttributes } from 'react'

export type LiquidGlassProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType
  pill?: boolean
}

export function LiquidGlass({ as, className = '', children, pill = false, ...rest }: LiquidGlassProps) {
  const cls = `lg${pill ? ' lg--pill' : ''}${className ? ` ${className}` : ''}`
  return createElement(as ?? 'div', { ...rest, className: cls }, children)
}
