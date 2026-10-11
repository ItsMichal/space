'use client'

import { useState, type ReactNode } from 'react'

/** Re-mounts its children on demand so a once-only entrance can be watched again. */
export function Replay({ children, label = 'play again' }: { children: ReactNode; label?: string }) {
  const [n, setN] = useState(0)
  return (
    <div>
      <div key={n}>{children}</div>
      <button type="button" className="m-replay" onClick={() => setN((v) => v + 1)}>
        {label}
      </button>
    </div>
  )
}
