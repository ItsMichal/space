'use client'

import { useEffect, useRef, useState } from 'react'
import { rollDigits } from './number'
import './ui.css'
import './number.css'

/**
 * A restrained digit roll, once, when the figure scrolls into view: each digit column travels a few steps and lands with
 * a hair of overshoot, the last digit a beat after the first (so the number settles from left to right). The final
 * value is in the HTML as real text; the columns are decoration. With scripting off or reduced motion it is just the
 * number. The animation is pure CSS (paused until the figure is visible), so there is no flash of a wrong value.
 */
export function NumberRoll({ value, className = '', text: shown }: { value: number; className?: string; text?: string }) {
  const text = shown ?? String(value)
  const ref = useRef<HTMLSpanElement>(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold: 0.6 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [seen])

  const cols = rollDigits(text)
  return (
    <span ref={ref} className={`nr ${seen ? 'nr--in' : ''} ${className}`}>
      <span className="nr-sr">{text}</span>
      <span aria-hidden className="nr-vis">
        {cols.map((c, i) =>
          c.kind === 'char' ? (
            <span key={i} className="nr-char">
              {c.ch}
            </span>
          ) : (
            <span key={i} className="nr-col">
              <span className="nr-strip" style={{ ['--steps' as string]: c.strip.length - 1, ['--d' as string]: `${c.delay}ms` }}>
                {c.strip.map((d, j) => (
                  <span key={j}>{d}</span>
                ))}
              </span>
            </span>
          )
        )}
      </span>
    </span>
  )
}
