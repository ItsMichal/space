type Box = { left: number; right: number; top: number; bottom: number }

/**
 * Where to put a preview card relative to its link (viewport coordinates, for a fixed-position card). It prefers the
 * space below, flips above when there is not enough, and is nudged so it stays inside the viewport with `margin`.
 * `ox` is how far the link's centre is from the card's left edge, so the card can grow out of that point.
 */
export function placePreview(link: Box, card: { w: number; h: number }, view: { w: number; h: number }, margin = 12, gap = 10) {
  const below = view.h - link.bottom - gap - margin >= card.h
  const above = link.top - gap - margin >= card.h
  const useAbove = !below && above
  const y = useAbove ? link.top - gap - card.h : Math.min(link.bottom + gap, view.h - card.h - margin)
  const centre = (link.left + link.right) / 2
  const x = Math.min(Math.max(centre - card.w / 2, margin), Math.max(margin, view.w - card.w - margin))
  return { x, y: Math.max(margin, y), above: useAbove, ox: centre - x }
}
