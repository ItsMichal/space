import type { ReactNode } from 'react'

/** The fixed lead-in for the two conversational callouts: a prerequisite up front, and the question the reader is asking. */
const LABELS: Record<string, string> = { before: 'Before you continue', ask: 'You might be wondering' }

export function Callout({ type = 'note', children }: { type?: string; children?: ReactNode }) {
  const label = LABELS[type]
  return (
    <aside className={`callout callout--${type}`} role="note" aria-label={label}>
      {label ? <p className="callout__label">{label}</p> : null}
      {children}
    </aside>
  )
}
