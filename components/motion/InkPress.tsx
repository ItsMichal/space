'use client'

import type { ReactNode } from 'react'
import { InkLayer } from './InkLayer'

/**
 * A button whose press leaves ink (see InkLayer for the physics). The label never moves more than half a pixel.
 */
export function InkPress({ children, className = '', onPress }: { children: ReactNode; className?: string; onPress?: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={`ink-press relative isolate inline-flex min-h-[44px] items-center justify-center overflow-hidden rounded-full border border-hairline bg-paper-raised px-6 font-sans text-ink [touch-action:manipulation] ${className}`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <InkLayer />
      <span className="relative">{children}</span>
    </button>
  )
}
