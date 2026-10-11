'use client'

import { useEffect, useState } from 'react'
import { DriftingPetal } from '@/components/motion/DriftingPetal'

/**
 * Two optional atmospheric touches, OFF by default, for the owner to decide on. Enable with `?petal=1` and/or `?leaf=1`.
 *  - petal: the crafted tumbling petal from the motion lab (a thin plate in air: face-on it stalls, edge-on it slips,
 *    drag and lift follow its tilt), textured with the owner's own cherry-blossom photograph. One petal at a time; the
 *    pointer stirs the air near it. Stops when the tab is hidden; absent under reduced motion.
 *  - leaf: a faint blurred leaf shadow slowly crosses the page (the idle leaf shadow).
 * Both are decorative (aria-hidden, pointer-events none), never touch scrolling, and are absent under reduced motion.
 */
export function Atmosphere() {
  const [flags, setFlags] = useState({ petal: false, leaf: false })

  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    setFlags({ petal: q.get('petal') === '1' && !reduced, leaf: q.get('leaf') === '1' && !reduced })
  }, [])

  if (!flags.petal && !flags.leaf) return null
  return (
    <div className="atm" aria-hidden>
      {flags.petal ? <div className="absolute inset-0"><DriftingPetal global width={30} className="h-full w-full" /></div> : null}
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
