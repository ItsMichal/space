import type { RefCallback } from 'react'
import { glass } from './glass'
import { attachMember, type MemberConfig } from './engine'

/** `.buttonStyle(.glass)` / `.buttonStyle(.glassProminent)` */
export type GlassButtonStyle = 'glass' | 'prominent'

const base = {
  shape: 'capsule',
  transition: 'materialize',
  appearance: 'auto',
} as const

const configs: Record<GlassButtonStyle, MemberConfig> = {
  glass: { ...base, effect: glass.regular.interactive() },
  // prominent: accent-tinted regular glass, the single most important action
  prominent: {
    ...base,
    effect: glass.regular.tint('color-mix(in srgb, var(--accent) 82%, transparent)').interactive(),
    appearance: 'light',
  },
}

// Module-level so the callbacks keep one identity: React re-runs a ref callback whenever it changes.
const refs: Record<GlassButtonStyle, RefCallback<HTMLElement>> = {
  glass: (node) => {
    if (!node) return
    const a = attachMember(node, configs.glass)
    return () => a.detach()
  },
  prominent: (node) => {
    if (!node) return
    const a = attachMember(node, configs.prominent)
    return () => a.detach()
  },
}

/**
 * Spread onto any button or link:
 *
 *   <button {...glassButton('prominent')} className="my-extra">Publish</button>
 *
 * Gives it glass, the press spring and touch glow. Merge your own className after the spread, or
 * use `glassButton('glass').className` explicitly.
 */
export function glassButton(style: GlassButtonStyle = 'glass') {
  return {
    ref: refs[style],
    className: `glass lg glass-btn${style === 'prominent' ? ' glass-btn--prominent' : ''}`,
    style: { borderRadius: '9999px' },
    'data-glass-button': style,
  } as const
}
