'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { CARD_KINDS, applyNames, cardPlan, isPostPath, pagePlan, transitionTarget, type CardKind } from './cardTransition'

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect
const TIMEOUT = 2500

type VT = { finished: Promise<void> }
type Doc = Document & { startViewTransition?: (cb: () => Promise<void> | void) => VT }

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
const kindOf = (el: Element) => CARD_KINDS.find((k) => el.closest(k.card))
const cardSel = CARD_KINDS.map((k) => k.card).join(',')

/**
 * Opening a project or article card morphs the card into the page (View Transitions API): the cover grows into the hero,
 * the title glides to the h1, the card opens into the page and the rest fades up. Back reverses it into the card.
 * Where the API is missing or reduced motion is on, nothing is intercepted and navigation is exactly what it was.
 *
 * One capture-phase click listener covers every card type. It prevents the link's default, which next/link respects, and
 * runs the same `router.push` inside `document.startViewTransition`, so prefetching, scroll and focus handling are Next's.
 * Back/forward is wrapped on `popstate`. The transition's update callback resolves once the new route has committed and
 * its parts are named.
 */
export function CardTransitions() {
  const router = useRouter()
  const pathname = usePathname()
  const path = useRef(pathname)
  const arrive = useRef<null | ((from: string) => void)>(null)
  const clears = useRef<(() => void)[]>([])

  useIso(() => {
    const from = path.current
    path.current = pathname
    if (from !== pathname) arrive.current?.(from)
  }, [pathname])

  useEffect(() => {
    const doc = document as Doc
    if (!doc.startViewTransition) return
    const root = document.documentElement
    const clearAll = () => clears.current.splice(0).forEach((f) => f())

    /** New side of the transition: name the destination's parts, or the card we came back to. */
    const nameArrival = async (from: string) => {
      const main = document.getElementById('main')
      if (!main) return
      if (isPostPath(location.pathname)) {
        clears.current.push(applyNames(pagePlan(main)))
        const img = main.querySelector<HTMLImageElement>('.hero__img')
        if (img && !img.complete) await Promise.race([img.decode().catch(() => undefined), new Promise((r) => setTimeout(r, 250))])
      } else if (isPostPath(from)) {
        const a = Array.from(main.querySelectorAll<HTMLAnchorElement>('a[href]')).find((l) => new URL(l.href).pathname === from && l.closest(cardSel))
        const kind = a && kindOf(a)
        const card = a && kind ? (a.closest(kind.card) as HTMLElement) : null
        const r = card?.getBoundingClientRect()
        if (card && kind && r && r.bottom > 0 && r.top < innerHeight) clears.current.push(applyNames(cardPlan(card, kind as CardKind)))
      }
      await frame()
    }

    /** Run `go` (which starts the navigation) inside a view transition. Returns false when it could not start one. */
    const run = (from: string, go: (() => void) | null) => {
      root.setAttribute('data-vt', '')
      try {
        const t = doc.startViewTransition!(
          () =>
            new Promise<void>((resolve) => {
              const timer = setTimeout(resolve, TIMEOUT)
              const done = (f: string) => {
                void nameArrival(f).then(() => {
                  clearTimeout(timer)
                  resolve()
                })
              }
              if (path.current !== from) done(from) // back/forward: React committed before the browser asked
              else arrive.current = done
              go?.()
            })
        )
        const end = () => {
          root.removeAttribute('data-vt')
          arrive.current = null
          clearAll()
        }
        void t.finished.then(end, end)
        return true
      } catch {
        root.removeAttribute('data-vt')
        return false
      }
    }

    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || calm()) return
      const u = transitionTarget(a, e, { origin: location.origin, pathname: location.pathname })
      if (!u) return
      const kind = kindOf(a)
      if (kind) clears.current.push(applyNames(cardPlan(a.closest(kind.card) as HTMLElement, kind as CardKind)))
      const to = u.pathname + u.search + u.hash
      e.preventDefault()
      if (!run(location.pathname, () => router.push(to))) {
        clearAll()
        router.push(to)
      }
    }

    const onPop = () => {
      const from = path.current
      if (from === location.pathname || calm() || !(isPostPath(from) || isPostPath(location.pathname))) return
      if (isPostPath(from)) clears.current.push(applyNames(pagePlan(document.getElementById('main') ?? document)))
      if (!run(from, null)) clearAll()
    }

    document.addEventListener('click', onClick, true)
    window.addEventListener('popstate', onPop, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', onPop, true)
    }
  }, [router])

  return null
}
