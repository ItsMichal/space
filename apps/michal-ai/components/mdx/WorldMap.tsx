import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mapById } from '@/content/maps'
import { dither, SAT_MARKED, seaDot, TERMINAL } from '@/components/presence/ascii/field'
import { cellFor, decodeWorld, dotRadius, type World } from '@/lib/maps/geometry'
import './world-map.css'

/**
 * ::map{id=...}: a world map in the character-cell hero's language (components/presence/HeroAscii.tsx): braille "mixels", each
 * character cell a 2 x 4 grid of dots, solid on land and an ordered-dither halftone at sea (in ink leaning blue, as the hero
 * does). Land is ink, and the countries of one entry of content/maps.ts are the accent. Hovering (or tapping) a country names it
 * and swells its dots; hovering a row of the list below does the same. A place too small to catch a dot gets the hero's ground
 * terminal glyph (`o`, `@` while hovered). The world (Natural Earth, lib/maps/world.gen.ts) loads after the page, so the frame
 * keeps its shape until it arrives. Nothing animates. An unknown id renders nothing.
 */
/** The hero's sea colour: ink moved a third of the way to a muted blue (HeroAscii.tsx). */
function mixBlue(ink: string): string {
  const g = document.createElement('canvas').getContext('2d')
  if (!g) return ink
  g.fillStyle = ink
  const v = String(g.fillStyle)
  const x = v.startsWith('#') ? [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)) : (v.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']).slice(0, 3).map(Number)
  const y = [0x2f, 0x6a, 0xa0]
  return `rgb(${x.map((c, i) => Math.round(c + (y[i] - c) * 0.35)).join(',')})`
}

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

  // every mixel at this width (its centre and palette index), and the lit places too small to own one (they get a glyph)
  const layout = useMemo(() => {
    if (!world || !size || !size.w) return null
    const w = size.w
    const h = Math.round((w * world.h) / world.w)
    const { cw, ch } = cellFor(w)
    const dx = cw / 2
    const dy = ch / 4
    const dots: { x: number; y: number; v: number }[] = []
    const owned = new Set<number>()
    for (let sy = 0; (sy + 0.5) * dy < h; sy++)
      for (let sx = 0; (sx + 0.5) * dx < w; sx++) {
        const x = (sx + 0.5) * dx
        const y = (sy + 0.5) * dy
        const v = world.at((x / w) * world.w, (y / h) * world.h)
        if (!v || (v === 1 && !seaDot(0.5, dither(sx, sy), false))) continue
        dots.push({ x, y, v })
        owned.add(v)
      }
    const marks: { iso: string; x: number; y: number }[] = []
    for (const iso of lit.keys()) {
      const p = world.points[iso]
      if (p && !owned.has(world.index(iso))) marks.push({ iso, x: (p[0] / world.w) * w, y: (p[1] / world.h) * h })
    }
    return { w, h, cw, ch, dots, marks }
  }, [world, size, lit])

  useEffect(() => {
    const c = canvas.current
    if (!c || !layout || !world || !size) return
    const { w, h, cw, ch, dots, marks } = layout
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
    const mono = getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() || 'ui-monospace, monospace'
    const hv = hover ? world.index(hover.iso) : -1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    // four passes, one path each: sea, land, lit land, then the hovered country on top
    const r = dotRadius(cw, ch, false)
    const big = dotRadius(cw, ch, true)
    const pass = (keep: (v: number, on: boolean) => boolean, colour: string, alpha: number, rad: number) => {
      ctx.globalAlpha = alpha
      ctx.fillStyle = colour
      ctx.beginPath()
      for (const { x, y, v } of dots) {
        if (!keep(v, lit.has(world.ids[v]))) continue
        ctx.moveTo(x + rad, y)
        ctx.arc(x, y, rad, 0, Math.PI * 2)
      }
      ctx.fill()
    }
    pass((v) => v === 1, mixBlue(ink), 0.45, r)
    pass((v, on) => v > 1 && !on && v !== hv, ink, 0.4, r)
    pass((v, on) => on && v !== hv, accent, 1, r)
    if (hv > 1) pass((v) => v === hv, lit.has(world.ids[hv]) ? accent : ink, 1, big)
    ctx.globalAlpha = 1
    ctx.fillStyle = accent
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const { iso, x, y } of marks) {
      const on = hover?.iso === iso
      ctx.font = `${on ? 600 : 400} ${ch * (on ? 1.2 : 0.86)}px ${mono}`
      ctx.fillText(on ? SAT_MARKED : TERMINAL, x, y)
    }
  }, [layout, world, size, hover, lit])

  /** The country under a point of the frame (CSS px): a glyph within reach first, then the raster; null at sea. */
  const pick = useCallback(
    (x: number, y: number) => {
      if (!layout || !world) return null
      const reach = Math.max(10, layout.ch)
      const mark = layout.marks.find((m) => Math.hypot(m.x - x, m.y - y) <= reach)
      if (mark) return mark.iso
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
