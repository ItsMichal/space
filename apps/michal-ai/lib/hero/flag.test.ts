import { describe, expect, it } from 'vitest'
import { HERO_DEFAULT, heroFromSearch } from './flag'

describe('hero flag', () => {
  it('reads ?hero= and falls back to the default', () => {
    expect(heroFromSearch('?hero=ascii')).toBe('ascii')
    expect(heroFromSearch('?hero=globe', 'ascii')).toBe('globe')
    expect(heroFromSearch('?hero=nope')).toBe(HERO_DEFAULT)
    expect(heroFromSearch('')).toBe(HERO_DEFAULT)
  })
})
