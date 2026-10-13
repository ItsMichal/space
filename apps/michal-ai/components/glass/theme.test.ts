import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrast, decideTone, over, parseColor, toneColors, toneContrast, type GlassTokens, type Rgba, type Tone } from './theme'

// The real token values, read from the stylesheets that ship, so a token edit that breaks contrast fails here.
const root = path.resolve(__dirname, '../..')
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8')
const glassCss = read('components/glass/glass.css')
const tokensCss = read('app/styles/tokens.css')
const craftCss = read('app/styles/craft.css')

function decl(css: string, name: string, from = 0): string {
  const m = css.slice(from).match(new RegExp(`${name}:\\s*([^;]+);`))
  if (!m) throw new Error(`token ${name} not found`)
  return m[1].trim()
}
const darkBlock = (css: string) => css.indexOf(':root[data-reading]')

const tokens: GlassTokens = {
  tintLight: parseColor(decl(glassCss, '--glass-tint-light')),
  tintDark: parseColor(decl(glassCss, '--glass-tint-dark')),
  fgOnLight: parseColor(decl(glassCss, '--glass-fg-on-light')),
  fgOnDark: parseColor(decl(glassCss, '--glass-fg-on-dark')),
}
const ink: Record<Tone, Rgba> = {
  light: parseColor(decl(tokensCss, '--ink')),
  dark: parseColor(decl(tokensCss, '--ink', darkBlock(tokensCss))),
}
const sheetTint: Record<Tone, Rgba> = {
  light: parseColor(decl(craftCss, '--nav-sheet-tint')),
  dark: parseColor(decl(craftCss, '--nav-sheet-tint', darkBlock(craftCss))),
}

type RGB = [number, number, number]
// Worst cases: pure black / white, a grey ramp, and the saturated primaries (an image can be anything).
const backdrops: RGB[] = [
  ...Array.from({ length: 21 }, (_, i): RGB => [i / 20, i / 20, i / 20]),
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 1, 0],
  [0, 1, 1],
  [1, 0, 1],
]
const AA = 4.5

describe('glass tone: tint and foreground are one pair', () => {
  it('has text >= 4.5:1 on the bar for both tones over every worst-case backdrop', () => {
    for (const tone of ['light', 'dark'] as Tone[]) {
      for (const b of backdrops) expect(toneContrast(tone, tokens, b), `${tone} over ${b}`).toBeGreaterThanOrEqual(AA)
    }
  })

  it('light tone is unchanged from main: paper at 64%, ink text', () => {
    expect(tokens.tintLight).toEqual(parseColor('rgba(251, 249, 243, 0.64)'))
    expect(tokens.fgOnLight).toEqual(parseColor('#18211b'))
  })

  it('dark tone is dark translucent glass with a pale foreground', () => {
    const [r, g, b, a] = tokens.tintDark
    expect(Math.max(r, g, b)).toBeLessThan(0.15)
    expect(a).toBeGreaterThanOrEqual(0.75)
    expect(a).toBeLessThan(1)
    expect(Math.min(...tokens.fgOnDark.slice(0, 3))).toBeGreaterThan(0.8)
  })

  it('the foreground of each tone is the page ink of the matching page theme', () => {
    expect(tokens.fgOnLight).toEqual(ink.light)
    expect(tokens.fgOnDark).toEqual(ink.dark)
  })

  it('the open phone sheet tint keeps page ink readable over worst-case backdrops', () => {
    for (const theme of ['light', 'dark'] as Tone[]) {
      for (const b of backdrops) {
        const bar = over(sheetTint[theme], b)
        const f = ink[theme]
        expect(contrast([f[0], f[1], f[2]], bar), `${theme} sheet over ${b}`).toBeGreaterThanOrEqual(AA)
      }
    }
  })
})

describe('decideTone', () => {
  const pageThemes: Tone[] = ['light', 'dark']
  const lums = [null, 0, 0.05, 0.2, 0.36, 0.42, 0.5, 0.8, 1]
  const appearances = ['auto', 'light', 'dark'] as const

  it('every decision yields a pair with text >= 4.5:1 over every worst-case backdrop', () => {
    for (const pageTheme of pageThemes)
      for (const backdropLum of lums)
        for (const appearance of appearances)
          for (const adaptiveText of [false, true])
            for (const prev of pageThemes) {
              const tone = decideTone({ pageTheme, backdropLum, appearance, adaptiveText, prev })
              for (const b of backdrops) {
                expect(toneContrast(tone, tokens, b), `${pageTheme}/${backdropLum}/${appearance}/${adaptiveText}/${prev} over ${b}`).toBeGreaterThanOrEqual(AA)
              }
            }
  })

  it('glass whose text is the page ink follows the page theme, whatever is behind it', () => {
    for (const pageTheme of pageThemes)
      for (const backdropLum of lums)
        for (const prev of pageThemes) {
          const tone = decideTone({ pageTheme, backdropLum, appearance: 'auto', adaptiveText: false, prev })
          expect(tone).toBe(pageTheme)
          // and the foreground it pairs with is the ink the page is actually using
          expect(toneColors(tone, tokens).fg).toEqual(ink[pageTheme])
        }
  })

  it('adaptive glass flips tint and foreground together with the backdrop', () => {
    const dark = decideTone({ pageTheme: 'light', backdropLum: 0.05, appearance: 'auto', adaptiveText: true, prev: 'light' })
    const light = decideTone({ pageTheme: 'dark', backdropLum: 0.9, appearance: 'auto', adaptiveText: true, prev: 'dark' })
    expect(dark).toBe('dark')
    expect(toneColors(dark, tokens)).toEqual({ tint: tokens.tintDark, fg: tokens.fgOnDark })
    expect(light).toBe('light')
    expect(toneColors(light, tokens)).toEqual({ tint: tokens.tintLight, fg: tokens.fgOnLight })
  })

  it('adaptive glass has hysteresis: no flip inside the dead band', () => {
    const at = (lum: number, prev: Tone) => decideTone({ pageTheme: 'light', backdropLum: lum, appearance: 'auto', adaptiveText: true, prev })
    expect(at(0.42, 'light')).toBe('light')
    expect(at(0.42, 'dark')).toBe('dark')
    expect(at(0.3, 'light')).toBe('dark')
    expect(at(0.6, 'dark')).toBe('light')
  })

  it('adaptive glass with an unmeasurable backdrop falls back to the page theme', () => {
    for (const pageTheme of pageThemes) {
      expect(decideTone({ pageTheme, backdropLum: null, appearance: 'auto', adaptiveText: true, prev: pageTheme })).toBe(pageTheme)
    }
  })

  it('explicit appearance wins', () => {
    expect(decideTone({ pageTheme: 'dark', backdropLum: 0, appearance: 'light', adaptiveText: true, prev: 'dark' })).toBe('light')
    expect(decideTone({ pageTheme: 'light', backdropLum: 1, appearance: 'dark', adaptiveText: false, prev: 'light' })).toBe('dark')
  })
})
