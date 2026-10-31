'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { drawGlyphs, ROWS_AROUND, type GlyphGrid } from '@space/glyph-art'
import { getImageInfo } from '@/lib/media'

/**
 * An article's header art: its cover's subject drawn as 0s and 1s on two rows of ground (@space/glyph-art; the grid comes from
 * lib/glyph/covers.json through the route loader). It stands in for the cover photo, which it opens in the page's Lightbox.
 * Static (painted once per size and theme), so there is nothing to pause under reduced motion. The canvas height is set by CSS from
 * the grid size, so the page does not shift when it paints.
 */
export function GlyphHeader({
  grid,
  cover,
  coverAlt,
}: {
  grid: GlyphGrid
  cover: string
  coverAlt?: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const paint = () => {
      const cs = getComputedStyle(cv)
      const ink = (cs.color.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number)
      const dark =
        ink.length === 3 &&
        ink[0] * 0.299 + ink[1] * 0.587 + ink[2] * 0.114 > 128
      const font =
        getComputedStyle(document.documentElement)
          .getPropertyValue('--font-mono')
          .trim() || 'ui-monospace, monospace'
      drawGlyphs(cv, grid, {
        dark,
        ground: cs.getPropertyValue('--accent').trim() || cs.color,
        font,
      })
    }
    paint()
    const ro = new ResizeObserver(paint)
    ro.observe(cv)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', paint)
    document.fonts?.ready.then(paint)
    return () => {
      ro.disconnect()
      mq.removeEventListener('change', paint)
    }
  }, [grid])

  const info = getImageInfo(cover)
  const webp = info?.variants.webp ?? []
  const big = webp.filter((v) => v.w >= 960)
  const set = (big.length ? big : webp)
    .map((v) => `${v.src} ${v.w}w`)
    .join(', ')
  return (
    <button
      type="button"
      className="glyphhead reading__wide"
      data-zoom=""
      data-zoom-src={webp.length ? webp[webp.length - 1].src : cover}
      data-zoom-srcset={set || undefined}
      data-zoom-w={info?.w}
      data-zoom-h={info?.h}
      data-zoom-color={info?.color}
      data-zoom-caption={coverAlt}
      aria-label={`Open the cover photo: ${coverAlt || 'untitled'}`}
      style={{ '--gw': grid.w, '--gh': grid.h + ROWS_AROUND } as CSSProperties}
    >
      <canvas ref={canvas} aria-hidden />
    </button>
  )
}
