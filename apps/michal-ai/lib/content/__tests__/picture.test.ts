// Card pictures: every list entry shows a picture when the post or its parent project has one.
import { describe, expect, it } from 'vitest'
import { cardPicture, ownPicture } from '../picture'
import { getAllPosts } from '..'
import type { Post } from '../types'

const post = (p: Partial<Post>): Post => ({ title: 't', slug: 's', kind: 'article', id: 's', description: 'd', date: '2020-01-01', tags: [], body: '', readingMinutes: 1, ...p }) as Post

describe('card pictures', () => {
  it('prefers the card image, then the cover with its focus, then the first image in the text', () => {
    expect(ownPicture(post({ cardImage: '/media/a/card.webp', cardImageAlt: 'card', cover: '/media/a/cover.webp' }))).toEqual({ src: '/media/a/card.webp', alt: 'card' })
    expect(ownPicture(post({ cover: '/media/a/cover.webp', coverAlt: 'cover', coverFocus: '50% 30%' }))).toEqual({ src: '/media/a/cover.webp', alt: 'cover', focus: '50% 30%' })
    expect(ownPicture(post({ firstImage: { src: '/media/a/one.webp', alt: 'one' } }))).toEqual({ src: '/media/a/one.webp', alt: 'one' })
  })

  it('falls back to the parent picture, and cardImage none means no picture at all', () => {
    const parentImage = { src: '/media/p/cover.webp', alt: 'parent' }
    expect(cardPicture(post({ parentImage }))).toEqual(parentImage)
    expect(cardPicture(post({ parentImage, cover: '/media/a/cover.webp' }))?.src).toBe('/media/a/cover.webp')
    expect(cardPicture(post({ parentImage, cardImage: 'none', cover: '/media/a/cover.webp' }))).toBeUndefined()
  })

  it('gives a child with no picture of its own its parent project picture at load time', () => {
    const posts = getAllPosts()
    for (const child of posts.filter((p) => p.parent && !ownPicture(p) && p.cardImage !== 'none')) {
      const parent = posts.find((p) => p.slug === child.parent)
      expect(child.parentImage, child.slug).toEqual(parent && ownPicture(parent))
    }
    for (const p of posts.filter((p) => ownPicture(p))) expect(p.parentImage, p.slug).toBeUndefined()
  })
})
