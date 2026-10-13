// Card to page transitions (View Transitions API). Pure helpers, no React: which links lead to a post, which parts of a
// card are named, and the apply/cleanup bookkeeping. CardTransitions.tsx does the wiring.
//
// view-transition-name must be unique per document, and a name on the old page that has no partner on the new page just
// cross-fades. So nothing is named in CSS: the clicked card's parts are named just in time (old side), the destination
// page's parts are named when it commits (new side), and every name is removed again when the transition ends.

export const POST_PATH = /^\/(projects|writing)\/[^/]+(\/[^/]+)?\/?$/
export const isPostPath = (pathname: string) => POST_PATH.test(pathname)

/** The names shared by a card and the page it opens. */
export const NAMES = { img: 'post-img', title: 'post-title', surface: 'post-surface' } as const

/** Card kinds that lead to a post: the card element, and where its image and title are. The surface is the card itself. */
export const CARD_KINDS = [
  { card: '.tile', img: '.tile__img', title: '[data-card-title]' },
  { card: '.prow', img: null, title: '.prow__title' },
  { card: '.wrt', img: null, title: '.wrt__title' },
  { card: '.postnav__row', img: null, title: '.postnav__t' },
  { card: '.postnav__step', img: null, title: '.postnav__st' },
  { card: '.pv-in', img: '.pv-img', title: '.pv-t' },
] as const
export type CardKind = (typeof CARD_KINDS)[number]

/** The destination page's parts. */
export const POST_PARTS = { img: '.hero__img', title: '.reading__head h1', surface: '.reading__surface' } as const

export type Named = { style: { viewTransitionName: string } }
export type NamePlan = { el: Named | null | undefined; name: string }[]

/**
 * Sets each name on its element and returns a function that puts every element back as it was. A name goes to one
 * element only (the first in the plan), so the document can never hold a duplicate.
 */
export function applyNames(plan: NamePlan): () => void {
  const used = new Set<string>()
  const undo: (() => void)[] = []
  for (const { el, name } of plan) {
    if (!el || used.has(name)) continue
    used.add(name)
    const before = el.style.viewTransitionName
    el.style.viewTransitionName = name
    undo.push(() => {
      el.style.viewTransitionName = before
    })
  }
  return () => undo.splice(0).forEach((f) => f())
}

/** Structural slice of Element that the planners need, so tests can pass plain objects. */
export type Queryable<T> = { querySelector(sel: string): T | null }

/** Name plan for a clicked card: image, title, and the card itself as the surface. Missing parts are simply left out. */
export function cardPlan<T extends Named>(card: T & Queryable<T>, kind: { img: string | null; title: string }): NamePlan {
  return [
    { el: kind.img ? card.querySelector(kind.img) : null, name: NAMES.img },
    { el: card.querySelector(kind.title), name: NAMES.title },
    { el: card, name: NAMES.surface },
  ]
}

/** Name plan for a post page. */
export function pagePlan<T extends Named>(root: Queryable<T>): NamePlan {
  return [
    { el: root.querySelector(POST_PARTS.img), name: NAMES.img },
    { el: root.querySelector(POST_PARTS.title), name: NAMES.title },
    { el: root.querySelector(POST_PARTS.surface), name: NAMES.surface },
  ]
}

type ClickLike = { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented?: boolean }
type AnchorLike = { href: string; target?: string; hasAttribute?(n: string): boolean }

/** The URL to open when this click should be a view transition: a plain left click on a link to another post page on this origin. */
export function transitionTarget(a: AnchorLike, ev: ClickLike, here: { origin: string; pathname: string }): URL | null {
  if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return null
  if ((a.target && a.target !== '_self') || a.hasAttribute?.('download')) return null
  let u: URL
  try {
    u = new URL(a.href)
  } catch {
    return null
  }
  if (u.origin !== here.origin || !isPostPath(u.pathname) || u.pathname === here.pathname) return null
  return u
}
