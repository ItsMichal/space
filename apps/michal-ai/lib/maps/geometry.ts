// The baked world of the ::map directive (lib/maps/world.gen.ts, from scripts/build-world-map.mjs), decoded for drawing and
// hit-testing: a country raster in an Equal Earth projection, read back at any point. Used by components/mdx/WorldMap.tsx.

/**
 * Dot pitch in CSS px for a map this wide: the hero globe's 6 px grid (components/presence/globe/renderer.ts) on a wide map,
 * tightening on a phone (down to 3.5 px) so the map keeps about 110 columns and small countries still catch dots.
 */
export const pitchFor = (width: number) => Math.min(6, Math.max(3.5, width / 110))

export type WorldModule = {
  WORLD_W: number
  WORLD_H: number
  WORLD_IDS: string[]
  WORLD_NAMES: Record<string, string>
  WORLD_ROWS: number[][]
  WORLD_POINTS: Record<string, [number, number]>
}

export type World = {
  w: number
  h: number
  /** palette: 0 off the map, 1 sea, then ISO 3166-1 numeric codes (XK for Kosovo) */
  ids: string[]
  names: Record<string, string>
  points: Record<string, [number, number]>
  /** the palette index at a raster point (fractional pixels; outside the raster is off the map) */
  at(x: number, y: number): number
  /** the palette index of a code, or -1 for a country the raster has no pixel of */
  index(iso: string): number
}

export function decodeWorld(m: WorldModule): World {
  const w = m.WORLD_W
  const h = m.WORLD_H
  const grid = new Uint16Array(w * h)
  m.WORLD_ROWS.forEach((runs, y) => {
    let x = 0
    for (let i = 0; i < runs.length; i += 2) {
      grid.fill(runs[i], y * w + x, y * w + x + runs[i + 1])
      x += runs[i + 1]
    }
  })
  const byIso = new Map(m.WORLD_IDS.map((iso, i) => [iso, i]))
  return {
    w,
    h,
    ids: m.WORLD_IDS,
    names: m.WORLD_NAMES,
    points: m.WORLD_POINTS,
    at(x, y) {
      const px = Math.floor(x)
      const py = Math.floor(y)
      return px < 0 || py < 0 || px >= w || py >= h ? 0 : grid[py * w + px]
    },
    index: (iso) => (iso === '' || iso === 'sea' ? -1 : (byIso.get(iso) ?? -1)),
  }
}

/**
 * A dot's radius in CSS px, in the globe's proportions: a speck at sea (.06 of the pitch), land at .30, a lit country a little
 * fuller (.34), the hovered country swollen (.46) so it reads at a glance.
 */
export function dotRadius(pitch: number, v: number, lit: boolean, hovered: boolean): number {
  if (v === 1) return pitch * 0.06
  if (hovered) return pitch * 0.46
  return pitch * (lit ? 0.34 : 0.3)
}
