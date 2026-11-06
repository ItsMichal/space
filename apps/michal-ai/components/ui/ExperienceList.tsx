import { IndexEntry } from '@/components/ui/IndexEntry'
import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/** `extra` sits under the entry, outside its link (something that belongs to the row, with its own controls). `logo` is a one-colour mask; `icon` stands in for it where an entry has no mark (an award by its type). `highlight` sets the entry on a card (components/site/about.css, `.xp__card`). `external` opens `href` in a new tab. */
export type ExperienceItem = { id: string; org: ReactNode; role: string; years: string; href?: string; external?: boolean; extra?: ReactNode; logo?: string; icon?: LucideIcon; highlight?: boolean }

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
        return (
          <li key={it.id} className={it.highlight ? 'xp__card' : undefined}>
            {timeline ? (
              <span className="xp__node" aria-hidden>
                {it.logo ? (
                  <span className="xp__logo" style={{ '--logo': `url("${it.logo}")` } as CSSProperties} />
                ) : it.icon ? (
                  <it.icon className="xp__icon" size={20} strokeWidth={1.5} />
                ) : null}
              </span>
            ) : null}
            <IndexEntry href={it.href} external={it.external} title={it.org} desc={it.role} meta={it.years} ui />
            {it.extra}
          </li>
        )
      })}
    </ol>
  )
}
