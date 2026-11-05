// Paper transition, the entry the Link imports. It is small on purpose: it decides whether a click gets the effect and loads
// the WebGL engine (./engine.ts, plus html2canvas-pro) only when one is about to run, or on idle after the page is up.
//
// What runs: the visible part of the current page is captured to a texture and laid on a WebGL sheet over the page; React Router
// renders the destination underneath, shown as soon as it has committed; the sheet crumples in three squeezes into a ball while it
// burns away into rising ASCII, and the overlay goes. Only plain left clicks on in-app links to another path; no hash or same-page links,
// never the first load, never with reduced motion, and any failure falls back to the plain navigation.
import { PAPER_TRANSITION } from './config'
import './paper.css'

let running = false
let warmed: Promise<typeof import('./engine')> | null = null

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export function paperWants(to: string): boolean {
  if (!PAPER_TRANSITION || running || typeof window === 'undefined' || calm()) return false
  if (!('WebGL2RenderingContext' in window)) return false
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
  running = true
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
  } finally {
    running = false
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
