'use client'

import { useId } from 'react'
import { VISIT_EMOJI } from '@/lib/presence/constants'

/** Radio group of the preset visit emoji. Arrow keys move the selection (native radio behaviour). */
export function EmojiPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const name = useId()
  return (
    <fieldset className="presence-picker">
      <legend className="sr-only">Your emoji</legend>
      {VISIT_EMOJI.map((e) => (
        <label key={e.id} className="presence-picker__opt" title={e.label}>
          <input type="radio" name={name} value={e.id} checked={value === e.id} onChange={() => onChange(e.id)} aria-label={e.label} />
          <span className="presence-picker__glyph" aria-hidden>
            {e.glyph}
          </span>
          <svg className="presence-picker__stroke" viewBox="0 0 24 5" preserveAspectRatio="none" aria-hidden>
            <path d="M1.5 3.4C6 1.2 10 4.4 14 2.6S20 2 22.5 3" />
          </svg>
        </label>
      ))}
    </fieldset>
  )
}
