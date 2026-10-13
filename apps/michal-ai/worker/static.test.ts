import { describe, expect, it } from 'vitest'
import { buildRedirects } from '../lib/redirects.mjs'
import { REDIRECTS } from './redirects.generated'
import { contentTypeFor, isDataRequest, redirectFor, shareCardAsset } from './static'

describe('legacy redirects', () => {
  it('the committed worker table matches content/redirects.json (run npm run build:redirects if this fails)', () => {
    const expected = Object.fromEntries(buildRedirects().map((r: { source: string; destination: string }) => [r.source, r.destination]))
    expect(REDIRECTS).toEqual(expected)
  })

  it('redirects an old path to its current one and keeps the query', () => {
    expect(redirectFor('/projects/frogchamp-ai-chat-stream', '?a=1')).toBe('/projects/frogchamp?a=1')
    expect(redirectFor('/projects/frogchamp-ai-chat-stream/opengraph-image', '')).toBe('/projects/frogchamp/opengraph-image')
  })

  it('drops a trailing slash first (308 to the slash-less path)', () => {
    expect(redirectFor('/about/', '')).toBe('/about')
    expect(redirectFor('/projects/frogchamp-ai-chat-stream/', '?x')).toBe('/projects/frogchamp?x')
    expect(redirectFor('/about', '')).toBeNull()
    expect(redirectFor('/', '')).toBeNull()
  })

  it('every destination is itself not a redirect source (one hop)', () => {
    for (const to of Object.values(REDIRECTS)) expect(REDIRECTS[to]).toBeUndefined()
  })
})

describe('share cards and content types', () => {
  it('maps the extensionless card URLs to the stored PNGs', () => {
    expect(shareCardAsset('/opengraph-image')).toBe('/_og/opengraph-image.png')
    expect(shareCardAsset('/writing/x/twitter-image')).toBe('/_og/writing/x/twitter-image.png')
    expect(shareCardAsset('/writing/x')).toBeNull()
  })

  it('keeps the content types the previous build sent', () => {
    expect(contentTypeFor('/feed.xml')).toContain('application/rss+xml')
    expect(contentTypeFor('/projects/starlink/feed.xml')).toContain('application/rss+xml')
    expect(contentTypeFor('/feed.json')).toContain('application/feed+json')
    expect(contentTypeFor('/manifest.webmanifest')).toBe('application/manifest+json')
    expect(contentTypeFor('/about')).toBeUndefined()
    expect(contentTypeFor('/writing.data')).toContain('text/x-script')
    expect(isDataRequest('/_root.data')).toBe(true)
  })
})
