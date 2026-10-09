'use client'

import { useEffect, useState } from 'react'
import { LiquidGlass } from '@/components/glass/LiquidGlass'
import { usePresence } from '@/hooks/usePresence'
import './presence.css'

const MAX_DOTS = 5
const ANNOUNCE_DELAY_MS = 1500

const colorVar = (c: number) => (c >= 1 && c <= 6 ? `var(--presence-${c})` : 'var(--ink-faint)')

/**
 * Glass pill: overlapping dots of everyone currently here (yours first, ringed
 * in ink; max 5 + "+N") and a mono label. The count is announced politely and
 * debounced; pointer moves never reach this component.
 */
export default function PresenceChip({ className }: { className?: string }) {
  const { selfColor, others, count } = usePresence()

  // Debounced so a burst of joins/leaves is announced once, not per change.
  const [announced, setAnnounced] = useState(count)
  useEffect(() => {
    const id = setTimeout(() => setAnnounced(count), ANNOUNCE_DELAY_MS)
    return () => clearTimeout(id)
  }, [count])

  const dots = [{ id: 'me', color: selfColor, me: true }, ...others.map((p) => ({ ...p, me: false }))].slice(
    0,
    MAX_DOTS,
  )
  const more = Math.max(0, count - dots.length)
  const label = count === 1 ? '1 here' : `${count} here now`

  return (
    <LiquidGlass pill className={`presence${className ? ` ${className}` : ''}`}>
      <span className="presence__dots" aria-hidden>
        {dots.map((d) => (
          <i
            key={d.id}
            className={`presence__dot${d.me ? ' me' : ''}`}
            style={{ background: colorVar(d.color) }}
          />
        ))}
      </span>
      <span aria-hidden>
        {label}
        {more > 0 && <span className="presence__more"> +{more}</span>}
      </span>
      <span
        role="status"
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}
      >
        {announced === 1 ? 'You are the only visitor here' : `${announced} visitors here now`}
      </span>
    </LiquidGlass>
  )
}
