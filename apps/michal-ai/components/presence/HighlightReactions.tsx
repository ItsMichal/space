'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { REACTIONS } from '@/lib/presence/constants'
import { sumCounts, topReaction } from '@/lib/presence/reactions-core'
import { toggle, useReactions } from './useReactions'
import './presence.css'

interface Box {
  top: number
  bottom: number
  left: number
  right: number
}

/**
 * Per-paragraph reactions. Blocks carry `data-block` ids from the Markdown pipeline.
 *  - Desktop: hovering a block reveals a small mark in the margin; click opens the five-emoji popover.
 *  - Touch: tap the right gutter beside a block (long-press is avoided so text selection is never fought).
 *  - Blocks that already have reactions show a quiet mark with the top emoji and the total.
 * Everything lives in one absolutely positioned layer inside the article, so nothing in the text column moves.
 */
export function HighlightReactions({ slug }: { slug: string }) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [boxes, setBoxes] = useState<Record<string, Box>>({})
  const [hover, setHover] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [wide, setWide] = useState(true)
  const r = useReactions(slug, host !== null)
  const hoverT = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = document.querySelector<HTMLElement>('article[data-post]')
    if (!el) return
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
    setHost(el)
  }, [])

  const measure = useCallback(() => {
    if (!host) return
    const base = host.getBoundingClientRect()
    const next: Record<string, Box> = {}
    host.querySelectorAll<HTMLElement>('[data-block]').forEach((b) => {
      const id = b.dataset.block!
      const rc = b.getBoundingClientRect()
      next[id] = { top: rc.top - base.top, bottom: rc.bottom - base.top, left: rc.left - base.left, right: rc.right - base.left }
    })
    setBoxes(next)
    setWide(window.innerWidth >= 900)
  }, [host])

  useEffect(() => {
    if (!host || r.status !== 'ready') return
    let raf = 0
    const again = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    again()
    const ro = new ResizeObserver(again)
    ro.observe(host)
    window.addEventListener('resize', again)
    document.fonts?.ready.then(again)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', again)
    }
  }, [host, r.status, measure])

  // Hover (mouse) and gutter taps (touch).
  useEffect(() => {
    if (!host || r.status !== 'ready') return
    const blockAt = (t: EventTarget | null) => (t as HTMLElement | null)?.closest?.<HTMLElement>('[data-block]')?.dataset.block ?? null
    const over = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const id = blockAt(e.target)
      if (!id) return
      if (hoverT.current) clearTimeout(hoverT.current)
      hoverT.current = setTimeout(() => {
        if (window.getSelection()?.isCollapsed === false) return
        setHover(id)
      }, 160)
    }
    const down = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('.hl-pop, .hl-mark, .hl-add')) return
      // outside click closes the popover
      setOpen(null)
      if (e.pointerType === 'mouse') return
      // touch: a tap in the gutter to the right of a block
      const base = host.getBoundingClientRect()
      const x = e.clientX - base.left
      const y = e.clientY - base.top
      for (const [id, b] of Object.entries(boxesRef.current)) {
        if (y >= b.top && y <= b.bottom && x > b.right - 2 && x < b.right + 40) {
          pending.current = { id, x: e.clientX, y: e.clientY }
          return
        }
      }
      pending.current = null
    }
    const up = (e: PointerEvent) => {
      const p = pending.current
      pending.current = null
      if (!p || e.pointerType === 'mouse') return
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) setOpen(p.id)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    host.addEventListener('pointerover', over)
    document.addEventListener('pointerdown', down)
    document.addEventListener('pointerup', up)
    document.addEventListener('keydown', key)
    return () => {
      host.removeEventListener('pointerover', over)
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('keydown', key)
    }
  }, [host, r.status])

  const boxesRef = useRef(boxes)
  boxesRef.current = boxes
  const pending = useRef<{ id: string; x: number; y: number } | null>(null)

  if (!host || r.status !== 'ready') return null

  const place = (b: Box, width: number) => {
    const hostW = host.clientWidth
    if (wide) return { left: Math.min(b.right + 10, hostW - width - 4), top: b.top + 2 }
    return { left: Math.max(4, Math.min(b.right - width, hostW - width - 4)), top: b.bottom - 8 }
  }

  const ids = new Set<string>(Object.keys(r.blocks).filter((id) => sumCounts(r.blocks[id]) > 0 && boxes[id]))
  if (hover && boxes[hover]) ids.add(hover)
  if (open && boxes[open]) ids.add(open)

  return createPortal(
    <div className="hl-layer" onPointerLeave={() => setHover((h) => (open ? h : null))}>
      {[...ids].map((id) => {
        const b = boxes[id]
        const counts = r.blocks[id]
        const top = topReaction(counts)
        const total = sumCounts(counts)
        const glyph = REACTIONS.find((e) => e.id === top?.id)?.glyph
        if (total > 0) {
          const pos = place(b, 52)
          return (
            <button
              key={id}
              type="button"
              className="hl-mark"
              style={pos}
              aria-label={`Reactions on this passage, ${total}. Open`}
              aria-expanded={open === id}
              onClick={() => setOpen((o) => (o === id ? null : id))}
            >
              <span aria-hidden>{glyph}</span>
              <span>{total}</span>
            </button>
          )
        }
        const pos = place(b, 24)
        return (
          <button
            key={id}
            type="button"
            className="hl-add"
            data-on={hover === id || open === id}
            style={pos}
            aria-label="React to this passage"
            aria-expanded={open === id}
            onClick={() => setOpen((o) => (o === id ? null : id))}
          >
            <svg viewBox="0 0 12 12" aria-hidden>
              <path d="M6 10.5C6 7.5 6.3 5.6 6 3.4M6 6.2C3.6 6.3 2.4 5.2 2.2 3.2C4.4 3.2 5.7 4.2 6 6.2ZM6.1 4.9C6.4 2.9 7.7 1.8 9.8 1.7C9.9 3.7 8.4 4.9 6.1 4.9Z" />
            </svg>
          </button>
        )
      })}
      {open && boxes[open] ? (
        <div className="hl-pop" role="group" aria-label="React to this passage" style={popPos(boxes[open], host.clientWidth)}>
          {REACTIONS.map((e) => {
            const on = (r.mine[open] ?? []).includes(e.id)
            const n = r.blocks[open]?.[e.id] ?? 0
            return (
              <button key={e.id} type="button" aria-pressed={on} aria-label={`${e.label}, ${n}`} onClick={() => void toggle(slug, open, e.id)}>
                <span aria-hidden>{e.glyph}</span>
                {n > 0 ? <small aria-hidden>{n}</small> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>,
    host,
  )
}

function popPos(b: Box, hostW: number) {
  const w = 5 * 44 + 10 + 4
  return { left: Math.max(4, Math.min(b.right - w, hostW - w - 4)), top: Math.max(4, b.top - 52) }
}
