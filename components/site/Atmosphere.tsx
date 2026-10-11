'use client'

import { useEffect, useState } from 'react'

/**
 * Two optional atmospheric touches, OFF by default, for the owner to decide on. Enable with `?petal=1` and/or `?leaf=1`.
 *  - petal: one petal drifts down the viewport, once, the first time each home section is reached.
 *  - leaf: a faint blurred leaf shadow slowly crosses the page (the idle leaf shadow).
 * Both are decorative (aria-hidden, pointer-events none), never touch scrolling, and are absent under reduced motion.
 */
export function Atmosphere() {
  const [flags, setFlags] = useState({ petal: false, leaf: false })
  const [petals, setPetals] = useState<number[]>([])

  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    setFlags({ petal: q.get('petal') === '1' && !reduced, leaf: q.get('leaf') === '1' && !reduced })
  }, [])

  useEffect(() => {
    if (!flags.petal) return
    let n = 0
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          io.unobserve(e.target)
          const id = ++n
          setPetals((p) => [...p, id])
          setTimeout(() => setPetals((p) => p.filter((x) => x !== id)), 11000)
        }
      },
      { threshold: 0, rootMargin: '0px 0px -45% 0px' }
    )
    document.querySelectorAll('main section[id]').forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [flags.petal])

  if (!flags.petal && !flags.leaf) return null
  return (
    <div className="atm" aria-hidden>
      {petals.map((id) => (
        <span key={id} className="atm-petal" style={{ left: `${52 + ((id * 17) % 36)}%` }}>
          <svg viewBox="0 0 22 28" width="22" height="28">
            <path d="M11.2 1.2c3.6 3.4 9.6 8.6 9.1 14.3-.4 5.2-5 11.2-9.4 11.3C6.3 26.9 1.2 21 1.7 14.9 2 9.2 7.6 4.8 11.2 1.2Z" fill="#e9c7cb" opacity="0.92" />
            <path d="M11.1 3.8c-.7 6.2-.2 13.4 1.4 21.3" fill="none" stroke="#d8a3ac" strokeWidth="0.6" strokeLinecap="round" />
          </svg>
        </span>
      ))}
      {flags.leaf ? (
        <svg className="atm-leaf" viewBox="0 0 200 300" preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="atm-leaf-blur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
          </defs>
          <g filter="url(#atm-leaf-blur)" fill="#18211b">
            <path d="M100 8c34 40 70 84 66 140-3 52-34 100-66 146C66 248 34 200 34 148 32 92 66 48 100 8Z" />
          </g>
        </svg>
      ) : null}
    </div>
  )
}
