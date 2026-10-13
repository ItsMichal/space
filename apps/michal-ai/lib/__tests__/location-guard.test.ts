import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { findForbidden, scanRepo } from '../../../../scripts/location-guard.mjs'

describe('location guard', () => {
  it('flags the city name in any case and the coordinates, and nothing generic', () => {
    expect(findForbidden(['Haw', 'thorne, CA'].join(''))).toHaveLength(1)
    expect(findForbidden(['HAW', 'THORNE'].join(''))).toHaveLength(1)
    expect(findForbidden('lat: ' + ['33.91', '64'].join(''))).toHaveLength(1)
    expect(findForbidden('Denver, Seattle, Los Angeles, California')).toEqual([])
  })
  it('the repo is clean', () => {
    expect(scanRepo(path.resolve(__dirname, '../../../..'))).toEqual([])
  })
})
