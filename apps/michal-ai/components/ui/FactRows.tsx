import type { ReactNode } from 'react'
import './facts.css'

export type Fact = { label: string; value: ReactNode }

/**
 * Project facts as quiet rows: serif labels on a fixed column so values line up, tabular figures, a hairline that is
 * drawn in as each row enters (scroll-linked where the browser supports it, simply there where it does not). A server
 * component: every fact is plain text in the HTML.
 */
export function FactRows({ facts, label = 'Project facts' }: { facts: Fact[]; label?: string }) {
  return (
    <dl className="fr card surface reading__wide" aria-label={label}>
      {facts.map((f, i) => (
        <div key={f.label} className="fr-row" style={{ ['--i' as string]: i }}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}
