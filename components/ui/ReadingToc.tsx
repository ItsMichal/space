'use client'

import { useMemo } from 'react'
import { useReading } from './useReading'
import { stemPath } from './craft/stroke'
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
  const stem = useMemo(() => stemPath(height, { base: 3, tip: 1.1, sway: 1.1, seed: 5, step: 10 }), [height])
  if (!r || count < 2) return null
  return (
    <nav aria-label="On this page" className="toc" data-on={r.started ? '' : undefined}>
      <div className="toc-rail" style={{ height }}>
        <svg width="10" height={height} viewBox={`0 0 10 ${height}`} aria-hidden className="toc-svg">
          <defs>
            <clipPath id="toc-clip">
              <rect x="0" y="-6" height="12" style={{ width: `${Math.max(2, r.progress * height)}px`, transition: 'width 500ms var(--ui-settle)' }} />
            </clipPath>
          </defs>
          <g transform="translate(5 0) rotate(90)">
            <path className="toc-hair" d={`M0 0L${height} 0`} />
            <path className="toc-stem" d={stem} clipPath="url(#toc-clip)" />
          </g>
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
