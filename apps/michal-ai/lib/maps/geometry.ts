// The baked world of the ::map directive (lib/maps/world.gen.ts, from scripts/build-world-map.mjs), decoded for drawing and
// hit-testing: a country raster in an Equal Earth projection, read back at any point. Used by components/mdx/WorldMap.tsx.

/**
 * The character cell of a map this wide, in CSS px: the character-cell hero's cell shape (components/presence/HeroAscii.tsx, 0.62
 * as wide as tall) at a small type size, 8 to 10 px tall, which the map fills with braille "mixels", a 2 x 4 grid of dots per
 * cell. So a dot every cw / 2 across and ch / 4 down: under 3 px on a wide map, 2.5 on a phone.
 */
export function cellFor(width: number): { cw: number; ch: number } {
  const ch = Math.max(8, Math.min(10, Math.round(width / 90)))
  return { cw: ch * 0.62, ch }
}

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
 * A mixel's radius in CSS px: the hero's braille dot (.4 of the smaller sub-cell edge) on land and at sea, a little fuller on
 * the hovered country (.5) so it reads at a glance.
 */
export function dotRadius(cw: number, ch: number, hovered: boolean): number {
  return Math.min(cw / 2, ch / 4) * (hovered ? 0.5 : 0.4)
}
