'use client'

import { useMemo } from 'react'
import { useReading } from './useReading'
import { makeStroke } from '@space/motion/handStroke'
import './ui.css'
import './toc.css'

const ROW = 34

/**
 * A quiet margin list of the article's sections (wide screens). A moss stem runs down its left edge and grows with your
 * reading progress; the section you are in is marked with a small bud and darker text. On phones the nav's status pill
 * carries the same information, so this stays out of the way. Anchors are plain links; scrolling is never touched.
 */
export function ReadingToc() {
  const r = useReading('toc')
  const count = r?.headings.length ?? 0
  const height = Math.max(ROW, count * ROW)
  const stroke = useMemo(() => {
    const steps = Math.max(3, Math.round(height / 60))
    return makeStroke(Array.from({ length: steps + 1 }, (_, i) => ({ x: 5 + Math.sin(i * 1.4 + 0.5) * 1.3, y: (i / steps) * height })), {
      size: 4,
      seed: 5,
      wobble: 0.8,
      tip: 0.06,
      startWidth: 0.5,
      density: Math.max(24, Math.round(height / 5)),
    })
  }, [height])
  if (!r || count < 2) return null
  return (
    <nav aria-label="On this page" className="toc" data-on={r.started ? '' : undefined}>
      <div className="toc-rail" style={{ height }}>
        <svg width="10" height={height} viewBox={`0 0 10 ${height}`} aria-hidden className="toc-svg">
          <path className="toc-hair" d={stroke.d(0, 1, -1.9)} />
          <path className="toc-stem" d={stroke.d(0, Math.min(1, Math.max(0.03, r.progress)), r.progress > 0.01 && r.progress < 0.99 ? 0.5 : 0)} />
        </svg>
        <span className="toc-bud" style={{ transform: `translate(-3px, ${Math.max(0, r.section) * ROW + 8}px)` }} aria-hidden />
      </div>
      <ol className="toc-list">
        {r.headings.map((h, i) => (
          <li key={h.id}>
            <a href={`#${h.id}`} className="toc-a" aria-current={i === r.section ? 'location' : undefined}>
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
