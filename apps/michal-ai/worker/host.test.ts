import { describe, expect, it } from 'vitest'
import { canonicalRedirect, isPreviewHost } from './host'

describe('host redirects', () => {
  it('sends the old and www hosts to michal.ai, keeping path and query', () => {
    expect(canonicalRedirect('https://michal.us/projects/x?a=1')).toBe('https://michal.ai/projects/x?a=1')
    expect(canonicalRedirect('https://www.michal.us/')).toBe('https://michal.ai/')
    expect(canonicalRedirect('https://www.michal.ai/writing')).toBe('https://michal.ai/writing')
    expect(canonicalRedirect('https://MICHAL.US/feed.xml')).toBe('https://michal.ai/feed.xml')
  })
  it('leaves the canonical host, previews and localhost alone', () => {
    expect(canonicalRedirect('https://michal.ai/')).toBeNull()
    expect(canonicalRedirect('https://space.michalai.workers.dev/')).toBeNull()
    expect(canonicalRedirect('http://localhost:8797/projects')).toBeNull()
  })
  it('recognises preview hosts', () => {
    expect(isPreviewHost('space.michalai.workers.dev')).toBe(true)
    expect(isPreviewHost('michal.ai')).toBe(false)
  })
})
