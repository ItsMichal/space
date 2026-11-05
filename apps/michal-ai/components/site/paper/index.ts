// Paper transition, the entry the Link imports. It is small on purpose: it decides whether a click gets the effect and loads
// the WebGL engine (./engine.ts, with the page painter in lib/paint) only when one is about to run, or on idle after the page is up.
//
// What runs: the visible part of the current page is captured to a texture and laid on a WebGL sheet over the page; React Router
// renders the destination underneath, shown as soon as it has committed; the sheet crumples in one bouncy drop into a ball while it
// burns away into rising ASCII, and the overlay goes. Plain left clicks on in-app links to another path, and back and forward
// (components/site/CardTransitions.tsx); no hash or same-page links, never the first load, never with reduced motion, and any
// failure falls back to the plain navigation. A navigation while one is burning takes over from it.
import { PAPER_TRANSITION } from './config'
import './paper.css'

let warmed: Promise<typeof import('./engine')> | null = null

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** The transition can run here: on, in a browser with WebGL2, motion allowed. Back and forward ask this (the URL has moved already). */
export function paperReady(): boolean {
  return PAPER_TRANSITION && typeof window !== 'undefined' && !calm() && 'WebGL2RenderingContext' in window
}

/** A click on a link to `to` gets the transition. One already on screen does not stop it: the new one takes over. */
export function paperWants(to: string): boolean {
  if (!paperReady()) return false
  let u: URL
  try {
    u = new URL(to, location.href)
  } catch {
    return false
  }
  return u.origin === location.origin && u.pathname !== location.pathname
}

function warm() {
  warmed ??= import('./engine')
  return warmed
}

/** Runs the transition around `go` (the router navigation). Resolves when the live page is back. */
export async function paperNavigate(go: () => Promise<void> | void): Promise<void> {
  let went = false
  const goOnce = () => {
    went = true
    return go()
  }
  try {
    const engine = await warm()
    await engine.runPaper(goOnce)
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.warn('[paper] transition failed, plain navigation', err)
    if (!went) await goOnce()
  }
}

// Fetch the engine once the page is idle, or on the first hover of a link, so the first click does not wait for it.
if (PAPER_TRANSITION && typeof window !== 'undefined') {
  const early = () => {
    if (!calm()) void warm().catch(() => (warmed = null))
  }
  addEventListener('pointerover', (e) => (e.target as Element | null)?.closest?.('a[href^="/"]') && early(), { passive: true })
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(early, { timeout: 6000 }) : setTimeout(early, 4000))
  if (document.readyState === 'complete') idle()
  else addEventListener('load', idle, { once: true })
}
