import { describe, expect, it } from 'vitest'
import { careerYears } from '../about'

describe('careerYears', () => {
  it('counts overlapping roles once and months inclusively', () => {
    // 2020-08..2024-04 and 2024-04..2026 merge to Aug 2020 to Jan 2026 (66 months), plus 3 and 6 months of internships
    const career = [
      { start: '2024-04', end: '2026' },
      { start: '2020-08', end: '2024-04' },
      { start: '2022-08', end: '2023-02' },
      { start: '2019-09', end: '2020-02' },
      { start: '2018-06', end: '2018-08' },
    ]
    expect(careerYears(career)).toBe(6)
  })
  it('runs a role with no end to now', () => {
    expect(careerYears([{ start: '2020-01' }], new Date(Date.UTC(2022, 11, 1)))).toBe(3)
    expect(careerYears([{ start: '2020-01' }], new Date(Date.UTC(2022, 10, 1)))).toBe(2)
  })
})
