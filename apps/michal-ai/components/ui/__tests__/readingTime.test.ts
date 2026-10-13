import { describe, expect, it } from 'vitest'
import { countWords, leftLabel, readLine, secondsLeft, type ReadBlock } from '../readingTime'

// 440 words = 2 minutes at 220 wpm, in four 110-word blocks stacked 100px apart.
const blocks: ReadBlock[] = [0, 1, 2, 3].map((i) => ({ top: i * 100, height: 100, words: 110, images: 0 }))

describe('secondsLeft', () => {
  it('is the whole article above the first block, nothing below the last', () => {
    expect(secondsLeft(blocks, -50)).toBeCloseTo(120)
    expect(secondsLeft(blocks, 400)).toBe(0)
  })
  it('counts the part of the block the line is in', () => {
    expect(secondsLeft(blocks, 150)).toBeCloseTo(75)
  })
  it('adds an allowance per image', () => {
    const withImg: ReadBlock[] = [...blocks, { top: 400, height: 200, words: 0, images: 2 }]
    expect(secondsLeft(withImg, -1)).toBeCloseTo(120 + 24)
  })
  it('scales to the header figure so both agree at 0%', () => {
    expect(secondsLeft(blocks, -1, { anchorMinutes: 3 })).toBeCloseTo(180)
    expect(leftLabel(secondsLeft(blocks, -1, { anchorMinutes: 3 }))).toBe('3 min left')
  })
  it('is zero for an empty article', () => {
    expect(secondsLeft([], 10, { anchorMinutes: 4 })).toBe(0)
  })
})

describe('leftLabel', () => {
  it('rounds to minutes and steps down through the small states', () => {
    expect(leftLabel(480)).toBe('8 min left')
    expect(leftLabel(95)).toBe('2 min left')
    expect(leftLabel(60)).toBe('1 min left')
    expect(leftLabel(45)).toBe('1 min left')
    expect(leftLabel(44)).toBe('under a minute')
    expect(leftLabel(6)).toBe('under a minute')
    expect(leftLabel(5)).toBe('done')
    expect(leftLabel(0)).toBe('done')
  })
})

describe('readLine', () => {
  it('sweeps from near the top of the viewport to its bottom edge', () => {
    expect(readLine(1000, 800, 0)).toBeCloseTo(1120)
    expect(readLine(1000, 800, 1)).toBe(1800)
  })
})

describe('countWords', () => {
  it('splits on whitespace', () => {
    expect(countWords('  one two\nthree  ')).toBe(3)
    expect(countWords('')).toBe(0)
  })
})
