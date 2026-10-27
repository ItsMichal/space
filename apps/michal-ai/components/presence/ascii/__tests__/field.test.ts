import { describe, expect, it } from 'vitest'
import { calloutLines, landGlyph, LAND_RAMP, strokeGlyph, type SatFacts } from '../field'

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
  it('maps the lambert term onto the ramp', () => {
    expect(landGlyph(0)).toBe(LAND_RAMP[0])
    expect(landGlyph(1)).toBe(LAND_RAMP[LAND_RAMP.length - 1])
  })
  it('draws strokes by direction', () => {
    expect(strokeGlyph(1, 0)).toBe('-')
    expect(strokeGlyph(0, 1)).toBe('|')
    expect(strokeGlyph(1, 1)).toBe('\\')
    expect(strokeGlyph(1, -1)).toBe('/')
  })
})
