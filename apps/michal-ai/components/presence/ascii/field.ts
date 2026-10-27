// Pure pieces of the character-cell hero (HeroAscii.tsx): the glyph choices and the satellite callout text.
import { MU, RE, nameOf, type Identities } from '@/lib/starlink/orbit.mjs'

/** Land shading, darkest to brightest. Index 0 is the night side, which still shows the coast faintly. */
export const LAND_RAMP = '.:-=+*#%@'
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

/** Two to three short lines for the callout label. Nothing is shown for a field the data does not have. */
export function calloutLines(f: SatFacts): string[] {
  const out: string[] = []
  const id = [f.norad ? `NORAD ${f.norad}` : '', f.launch ? `launch ${f.launch}` : ''].filter(Boolean).join(' · ')
  out.push(f.name ?? (f.norad ? `NORAD ${f.norad}` : 'Starlink'))
  if (id && f.name) out.push(id)
  out.push(`${Math.round(f.altKm)} km · ${f.speedKms.toFixed(2)} km/s · ${f.incDeg.toFixed(1)}°`)
  return out
}
