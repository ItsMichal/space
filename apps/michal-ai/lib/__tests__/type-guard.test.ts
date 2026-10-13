import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { findViolations, isAllowed, parseAllowlist, scanRepo } from '../../../../scripts/type-guard.mjs'

const css = (s: string) => findViolations(s, { ext: '.css' })
const tsx = (s: string) => findViolations(s, { ext: '.tsx' })

describe('type guard: CSS', () => {
  it('flags pixel, rem, em, percent and clamp() font sizes', () => {
    expect(css('a { font-size: 17px; }')).toHaveLength(1)
    expect(css('a { font-size: 1.1rem }')).toHaveLength(1)
    expect(css('a { font-size: 0.8em; }')).toHaveLength(1)
    expect(css('a { font-size: clamp(40px, 11vw, 56px); }')).toHaveLength(1)
    expect(css('a { font-size: calc(var(--type-body-size) * 1.1); }')).toHaveLength(1)
  })
  it('allows the tokens, inherit and print pt sizes', () => {
    expect(css('a { font-size: var(--type-body-size); }')).toEqual([])
    expect(css('a { font-size: var(--type-display-name-size) }')).toEqual([])
    expect(css('a { font-size: inherit; }')).toEqual([])
    expect(css('@media print { a { font-size: 11pt; } }')).toEqual([])
  })
  it('checks the size part of the font shorthand', () => {
    expect(css('a { font: 400 15px/22px var(--font-serif); }')).toHaveLength(1)
    expect(css('a { font: italic 500 clamp(24px, 6vw, 32px) / 1.12 var(--ui-display); }')).toHaveLength(1)
    expect(css('a { font: 400 var(--type-small-size) / var(--type-small-line) var(--font-serif); }')).toEqual([])
    expect(css('a { font: inherit; }')).toEqual([])
    expect(css('a { font: 400 var(--type-body-size) var(--font-serif); }')).toEqual([])
  })
  it('ignores custom property definitions and other properties that contain the words', () => {
    expect(css(':root { --type-body-size: 18px; --font-size-x: 3px; }')).toEqual([])
    expect(css('a { line-height: 22px; font-weight: 500; font-family: var(--font-serif); }')).toEqual([])
  })
  it('reports the line number', () => {
    expect(css('a {\n  color: red;\n  font-size: 13px;\n}')[0].line).toBe(3)
  })
})

describe('type guard: TSX', () => {
  it('flags Tailwind arbitrary sizes', () => {
    expect(tsx('<p className="text-[15px] text-ink">')).toHaveLength(1)
    expect(tsx('<h1 className="font-display text-[clamp(46px,13vw,60px)] md:text-[48px]">')).toHaveLength(2)
    expect(tsx('<p className="text-[1.2rem]">')).toHaveLength(1)
  })
  it('flags the named Tailwind size utilities at any breakpoint', () => {
    expect(tsx('<p className="text-sm">')).toHaveLength(1)
    expect(tsx('<p className="md:text-xl lg:hover:text-2xl">')).toHaveLength(2)
    expect(tsx('<p className="text-base">')).toHaveLength(1)
  })
  it('allows the scale utilities, colours and alignment', () => {
    expect(tsx('<p className="text-body text-ink-muted text-center text-small">')).toEqual([])
    expect(tsx('<h2 className="text-title md:text-heading text-display-name">')).toEqual([])
    expect(tsx('<p className="text-[var(--ink)] text-[#333]">')).toEqual([])
    expect(tsx('<p className="context-text-lg-not">')).toEqual([])
  })
  it('flags inline style sizes and font shorthands, and style text inside template strings', () => {
    expect(tsx('<p style={{ fontSize: 18 }}>')).toHaveLength(1)
    expect(tsx("<p style={{ font: '400 21px/1.5 var(--font-serif)' }}>")).toHaveLength(1)
    expect(tsx('const css = `.a{font-size:24px}`')).toHaveLength(1)
    expect(tsx("<p style={{ fontSize: 'var(--type-body-size)' }}>")).toHaveLength(1) // use the class instead of a style object
  })
})

describe('allowlist', () => {
  const allow = parseAllowlist('# comment\n\napps/x/dev/\napps/x/og.tsx\napps/x/a.css :: font-size: 9px\n')
  it('exempts a directory prefix, a file, and a file+line text, and nothing else', () => {
    expect(isAllowed('apps/x/dev/page.tsx', 'font-size: 3px', allow)).toBe(true)
    expect(isAllowed('apps/x/og.tsx', 'x', allow)).toBe(true)
    expect(isAllowed('apps/x/a.css', '  font-size: 9px;', allow)).toBe(true)
    expect(isAllowed('apps/x/a.css', '  font-size: 10px;', allow)).toBe(false)
    expect(isAllowed('apps/x/other.css', 'font-size: 9px', allow)).toBe(false)
    expect(isAllowed('apps/xy/og.tsx', 'x', allow)).toBe(false)
  })
})

describe('the app', () => {
  it('declares no font size outside the scale', () => {
    expect(scanRepo(path.resolve(__dirname, '../../../..'))).toEqual([])
  })
})
