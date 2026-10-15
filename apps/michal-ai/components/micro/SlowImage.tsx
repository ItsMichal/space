'use client'

import { useEffect, useRef, useState } from 'react'

/** Slow arrival: plays once when 20% of the frame is first in view. */
export function SlowImage({ src, alt, ratio = '4 / 3' }: { src: string; alt: string; ratio?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className="m-arrive" data-in={inView} style={{ aspectRatio: ratio }}>
      <img src={src} alt={alt} />
    </div>
  )
}
