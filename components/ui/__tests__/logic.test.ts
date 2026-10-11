import { describe, expect, it } from 'vitest'
import { rollDigits } from '../number'
import { availableFilters, matchesFilter, nearestSegment } from '../segments'
import { formatDate, yearMarks, type TimelineItem } from '../timelineData'
import { readingProgress, sectionAt, publishStatus, getStatus } from '../status'
import { starlinkLaunches } from '@/content/starlink-launches'

describe('number roll', () => {
  it('ends every column on its true digit and keeps punctuation', () => {
    const cols = rollDigits('1,270')
    const digits = cols.filter((c) => c.kind === 'digit')
    expect(digits.map((c) => (c.kind === 'digit' ? c.strip[c.strip.length - 1] : -1))).toEqual([1, 2, 7, 0])
    expect(cols.some((c) => c.kind === 'char' && c.ch === ',')).toBe(true)
  })
  it('staggers from the left', () => {
    const [a, b] = rollDigits('70').filter((c) => c.kind === 'digit')
    expect(a.kind === 'digit' && b.kind === 'digit' && b.delay > a.delay).toBe(true)
  })
})

describe('segments + filters', () => {
  it('finds the nearest segment', () => {
    const segs = [
      { left: 0, width: 50 },
      { left: 50, width: 80 },
      { left: 130, width: 60 },
    ]
    expect(nearestSegment(segs, 10)).toBe(0)
    expect(nearestSegment(segs, 100)).toBe(1)
    expect(nearestSegment(segs, 500)).toBe(2)
  })
  it('maps tags onto filters, case-insensitively', () => {
    expect(matchesFilter(['Unity', 'Game Dev'], 'games')).toBe(true)
    expect(matchesFilter(['TypeScript', 'AI/ML'], 'ai')).toBe(true)
    expect(matchesFilter(['TypeScript'], 'web')).toBe(false)
    expect(matchesFilter([], 'all')).toBe(true)
  })
  it('only offers filters that have posts', () => {
    expect(availableFilters([['Web'], ['Web']]).map((f) => f.value)).toEqual(['all', 'web'])
  })
})

describe('timeline data', () => {
  const items: TimelineItem[] = [
    { id: 'a', date: '2020', title: 'A' },
    { id: 'b', date: '2020-05-01', title: 'B' },
    { id: 'c', title: 'C' },
    { id: 'd', date: '2022-01', title: 'D' },
  ]
  it('marks the first item of each year and skips undated ones', () => {
    expect(yearMarks(items)).toEqual([
      { index: 0, year: '2020' },
      { index: 3, year: '2022' },
    ])
  })
  it('formats by precision', () => {
    expect(formatDate('2024-04-15', true)).toBe('15 Apr 2024')
    expect(formatDate('2024-04-15')).toBe('Apr 2024')
    expect(formatDate('2024-08')).toBe('Aug 2024')
    expect(formatDate('2024')).toBe('2024')
  })
  it('only ships dated, sourced launches after the join date, oldest first', () => {
    expect(starlinkLaunches.length).toBeGreaterThan(10)
    let prev = ''
    for (const l of starlinkLaunches) {
      expect(l.source?.href).toMatch(/^https:\/\//)
      expect(l.date! >= '2024-04-15').toBe(true)
      expect(l.date! >= prev).toBe(true)
      prev = l.date!
    }
  })
})

describe('status + reading', () => {
  it('picks the section by scroll position', () => {
    expect(sectionAt([100, 400, 900], 50)).toBe(-1)
    expect(sectionAt([100, 400, 900], 450)).toBe(1)
    expect(sectionAt([100, 400, 900], 5000)).toBe(2)
  })
  it('measures progress between start and the point the end reaches the viewport bottom', () => {
    expect(readingProgress(0, 100, 2100, 800)).toBe(0)
    expect(readingProgress(700, 100, 2100, 800)).toBeCloseTo(0.5)
    expect(readingProgress(9999, 100, 2100, 800)).toBe(1)
    expect(readingProgress(300, 100, 500, 800)).toBe(1) // short article: done once started
  })
  it('lets the highest priority speak and clears cleanly', () => {
    publishStatus('a', { priority: 1, title: 'A' })
    publishStatus('b', { priority: 5, title: 'B' })
    expect(getStatus()?.title).toBe('B')
    publishStatus('b', null)
    expect(getStatus()?.title).toBe('A')
    publishStatus('a', null)
    expect(getStatus()).toBeNull()
  })
})
