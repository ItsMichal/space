// Pure pieces of the character-cell hero (HeroAscii.tsx): the glyph choices and the satellite callout text.
import { MU, RE, nameOf, type Identities } from '@/lib/starlink/orbit.mjs'

/** Land shading, darkest to brightest. Index 0 is the night side, which still shows the coast faintly. */
export const LAND_RAMP = '.:-=+*#%'
export const OCEAN = '·'
export const SAT = '·'
export const SAT_LINKED = '+'
export const SAT_MARKED = '×'
export const TERMINAL = 'o'
export const STROKES = '-\\|/'
export const GLYPHS = Array.from(new Set([...LAND_RAMP, OCEAN, SAT, SAT_LINKED, SAT_MARKED, TERMINAL, ...STROKES]))

/** The ramp glyph for a lambert term in [0, 1]. */
export function landGlyph(d: number): string {
  const k = Math.max(0, Math.min(LAND_RAMP.length - 1, Math.floor(d * LAND_RAMP.length)))
  return LAND_RAMP[k]
}

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
    ? [norad ? `#${norad}` : '', f.launch ?? ''].filter(Boolean).join(' · ')
    : [norad ? `NORAD ${norad}` : '', f.launch ? `launch ${f.launch}` : ''].filter(Boolean).join(' · ')
  out.push(f.name ?? (norad ? `NORAD ${norad}` : 'Starlink'))
  if (id && f.name) out.push(id)
  const motion = `${Math.round(f.altKm)} km · ${f.speedKms.toFixed(2)} km/s`
  out.push(compact ? motion : `${motion} · ${f.incDeg.toFixed(1)}°`)
  return out
}
