import { describe, expect, it } from 'vitest'
import { DEFAULT_SHARE_IMAGE, homeMetadata, listMetadata, shareImagePath, SITE_URL } from '../seo'

const images = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : [])

describe('homeMetadata', () => {
  // Regression: a page-level `openGraph` replaces the layout's, so the home page lost og:image.
  it('carries og:image and twitter:image with absolute URLs', () => {
    const m = homeMetadata()
    expect(images(m.openGraph?.images)).toHaveLength(1)
    expect(JSON.stringify(m.openGraph?.images)).toContain(`${SITE_URL}/`)
    expect(images(m.twitter?.images)).toHaveLength(1)
    expect(m.alternates?.canonical).toBe(SITE_URL)
    expect(m.openGraph?.title).toBeTruthy()
    expect(m.openGraph?.description).toBeTruthy()
  })
})

describe('share images', () => {
  it('points WebP covers and the default card at JPEG twins', () => {
    expect(shareImagePath('/media/foo/cover.webp')).toBe('/media/_og/foo.jpg')
    expect(shareImagePath('/media/foo/cover.png')).toBe('/media/foo/cover.png')
    expect(DEFAULT_SHARE_IMAGE).toMatch(/\.jpg$/)
    expect(JSON.stringify(homeMetadata().openGraph?.images)).toContain('.jpg')
  })
})

describe('listMetadata', () => {
  it('has og:image', () => {
    expect(images(listMetadata('article', 'Writing', 'd').openGraph?.images)).toHaveLength(1)
  })
})
