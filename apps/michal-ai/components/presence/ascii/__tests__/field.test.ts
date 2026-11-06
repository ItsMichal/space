import { describe, expect, it } from 'vitest'
import { balloon, BRAILLE_BIT, calloutLines, dither, greeting, strokeGlyph, WAVE_POSES, waveFade, wavePose, type SatFacts } from '../field'

const facts: SatFacts = { name: 'STARLINK-2343', norad: 47884, launch: '2021-021', altKm: 449.4, speedKms: 7.6412, incDeg: 53.21 }

describe('calloutLines', () => {
  it('shows name, ids and orbit', () => {
    expect(calloutLines(facts)).toEqual(['STARLINK-2343', 'NORAD 47884 · launch 2021-021', '449 km · 7.64 km/s · 53.2°'])
  })
  it('has a compact form for phones', () => {
    expect(calloutLines(facts, true)).toEqual(['STARLINK-2343', '#47884 · 2021-021', '449 km · 7.64 km/s'])
  })
  it('leaves out provisional numbers and missing fields', () => {
    expect(calloutLines({ ...facts, norad: 100313, launch: null })).toEqual(['STARLINK-2343', '449 km · 7.64 km/s · 53.2°'])
    expect(calloutLines({ ...facts, name: null })[0]).toBe('NORAD 47884')
  })
})

describe('glyphs', () => {
  it('covers every braille dot once', () => {
    expect(BRAILLE_BIT.reduce((a, b) => a | b, 0)).toBe(0xff)
    expect(new Set(BRAILLE_BIT).size).toBe(8)
  })
  it('dithers with 16 distinct thresholds in (0, 1)', () => {
    const t = new Set<number>()
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) t.add(dither(x, y))
    expect(t.size).toBe(16)
    expect(Math.min(...t)).toBeGreaterThan(0)
    expect(Math.max(...t)).toBeLessThan(1)
  })
  it('draws strokes by direction', () => {
    expect(strokeGlyph(1, 0)).toBe('-')
    expect(strokeGlyph(0, 1)).toBe('|')
    expect(strokeGlyph(1, 1)).toBe('\\')
    expect(strokeGlyph(1, -1)).toBe('/')
  })
})

describe('the Los Angeles wave', () => {
  it('steps between two poses with the globe, west or east, and holds one under reduced motion', () => {
    expect(wavePose(0, false)).not.toEqual(wavePose(1, false))
    expect(wavePose(0, false)).toEqual(wavePose(2, false))
    expect(wavePose(-1, false)).toEqual(wavePose(1, false))
    expect(wavePose(-240, false)).toEqual(wavePose(0, false))
    expect(wavePose(0, true)).toEqual(wavePose(1, true))
  })
  it('waves the same hand, on his left, every frame', () => {
    for (const p of WAVE_POSES) {
      expect(p[0].slice(0, 2).trim()).not.toBe('')
      expect(p[1][1]).toBe('\\')
      expect(p[0].slice(2)).toBe('o ')
    }
  })
  it('says hello in turn, the Japanese by the time of day', () => {
    expect(new Set([0, 1, 2].map((t) => greeting(t, 12)))).toEqual(new Set(['hello!', 'cześć!', 'konnichiwa!']))
    expect(greeting(3, 8)).toBe(greeting(0, 8))
    expect([0, 1, 2].map((t) => greeting(t, 7))).toContain('ohayou!')
    expect([0, 1, 2].map((t) => greeting(t, 21))).toContain('konbanwa!')
    expect([0, 1, 2].map((t) => greeting(t, 2))).toContain('konbanwa!')
  })
  it('hides near and past the limb', () => {
    expect(waveFade(-0.5)).toBe(0)
    expect(waveFade(0.2)).toBe(0)
    expect(waveFade(0.9)).toBe(1)
  })
})

describe('balloon', () => {
  it('draws one the way cowsay does', () => {
    expect(balloon(['cześć!', 'X · LinkedIn'])).toEqual([' ______________ ', '/ cześć!       \\', '\\ X · LinkedIn /', ' -------------- '])
    expect(balloon(['hi'])).toEqual([' ____ ', '< hi >', ' ---- '])
    expect(balloon(['a', 'bb', 'c'])[2]).toBe('| bb |')
  })
})
