import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getAllPosts } from '@/lib/content'
import { homeMetadata, listMetadata, postMetadata, profilePageJsonLd, websiteJsonLd, SITE_URL } from '../seo'

const appDir = join(__dirname, '../../app')

// Share cards are rendered by scripts/share-cards.ts and referenced by lib/rr/head.ts. A page's own `images` would replace them,
// so no metadata builder may set them (that is how the home page once lost its card, and how posts got raw WebP covers).
describe('share card metadata', () => {
  it('leaves og:image / twitter:image to the generated cards', () => {
    expect(homeMetadata().openGraph?.images).toBeUndefined()
    expect(homeMetadata().twitter?.images).toBeUndefined()
    expect(listMetadata('article', 'Writing', 'd').openGraph?.images).toBeUndefined()
    for (const post of getAllPosts()) {
      const m = postMetadata(post)
      expect(m.openGraph?.images, post.slug).toBeUndefined()
      expect(m.twitter?.images, post.slug).toBeUndefined()
    }
  })

  it('gives every route module that builds head tags a generated card', () => {
    const routes = join(appDir, 'routes')
    const heads = readdirSync(routes).filter((f) => f.endsWith('.tsx') && readFileSync(join(routes, f), 'utf8').includes('headFor('))
    expect(heads.length).toBeGreaterThan(5)
    for (const f of heads) expect(readFileSync(join(routes, f), 'utf8'), f).toContain('shareFor(')
  })

  it('sets twitter:site and creator on every page type', () => {
    const post = getAllPosts()[0]
    for (const m of [homeMetadata(), listMetadata('project', 'Projects', 'd'), postMetadata(post)]) {
      expect(m.twitter).toMatchObject({ card: 'summary_large_image', site: expect.stringMatching(/^@/), creator: expect.stringMatching(/^@/) })
    }
  })
})

describe('homeMetadata', () => {
  it('has canonical, title and description', () => {
    const m = homeMetadata()
    expect(m.alternates?.canonical).toBe(SITE_URL)
    expect(m.openGraph?.title).toBeTruthy()
    expect(m.openGraph?.description).toBeTruthy()
  })
})

describe('home JSON-LD', () => {
  it('wraps the Person in a ProfilePage and gives WebSite an alternateName', () => {
    expect(profilePageJsonLd['@type']).toBe('ProfilePage')
    expect(profilePageJsonLd.mainEntity['@id']).toBe(`${SITE_URL}/#person`)
    expect(profilePageJsonLd.mainEntity['@type']).toBe('Person')
    expect(profilePageJsonLd.mainEntity.alternateName).toBe('Michal Bodzianowski')
    expect(websiteJsonLd.alternateName).toBe('Michal Bodzianowski')
  })
})
