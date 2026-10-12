'use client'

import { useSyncExternalStore } from 'react'
import { getHeroIndex, onHeroIndex } from '@/lib/hero/store'
import './hero.css'

/**
 * The hero background follows the phrase on screen: one flat tint layer per project, stacked, and only the opacity of
 * the active one is 1. A change cross-fades over a couple of seconds (a CSS opacity transition, so it retargets from
 * wherever it is when the line is stepped, paused or swiped, and runs on the compositor). Nothing else moves and
 * nothing repaints. Under reduced motion it stays on the first project's tint. The tints are the same palette tints the
 * project cards use, and every one is pale enough for ink and muted ink to keep AA on top of it.
 */
export function HeroAtmosphere({ tints }: { tints: string[] }) {
  const index = useSyncExternalStore(onHeroIndex, getHeroIndex, () => 0)
  return (
    <div className="hero-atm" aria-hidden>
      {tints.map((hex, i) => (
        <div key={i} className="hero-atm__layer" data-active={i === index ? '' : undefined} style={{ backgroundColor: hex }} />
      ))}
    </div>
  )
}
