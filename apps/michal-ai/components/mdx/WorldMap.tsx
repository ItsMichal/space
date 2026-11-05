import { useEffect, useState } from 'react'
import { mapById } from '@/content/maps'
import { mapGeometry, parseGeo, type MapGeo } from '@/lib/maps/geometry'
import './world-map.css'

/**
 * ::map{id=...}: a world map (Natural Earth shapes, Equal Earth projection) with the countries of one entry of content/maps.ts
 * lit in the accent colour, a marker on the ones too small to see, and the full list under it. The build passes the drawing in
 * as `geo` (lib/maps/inline.server.ts); without it (the editor's preview) the world loads here. Nothing moves, so there is no
 * motion to reduce. An unknown id renders nothing.
 */
export function WorldMap({ id, geo }: { id: string; geo?: string }) {
  const data = mapById(id)
  const inlined = parseGeo(geo)
  const [loaded, setLoaded] = useState<MapGeo | null>(null)
  useEffect(() => {
    if (inlined || !data) return
    let live = true
    import('@/lib/maps/world.gen').then((world) => live && setLoaded(mapGeometry(data, world)))
    return () => {
      live = false
    }
  }, [inlined, data])
  if (!data) return null
  const g = inlined ?? loaded
  const names = new Map(data.places.map(([code, , name]) => [code, name]))
  const sorted = [...data.places].sort((a, b) => a[2].localeCompare(b[2], 'en'))
  const count = data.places.length
  const headingId = `wmap-${id}`
  return (
    <figure className="wmap" aria-labelledby={headingId}>
      <div className="wmap__head">
        <h3 id={headingId} className="wmap__title t-ui">
          {data.title}
        </h3>
        <p className="wmap__lede t-meta">{data.lede}</p>
      </div>
      <div className="wmap__frame">
        {g ? (
          <svg className="wmap__svg" viewBox={`0 0 ${g.w} ${g.h}`} role="img" aria-label={`World map with ${count} places lit: ${sorted.map((p) => p[2]).join(', ')}.`}>
            <path className="wmap__land" d={g.base} />
            {g.lit.map(([code, d]) => (
              <path key={code} className="wmap__lit" d={d}>
                <title>{names.get(code)}</title>
              </path>
            ))}
            {g.dots.map(([code, x, y]) => (
              <circle key={code} className="wmap__dot" cx={x} cy={y} r={5}>
                <title>{names.get(code)}</title>
              </circle>
            ))}
          </svg>
        ) : null}
      </div>
      <figcaption className="wmap__foot t-meta">
        <span className="wmap__legend">
          <span className="wmap__swatch" aria-hidden />
          {data.legend}: {count} places
        </span>
        <details className="wmap__list">
          <summary>See all {count}</summary>
          <ul>
            {sorted.map(([code, , name]) => (
              <li key={code}>{name}</li>
            ))}
          </ul>
        </details>
        <span className="wmap__src">
          Source:{' '}
          {data.sources.map((s, i) => (
            <span key={s.url}>
              {i ? ', ' : null}
              <a href={s.url} className="link" target="_blank" rel="noopener noreferrer">
                {s.label}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </span>
          ))}
          {' '}(Wayback Machine). Map: Natural Earth.
        </span>
      </figcaption>
    </figure>
  )
}
