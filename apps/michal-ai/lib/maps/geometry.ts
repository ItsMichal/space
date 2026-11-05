// The drawing of one ::map: the baked world (lib/maps/world.gen.ts) split into the countries a map lights and the rest.
// The site does this at build time (lib/maps/inline.server.ts) so a post carries only its own map; the editor's preview,
// which skips that step, loads the world and does it in the browser (components/mdx/WorldMap.tsx).
import type { WorldMapData } from '@/content/maps'

export type World = {
  WORLD_W: number
  WORLD_H: number
  WORLD_SHAPES: Record<string, string>
  WORLD_DOTS: Record<string, [number, number]>
}

/** base: every unlit country as one path; lit: [alpha-2, path] per lit country with a shape; dots: [alpha-2, x, y] markers. */
export type MapGeo = {
  w: number
  h: number
  base: string
  lit: [string, string][]
  dots: [string, number, number][]
}

export function mapGeometry(data: WorldMapData, world: World): MapGeo {
  const lit = new Map(data.places.map(([code, iso]) => [iso, code]))
  const base = Object.entries(world.WORLD_SHAPES)
    .flatMap(([iso, d]) => (lit.has(iso) ? [] : [d]))
    .join('')
  return {
    w: world.WORLD_W,
    h: world.WORLD_H,
    base,
    lit: data.places.flatMap(([code, iso]) => (world.WORLD_SHAPES[iso] ? [[code, world.WORLD_SHAPES[iso]] as [string, string]] : [])),
    dots: data.places.flatMap(([code, iso]) => {
      const at = world.WORLD_DOTS[iso]
      return at ? [[code, at[0], at[1]] as [string, number, number]] : []
    }),
  }
}

/** A geo prop as the page received it (a JSON string from the build), or null when it is absent or not the right shape. */
export function parseGeo(raw: unknown): MapGeo | null {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const g = JSON.parse(raw) as MapGeo
    return typeof g.base === 'string' && Array.isArray(g.lit) && Array.isArray(g.dots) && g.w > 0 && g.h > 0 ? g : null
  } catch {
    return null
  }
}
