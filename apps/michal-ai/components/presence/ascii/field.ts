// Pure pieces of the character-cell hero (HeroAscii.tsx): the glyph choices and the satellite callout text.
import { MU, RE, nameOf, type Identities } from '@/lib/starlink/orbit.mjs'

// The Earth is drawn in braille "mixels": each character cell is a 2 x 4 grid of dots, so the globe has eight samples per cell.
// Sub-dot k = row * 2 + col; BRAILLE_BIT[k] is its bit in the Unicode braille pattern (U+2800 + bits).
export const BRAILLE_BIT = [0x01, 0x08, 0x02, 0x10, 0x04, 0x20, 0x40, 0x80]
// 4 x 4 ordered dither thresholds in (0, 1), indexed [y % 4][x % 4] over the sub-dot grid
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
export function dither(x: number, y: number): number {
  return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16
}
/** Whether a land sub-dot with lambert term d is set: full on the day side, a quarter on the night side so the coast still shows. */
export const landDot = (d: number, t: number) => 0.35 + 0.65 * d > t
/** Ocean sub-dots are a sparse halftone, a little denser at the limb. */
export const seaDot = (d: number, t: number, limb: boolean) => (limb ? 0.28 : 0.04 + 0.1 * d) > t

export const SAT = '.'
export const SAT_FRONT = '*'
export const SAT_LINKED = '+'
export const SAT_MARKED = '@'
export const TERMINAL = 'o'
export const STROKES = '-\\|/'
export const GLYPHS = Array.from(new Set([SAT, SAT_FRONT, SAT_LINKED, SAT_MARKED, TERMINAL, ...STROKES]))

/** A line-art glyph for a stroke going (dx, dy) on screen (y down): - \ | / */
export function strokeGlyph(dx: number, dy: number): string {
  let a = Math.atan2(dy, dx)
  if (a < 0) a += Math.PI
  const e = Math.PI / 8
  if (a < e || a >= 7 * e) return '-'
  if (a < 3 * e) return '\\'
  if (a < 5 * e) return '|'
  return '/'
}

export interface SatFacts {
  name: string | null
  norad: number
  launch: string | null
  altKm: number
  speedKms: number
  incDeg: number
}

/** What the packed elements and the identity trailer say about satellite `i`. Altitude is the mean one above the equatorial radius. */
export function satFacts(data: Float32Array, ids: Identities | null, i: number): SatFacts {
  const inc = data[i * 5]
  const udot = data[i * 5 + 3]
  const a = Math.pow(MU / (udot * udot), 1 / 3)
  const l = ids ? ids.launch[i] : 0
  return {
    name: ids ? nameOf(ids.name[i]) : null,
    norad: ids ? ids.norad[i] : 0,
    launch: l ? `${Math.floor(l / 1000)}-${String(l % 1000).padStart(3, '0')}` : null,
    altKm: a - RE,
    speedKms: Math.sqrt(MU / a),
    incDeg: (inc * 180) / Math.PI,
  }
}

/** Two to three short lines for the callout label. Nothing is shown for a field the data does not have. `compact` drops the
 * words and the inclination so the label fits beside a phone-width hero. */
export function calloutLines(f: SatFacts, compact = false): string[] {
  const out: string[] = []
  // SupGP gives satellites not yet in the public catalogue a provisional number above 99999; that is not a NORAD id
  const norad = f.norad > 0 && f.norad <= 99999 ? f.norad : 0
  const id = compact
    ? [norad ? `#${norad}` : '', f.launch ? (norad ? f.launch : `launch ${f.launch}`) : ''].filter(Boolean).join(' · ')
    : [norad ? `NORAD ${norad}` : '', f.launch ? `launch ${f.launch}` : ''].filter(Boolean).join(' · ')
  out.push(f.name ?? (norad ? `NORAD ${norad}` : 'Starlink'))
  if (id && f.name) out.push(id)
  const motion = `${Math.round(f.altKm)} km · ${f.speedKms.toFixed(2)} km/s`
  out.push(compact ? motion : `${motion} · ${f.incDeg.toFixed(1)}°`)
  return out
}
