'use client'

import { useRef, type ReactNode } from 'react'

/** Ink-soak press: a stain grows from the exact press point, then fades slowly after release. */
export function InkButton({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null)
  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = ref.current!
    const r = el.getBoundingClientRect()
    el.style.setProperty('--x', `${e.clientX - r.left}px`)
    el.style.setProperty('--y', `${e.clientY - r.top}px`)
    el.dataset.soak = 'true'
  }
  const up = () => {
    if (ref.current) ref.current.dataset.soak = 'false'
  }
  return (
    <button ref={ref} type="button" className="m-ink" onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}>
      {children}
    </button>
  )
}
