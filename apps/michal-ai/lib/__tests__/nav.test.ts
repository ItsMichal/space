import { describe, expect, it } from 'vitest'
import { currentHref } from '../nav'

describe('currentHref (in-app links to renamed pages)', () => {
  it('maps an old slug to the current URL, keeping query and hash', () => {
    expect(currentHref('/projects/frogchamp-ai-chat-stream')).toBe('/projects/frogchamp')
    expect(currentHref('/projects/frogchamp-ai-chat-stream/')).toBe('/projects/frogchamp')
    expect(currentHref('/projects/frogchamp-ai-chat-stream?a=1#x')).toBe('/projects/frogchamp?a=1#x')
  })

  it('leaves current and unknown paths alone', () => {
    expect(currentHref('/projects/frogchamp')).toBe('/projects/frogchamp')
    expect(currentHref('/about#publications')).toBe('/about#publications')
    expect(currentHref('/')).toBe('/')
  })
})
