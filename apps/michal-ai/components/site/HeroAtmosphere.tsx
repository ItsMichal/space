'use client'

import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react'
import { getHeroIndex, onHeroIndex } from '@/lib/hero/store'
import './hero.css'

/**
 * The hero background follows the phrase on screen: one flat tint layer per project, stacked, and only the opacity of
 * the active one is 1. A change cross-fades over a couple of seconds (a CSS opacity transition, so it retargets from
 * wherever it is when the line is stepped, paused or swiped, and runs on the compositor). Nothing else moves and
 * nothing repaints. Under reduced motion it stays on the first project's tint. The tints are the same palette tints the
 * project cards use, and every one is pale enough for ink and muted ink to keep AA on top of it.
 *
 * Safari's own UI takes the page colour too: iOS 26 Safari ignores theme-color and paints its bars, and the compact toolbar
 * strip at the side in landscape, from the page background (the <html> colour, which also shows on overscroll). While the
 * hero fills the top of the screen, <html data-hero-edge> sets that colour to the active tint (hero.css), so the strip
 * matches the hero instead of the paper; once the hero scrolls away it goes back to the paper. The flag flips on one passive
 * scroll listener (only when crossing the line, no per-frame work), and leaving the page removes it.
 *
 * The top status bar is not tinted, on purpose. iOS 26.3 Safari colours it from a fixed element at the top edge (here the
 * nav's header, so the paper) and reads it once, at first paint: later changes, a replaced element, scrolling and client
 * navigation all keep the first colour (checked in the simulator). A band in the tint there would tint the bar on the
 * home page, but it would then stay tinted over the paper below the hero and on every page reached from home.
 */
export function HeroAtmosphere({ tints }: { tints: string[] }) {
  const index = useSyncExternalStore(onHeroIndex, getHeroIndex, () => 0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--edge-tint', tints[index] ?? tints[0] ?? '')
  }, [index, tints])

  useEffect(() => {
    const root = document.documentElement
    let on: boolean | null = null
    const update = () => {
      const atm = ref.current
      // The atmosphere is solid for its top half; past a quarter of it scrolled, the paper shows at the bottom of the screen.
      const next = !!atm && window.scrollY < atm.offsetHeight * 0.25
      if (next === on) return
      on = next
      if (next) root.setAttribute('data-hero-edge', '')
      else root.removeAttribute('data-hero-edge')
    }
    update()
    // later changes ease (hero.css); the first one is instant, so the page does not fade into its own colour on load
    // (two frames: the first colour must be styled before the transition exists)
    let ready = requestAnimationFrame(() => {
      ready = requestAnimationFrame(() => root.setAttribute('data-hero-edge-ready', ''))
    })
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    return () => {
      cancelAnimationFrame(ready)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      root.removeAttribute('data-hero-edge')
      root.removeAttribute('data-hero-edge-ready')
      root.style.removeProperty('--edge-tint')
    }
  }, [])

  return (
    <div ref={ref} className="hero-atm" aria-hidden>
      {tints.map((hex, i) => (
        <div key={i} className="hero-atm__layer" data-active={i === index ? '' : undefined} style={{ '--tint': hex } as CSSProperties} />
      ))}
    </div>
  )
}
