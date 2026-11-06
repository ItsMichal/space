import type { Post } from './types'

export type CardPicture = { src: string; alt: string; focus?: string }

/** A post's own picture: its card image, else its cover (with its focus), else the first image in its text. `cardImage: none` means none. */
export function ownPicture(p: Omit<Post, 'body'>): CardPicture | undefined {
  if (p.cardImage === 'none') return undefined
  if (p.cardImage) return { src: p.cardImage, alt: p.cardImageAlt ?? '' }
  if (p.cover) return { src: p.cover, alt: p.coverAlt ?? '', focus: p.coverFocus }
  return p.firstImage
}

/** The picture a post shows on cards and index rows: its own, else its parent project's (`parentImage`, set at load time). */
export function cardPicture(p: Omit<Post, 'body'>): CardPicture | undefined {
  if (p.cardImage === 'none') return undefined
  return ownPicture(p) ?? p.parentImage
}
