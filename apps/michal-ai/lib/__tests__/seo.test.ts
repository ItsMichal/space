import { describe, expect, it } from 'vitest'
import { homeMetadata, listMetadata, SITE_URL } from '../seo'

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

describe('listMetadata', () => {
  it('has og:image', () => {
    expect(images(listMetadata('article', 'Writing', 'd').openGraph?.images)).toHaveLength(1)
  })
})
