import Link from '@/lib/nav'
import type { ReactNode } from 'react'

export type ExperienceItem = { id: string; org: ReactNode; role: string; years: string; href?: string }

/**
 * Experience as entries of the shared text index (app/styles/type.css, `.ix`), most recent first: the organisation, the role
 * beneath it, the years in quiet secondary text. An entry links to its project when there is one. Server component, a
 * plain ordered list in the HTML.
 */
export function ExperienceList({ items, label }: { items: readonly ExperienceItem[]; label: string }) {
  return (
    <ol className="ix-list ix-list--tight xp" aria-label={label}>
      {items.map((it) => {
        const inner = (
          <>
            <span className="ix__title">{it.org}</span>
            <span className="ix__desc">{it.role}</span>
            <span className="ix__meta">{it.years}</span>
          </>
        )
        return (
          <li key={it.id}>
            {it.href ? (
              <Link href={it.href} className="ix ix--ui">
                {inner}
              </Link>
            ) : (
              <div className="ix ix--ui">{inner}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
