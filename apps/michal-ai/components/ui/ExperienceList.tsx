import Link from 'next/link'
import type { ReactNode } from 'react'
import './experience.css'

export type ExperienceItem = { id: string; org: ReactNode; role: string; years: string; href?: string }

/**
 * Experience as quiet fact rows, most recent first: the organisation in the display serif, role and years beneath in
 * muted text, hairline dividers. The first row (the current role) carries the most weight. A row links to its project
 * when there is one. Server component, plain list in the HTML, no horizontal scrolling at any width.
 */
export function ExperienceList({ items, label }: { items: readonly ExperienceItem[]; label: string }) {
  return (
    <ol className="xp" aria-label={label}>
      {items.map((it, i) => {
        const inner = (
          <>
            <span className="xp__org">{it.org}</span>
            <span className="xp__sub">
              {it.role}
              <span className="xp__years"> · {it.years}</span>
            </span>
          </>
        )
        return (
          <li key={it.id} className={`xp__row${i === 0 ? ' xp__row--lead' : ''}`}>
            {it.href ? (
              <Link href={it.href} className="xp__link">
                {inner}
              </Link>
            ) : (
              <div className="xp__link">{inner}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
