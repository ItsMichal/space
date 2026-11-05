import Link from '@/lib/nav'
import type { CSSProperties, ReactNode } from 'react'

/** `extra` sits under the entry, outside its link (a clip that belongs to the row, with its own controls). `logo` is a one-colour mask. */
export type ExperienceItem = { id: string; org: ReactNode; role: string; years: string; href?: string; extra?: ReactNode; logo?: string }

/**
 * Experience as entries of the shared text index (app/styles/type.css, `.ix`), most recent first: the organisation, the role
 * beneath it, the years in quiet secondary text. An entry links to its project when there is one. With `timeline`, each entry
 * hangs off a vertical rail by a node holding the organisation's mark (components/site/about.css, `.xp--timeline`). Server
 * component, a plain ordered list in the HTML.
 */
export function ExperienceList({ items, label, timeline }: { items: readonly ExperienceItem[]; label: string; timeline?: boolean }) {
  return (
    <ol className={`ix-list ix-list--tight xp${timeline ? ' xp--timeline' : ''}`} aria-label={label}>
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
            {timeline ? (
              <span className="xp__node" aria-hidden>
                {it.logo ? <span className="xp__logo" style={{ '--logo': `url("${it.logo}")` } as CSSProperties} /> : null}
              </span>
            ) : null}
            {it.href ? (
              <Link href={it.href} className="ix ix--ui">
                {inner}
              </Link>
            ) : (
              <div className="ix ix--ui">{inner}</div>
            )}
            {it.extra}
          </li>
        )
      })}
    </ol>
  )
}
