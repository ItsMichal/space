'use client'

import { usePathname } from '@/lib/nav'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { CARD_KINDS, applyNames, cardPlan, isPostPath, pagePlan, transitionTarget, type CardKind } from './cardTransition'

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect
// How long a back/forward transition waits for the destination to commit before giving up (rendering is paused while it waits).
const POP_WAIT = 700
// A card is named at the click, before React Router has the destination's data; if no transition ever starts, the names go again.
const STALE_NAMES = 4000

type VT = { finished: Promise<unknown> }
type Doc = Document & { startViewTransition?: (cb: () => Promise<void> | void) => VT }

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const kindOf = (el: Element) => CARD_KINDS.find((k) => el.closest(k.card))
const cardSel = CARD_KINDS.map((k) => k.card).join(',')

/**
 * Route changes are view transitions (the API is missing or reduced motion is on: nothing here runs and navigation is exactly
 * what it was). Opening a project or article card morphs the card into the page: the cover grows into the hero, the title glides
 * to the h1, the card opens into the page and the rest fades up; back reverses it into the card. Every other route change is
 * a calm cross-fade of the page (transition.css).
 *
 * Who starts the transition: for link clicks React Router does (`viewTransition` + `flushSync` on every `Link`, see lib/nav.tsx).
 * It waits for the destination's loader data with the old page still live, then commits the new route synchronously inside the
 * transition's update callback. That keeps the freeze to the commit itself; a callback that waits on the network pauses
 * rendering for the whole wait. This component only names the parts that morph:
 *   - the clicked card, at the click (old side), by a capture listener that leaves the click alone;
 *   - the destination page's parts, or the card we came back to, in a layout effect on the pathname, which runs inside that
 *     synchronous commit (new side).
 * Back / forward is not a Link navigation, so a capture-phase popstate listener holds React Router's handler back, starts the
 * transition and replays the same popstate from inside its update callback.
 * view-transition-name must be unique in the document, so names are set just in time and every one is removed again when the
 * transition ends. `document.startViewTransition` is wrapped once to learn when that is (and to mark <html data-vt>).
 */
export function CardTransitions() {
  const pathname = usePathname()
  const path = useRef(pathname)
  const arrive = useRef<null | (() => void)>(null)
  const clears = useRef<(() => void)[]>([])

  // New side of the transition, inside the commit that shows the new route.
  useIso(() => {
    const from = path.current
    path.current = pathname
    if (from === pathname) return
    const root = document.documentElement
    // A navigation without a view transition fades the page in (globals.css); one with a transition has the cross-fade instead.
    if (root.hasAttribute('data-vt')) root.removeAttribute('data-fade')
    else root.setAttribute('data-fade', '')
    // The page scrolls smoothly for in-page links (html { scroll-behavior: smooth }). A route change must not: React Router puts the
    // new page at the top, or back where it was, from a layout effect that runs right after this one, and that has to be a jump.
    root.setAttribute('data-route-jump', '')
    requestAnimationFrame(() => root.removeAttribute('data-route-jump'))
    const main = document.getElementById('main')
    if (main && root.hasAttribute('data-vt')) {
      if (isPostPath(pathname)) clears.current.push(applyNames(pagePlan(main)))
      else if (isPostPath(from)) {
        const a = Array.from(main.querySelectorAll<HTMLAnchorElement>('a[href]')).find((l) => new URL(l.href).pathname === from && l.closest(cardSel))
        const kind = a && kindOf(a)
        const card = a && kind ? (a.closest(kind.card) as HTMLElement) : null
        const r = card?.getBoundingClientRect()
        if (card && kind && r && r.bottom > 0 && r.top < innerHeight) clears.current.push(applyNames(cardPlan(card, kind as CardKind)))
      }
    }
    arrive.current?.()
  }, [pathname])

  useEffect(() => {
    const doc = document as Doc
    const original = doc.startViewTransition
    if (!original) return
    const root = document.documentElement
    const clearAll = () => clears.current.splice(0).forEach((f) => f())
    let staleTimer: ReturnType<typeof setTimeout> | undefined

    // Learn when any view transition (React Router's or the popstate one) starts and ends.
    let current: VT | null = null
    doc.startViewTransition = function (this: Document, cb: () => Promise<void> | void) {
      clearTimeout(staleTimer)
      root.setAttribute('data-vt', '')
      const t = original.call(this, cb) as VT
      current = t
      const end = () => {
        if (current !== t) return // superseded: the newer transition owns the marker and the names
        current = null
        root.removeAttribute('data-vt')
        clearAll()
      }
      void t.finished.then(end, end)
      return t
    } as Doc['startViewTransition']

    /** Old side: name the clicked card's image, title and surface (a click that leads to a project or article page). */
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || calm()) return
      const u = transitionTarget(a, e, { origin: location.origin, pathname: location.pathname })
      const kind = u && kindOf(a)
      if (!u || !kind) return
      clearAll()
      clears.current.push(applyNames(cardPlan(a.closest(kind.card) as HTMLElement, kind as CardKind)))
      clearTimeout(staleTimer)
      staleTimer = setTimeout(clearAll, STALE_NAMES)
    }

    // Back / forward: replay the popstate from inside a transition, after the old page has been captured.
    let replaying = false
    const onPop = (e: PopStateEvent) => {
      if (replaying) return
      const from = path.current
      if (from === location.pathname || calm()) return
      e.stopImmediatePropagation()
      clearAll()
      if (isPostPath(from)) clears.current.push(applyNames(pagePlan(document.getElementById('main') ?? document)))
      const replay = () => {
        replaying = true
        try {
          window.dispatchEvent(new PopStateEvent('popstate', { state: e.state }))
        } finally {
          replaying = false
        }
      }
      try {
        doc.startViewTransition!(
          () =>
            new Promise<void>((resolve) => {
              const timer = setTimeout(done, POP_WAIT)
              function done() {
                clearTimeout(timer)
                arrive.current = null
                resolve()
              }
              arrive.current = done
              replay()
            })
        )
      } catch {
        clearAll()
        replay()
      }
    }

    document.addEventListener('click', onClick, true)
    window.addEventListener('popstate', onPop, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', onPop, true)
      doc.startViewTransition = original
      clearTimeout(staleTimer)
      clearAll()
      root.removeAttribute('data-vt')
    }
  }, [])

  return null
}
