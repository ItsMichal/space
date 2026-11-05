import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mapById } from '@/content/maps'
import { decodeWorld, dotRadius, pitchFor, type World } from '@/lib/maps/geometry'
import './world-map.css'

/**
 * ::map{id=...}: a world map in the hero globe's language (components/presence/globe/renderer.ts): a fixed grid of round dots
 * in the ink colour wherever there is land (tighter on a phone, see pitchFor), a speck at sea, and the countries of one entry of content/maps.ts in the accent.
 * Hovering (or tapping) a country names it and swells its dots; hovering a row of the list below does the same. A place too
 * small to catch a dot gets a ring at its location. The world (Natural Earth, lib/maps/world.gen.ts) loads after the page, so
 * the frame keeps its shape until it arrives. Nothing animates. An unknown id renders nothing.
 */
export function WorldMap({ id }: { id: string }) {
  const data = mapById(id)
  const frame = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [world, setWorld] = useState<World | null>(null)
  const [size, setSize] = useState<{ w: number; dpr: number; dark: boolean } | null>(null)
  // the hovered country (ISO numeric) and where its label sits, in CSS px of the frame
  const [hover, setHover] = useState<{ iso: string; x: number; y: number } | null>(null)

  useEffect(() => {
    let live = true
    import('@/lib/maps/world.gen').then((w) => live && setWorld(decodeWorld(w)))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    const el = frame.current
    if (!el) return
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    const measure = () => setSize({ w: el.clientWidth, dpr: Math.min(2, window.devicePixelRatio || 1), dark: dark.matches })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    dark.addEventListener('change', measure)
    return () => {
      ro.disconnect()
      dark.removeEventListener('change', measure)
    }
  }, [])

  const lit = useMemo(() => new Map((data?.places ?? []).map(([code, iso, name]) => [iso, { code, name }])), [data])

  // which grid cells belong to which country at this width, and the lit places too small to own one (they get a ring)
  const layout = useMemo(() => {
    if (!world || !size || !size.w) return null
    const w = size.w
    const h = Math.round((w * world.h) / world.w)
    const pitch = pitchFor(w)
    const cells: { x: number; y: number; v: number }[] = []
    const owned = new Set<number>()
    for (let y = pitch / 2; y < h; y += pitch)
      for (let x = pitch / 2; x < w; x += pitch) {
        const v = world.at((x / w) * world.w, (y / h) * world.h)
        if (!v) continue
        cells.push({ x, y, v })
        owned.add(v)
      }
    const rings: { iso: string; x: number; y: number }[] = []
    for (const iso of lit.keys()) {
      const p = world.points[iso]
      if (p && !owned.has(world.index(iso))) rings.push({ iso, x: (p[0] / world.w) * w, y: (p[1] / world.h) * h })
    }
    return { w, h, pitch, cells, rings }
  }, [world, size, lit])

  useEffect(() => {
    const c = canvas.current
    if (!c || !layout || !world || !size) return
    const { w, h, pitch, cells, rings } = layout
    const dpr = size.dpr
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
    }
    const ctx = c.getContext('2d')
    if (!ctx) return
    const css = getComputedStyle(c)
    const ink = css.getPropertyValue('--ink').trim() || '#18211b'
    const accent = css.getPropertyValue('--accent').trim() || '#3d6a35'
    const hv = hover ? world.index(hover.iso) : -1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    for (const { x, y, v } of cells) {
      const iso = world.ids[v]
      const on = lit.has(iso)
      const r = dotRadius(pitch, v, on, v === hv)
      ctx.globalAlpha = v === 1 ? 0.5 : on || v === hv ? 1 : 0.3
      ctx.fillStyle = on ? accent : ink
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.strokeStyle = accent
    ctx.fillStyle = accent
    for (const { iso, x, y } of rings) {
      const big = hover?.iso === iso
      ctx.lineWidth = big ? 1.5 : 1
      ctx.beginPath()
      ctx.arc(x, y, big ? pitch * 1.2 : pitch * 0.85, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y, pitch * 0.34, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [layout, world, size, hover, lit])

  /** The country under a point of the frame (CSS px): a ring within reach first, then the raster; null at sea. */
  const pick = useCallback(
    (x: number, y: number) => {
      if (!layout || !world) return null
      const reach = Math.max(10, layout.pitch * 1.6)
      const ring = layout.rings.find((r) => Math.hypot(r.x - x, r.y - y) <= reach)
      if (ring) return ring.iso
      const v = world.at((x / layout.w) * world.w, (y / layout.h) * world.h)
      return v > 1 ? world.ids[v] : null
    },
    [layout, world]
  )
  const onPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - box.left
    const y = e.clientY - box.top
    const iso = pick(x, y)
    setHover(iso ? { iso, x, y } : null)
  }
  /** A row of the list lights its country, labelled at its marker point. */
  const showPlace = (iso: string) => {
    const p = world?.points[iso]
    if (!p || !layout || !world) return setHover(null)
    setHover({ iso, x: (p[0] / world.w) * layout.w, y: (p[1] / world.h) * layout.h })
  }

  if (!data) return null
  const sorted = [...data.places].sort((a, b) => a[2].localeCompare(b[2], 'en'))
  const count = data.places.length
  const headingId = `wmap-${id}`
  const label = hover ? (lit.get(hover.iso)?.name ?? world?.names[hover.iso]) : null
  const tipLeft = hover && layout ? Math.min(Math.max(hover.x, 70), layout.w - 70) : 0
  return (
    <figure className="wmap" aria-labelledby={headingId}>
      <div className="wmap__head">
        <h3 id={headingId} className="wmap__title t-ui">
          {data.title}
        </h3>
        <p className="wmap__lede t-meta">{data.lede}</p>
      </div>
      <div
        ref={frame}
        className="wmap__frame"
        role="img"
        aria-label={`World map with ${count} places lit: ${sorted.map((p) => p[2]).join(', ')}.`}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
      >
        <canvas ref={canvas} className="wmap__canvas" aria-hidden />
        {hover && label ? (
          <span className={`wmap__tip t-meta${hover.y < 48 ? ' wmap__tip--below' : ''}`} style={{ left: tipLeft, top: hover.y }} aria-hidden>
            <span className="wmap__tip-name">{label}</span>
            {lit.has(hover.iso) ? <span className="wmap__tip-note">{data.legend}</span> : null}
          </span>
        ) : null}
      </div>
      <figcaption className="wmap__foot t-meta">
        <span className="wmap__legend">
          <span className="wmap__swatch" aria-hidden />
          {data.legend}: {count} places
        </span>
        <details className="wmap__list">
          <summary>See all {count}</summary>
          <ul onPointerLeave={() => setHover(null)}>
            {sorted.map(([code, iso, name]) => (
              <li key={code} onPointerEnter={() => showPlace(iso)} data-on={hover?.iso === iso || undefined}>
                {name}
              </li>
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
