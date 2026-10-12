// Location privacy helpers. Coordinates are snapped to a coarse grid and jittered deterministically inside the cell,
// so nothing finer than city level ever leaves the server and pins from one city do not stack.
import { LIVE_LIMITS } from './constants'

export interface Place {
  lat: number
  lon: number
  city: string
  region: string
  country: string
}

/** FNV-1a 32-bit. Not cryptographic; only used to spread pins. */
export function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  // murmur3 finaliser: FNV alone leaves similar keys clustered in the high bits.
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Snap to the grid. Latitude is clamped to +-85 so the jitter cannot cross a pole. */
export function snap(lat: number, lon: number, grid: number = LIVE_LIMITS.gridDeg): { lat: number; lon: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  const la = Math.max(-85, Math.min(85, Math.round(lat / grid) * grid))
  let lo = Math.round(lon / grid) * grid
  if (lo > 180) lo -= 360
  return { lat: round2(la) + 0, lon: round2(lo) + 0 }
}

/** Deterministic jitter in [-j, j] per axis, derived from an opaque key (never from the true position). */
export function jitter(key: string, j: number = LIVE_LIMITS.jitterDeg): { dlat: number; dlon: number } {
  const a = hash32('a' + key) / 0xffffffff
  const b = hash32('b' + key) / 0xffffffff
  return { dlat: (a * 2 - 1) * j, dlon: (b * 2 - 1) * j }
}

/** Snap and jitter in one step. */
export function publicPoint(lat: number, lon: number, key: string): { lat: number; lon: number } | null {
  const s = snap(lat, lon)
  if (!s) return null
  const { dlat, dlon } = jitter(key)
  return { lat: round2(Math.max(-85, Math.min(85, s.lat + dlat))), lon: round2(s.lon + dlon) }
}

/** Keep letters, marks, digits, space and a few punctuation marks; cap the length. */
export function cleanLabel(v: unknown, max = 48): string {
  if (typeof v !== 'string') return ''
  const s = v
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N} '.\-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  return s.slice(0, max)
}

/** Build a Place from Cloudflare's `request.cf`. Returns null when there is no usable position. */
export function placeFromCf(cf: Record<string, unknown> | undefined | null): Place | null {
  if (!cf) return null
  const s = snap(Number(cf.latitude), Number(cf.longitude))
  if (!s) return null
  const country = typeof cf.country === 'string' && /^[A-Z]{2}$/.test(cf.country) ? cf.country : ''
  return { lat: s.lat, lon: s.lon, city: cleanLabel(cf.city), region: cleanLabel(cf.region), country }
}

/** Unit vector for lat/lon degrees: x right, y up, z towards the viewer at lon=0, lat=0. */
export function toVec(lat: number, lon: number): [number, number, number] {
  const la = (lat * Math.PI) / 180
  const lo = (lon * Math.PI) / 180
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]
}
