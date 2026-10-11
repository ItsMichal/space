'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/** One petal, once, the first time the stage is reached. A hand-drawn irregular outline, not an ellipse. */
export function PetalFall({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [go, setGo] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setGo(true)
          io.disconnect()
        }
      },
      { threshold: 0.4 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className="m-petal-stage">
      {children}
      {go && (
        <span className="m-petal" aria-hidden style={{ '--fall': '300px' } as CSSProperties}>
          <svg viewBox="0 0 22 28" width="22" height="28">
            <path d="M11.2 1.2c3.6 3.4 9.6 8.6 9.1 14.3-.4 5.2-5 11.2-9.4 11.3C6.3 26.9 1.2 21 1.7 14.9 2 9.2 7.6 4.8 11.2 1.2Z" fill="#e9c7cb" opacity="0.9" />
            <path d="M11.1 3.8c-.7 6.2-.2 13.4 1.4 21.3" fill="none" stroke="#d8a3ac" strokeWidth="0.6" strokeLinecap="round" />
          </svg>
        </span>
      )}
    </div>
  )
}
