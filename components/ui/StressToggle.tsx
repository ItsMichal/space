'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Dev tool: wraps a component and, while switched on, fires a real click on a random control inside it every ~260ms,
 * so each animation is interrupted mid-flight over and over. If anything snaps, queues or locks, you will see it.
 */
export function StressToggle({ pick, children, label = 'Interrupt me' }: { pick: string; children: ReactNode; label?: string }) {
  const root = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!on) return
    const t = setInterval(() => {
      const els = root.current?.querySelectorAll<HTMLElement>(pick)
      if (!els?.length) return
      els[Math.floor(Math.random() * els.length)].click()
    }, 260)
    return () => clearInterval(t)
  }, [on, pick])
  return (
    <div ref={root}>
      <label className="mb-space-3 inline-flex min-h-[44px] items-center gap-space-2 font-serif text-[15px] text-ink-muted">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
        {label}
      </label>
      {children}
    </div>
  )
}
