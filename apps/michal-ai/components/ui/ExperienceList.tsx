import Link from 'next/link'
import type { ReactNode } from 'react'
import './experience.css'

export type ExperienceItem = { id: string; org: ReactNode; role: string; years: string; href?: string }

/**
 * Experience as rows inside a card, most recent first: organisation and role on the left, years on the right, all rows the
 * same size (the current role no longer needs to be larger to carry hierarchy). A row links to its project when there is
 * one. Server component, a plain ordered list in the HTML.
 */
export function ExperienceList({ items, label }: { items: readonly ExperienceItem[]; label: string }) {
  return (
    <ol className="xp card__rows" aria-label={label}>
      {items.map((it) => {
        const inner = (
          <>
            <span className="xp__main">
              <span className="xp__org t-ui">{it.org}</span>
              <span className="xp__role t-meta">{it.role}</span>
            </span>
            <span className="xp__years t-meta">{it.years}</span>
          </>
        )
        return (
          <li key={it.id}>
            {it.href ? (
              <Link href={it.href} className="xp__row card__row">
                {inner}
              </Link>
            ) : (
              <div className="xp__row">{inner}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
