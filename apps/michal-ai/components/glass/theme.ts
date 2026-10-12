/*
 * One decision for the glass colour scheme. The tint of the bar and the foreground drawn on it are always picked together
 * from the same tone, so text can never end up light-on-light or dark-on-dark.
 *
 *   tone 'light'  tint --glass-tint-light (paper, 64%)   fg --glass-fg-on-light (ink)
 *   tone 'dark'   tint --glass-tint-dark  (basalt, 80%)  fg --glass-fg-on-dark  (pale)
 *
 * Who chooses the tone:
 *   - explicit appearance 'light' / 'dark': that tone.
 *   - appearance 'auto' on glass whose glyphs flip with it (adaptiveText): the luminance of what is behind the glass, with
 *     hysteresis so it does not flicker over mixed content. Tint and glyphs flip together, cross-faded.
 *   - appearance 'auto' on glass whose glyphs do NOT flip (the nav, buttons: their text is the page ink): the page theme.
 *     The page theme is the same signal that flips --ink (computed --paper luminance), so tint and ink cannot disagree.
 *
 * Pure functions, no DOM, so the contrast guarantee is unit tested against the real token values.
 */

import { flipTone, luminance } from './geometry'

export type Tone = 'light' | 'dark'
export type Appearance = 'auto' | 'light' | 'dark'
export type Rgba = [number, number, number, number]

export type ToneInput = {
  appearance: Appearance
  /** True when the glyphs on this glass flip with the tone (data-glass-adaptive-text). */
  adaptiveText: boolean
  pageTheme: Tone
  /** Luminance (0..1) of what is behind the glass, null when unknown (image, video, nothing opaque found). */
  backdropLum: number | null
  prev: Tone
}

/** Fallback luminance of a page of the given theme, used when the backdrop cannot be measured. */
export const PAGE_LUM: Record<Tone, number> = { light: 0.9, dark: 0.02 }

export function decideTone(i: ToneInput): Tone {
  if (i.appearance === 'light' || i.appearance === 'dark') return i.appearance
  if (!i.adaptiveText) return i.pageTheme
  const lum = i.backdropLum ?? PAGE_LUM[i.pageTheme]
  return flipTone(lum, i.prev === 'dark') ? 'dark' : 'light'
}

export type GlassTokens = {
  tintLight: Rgba
  tintDark: Rgba
  fgOnLight: Rgba
  fgOnDark: Rgba
}

/** The tint and foreground that belong to a tone. Always read as a pair. */
export function toneColors(tone: Tone, t: GlassTokens): { tint: Rgba; fg: Rgba } {
  return tone === 'dark' ? { tint: t.tintDark, fg: t.fgOnDark } : { tint: t.tintLight, fg: t.fgOnLight }
}

// ---------------------------------------------------------------- colour maths

/** Parses #rgb, #rrggbb, rgb(), rgba() (comma or space syntax). Channels 0..1. */
export function parseColor(css: string): Rgba {
  const s = css.trim()
  if (s.startsWith('#')) {
    let h = s.slice(1)
    if (h.length === 3) h = [...h].map((c) => c + c).join('')
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255, 1]
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/)
  if (!m) throw new Error(`unparseable colour: ${css}`)
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
  return [+m[1] / 255, +m[2] / 255, +m[3] / 255, a]
}

/** `top` composited over an opaque `bottom`. */
export function over(top: Rgba, bottom: [number, number, number]): [number, number, number] {
  const a = top[3]
  return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a)]
}

export function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a[0], a[1], a[2])
  const lb = luminance(b[0], b[1], b[2])
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Contrast of the tone's foreground against its tint composited over an opaque backdrop colour. */
export function toneContrast(tone: Tone, t: GlassTokens, backdrop: [number, number, number]): number {
  const { tint, fg } = toneColors(tone, t)
  const bar = over(tint, backdrop)
  return contrast([fg[0], fg[1], fg[2]], bar)
}
