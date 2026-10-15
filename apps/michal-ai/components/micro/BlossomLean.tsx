'use client'

import { useRef } from 'react'
import { useSpring } from '@space/motion/useSpring'

/**
 * Two layers of the same blossom photograph lean toward the pointer (or a dragging finger) and settle. Travel <= 6px,
 * rotation <= 1.5deg, far layer moves 60% as much. A very soft critically damped spring (response 0.9s); leaving
 * the frame settles from the current velocity. Vertical touch scrolling is never intercepted (touch-action: pan-y).
 */
const SOFT = { response: 0.9, damping: 1 }

export function BlossomLean({ src, alt }: { src: string; alt: string }) {
  const frame = useRef<HTMLDivElement>(null)
  const near = useRef<HTMLImageElement>(null)
  const far = useRef<HTMLImageElement>(null)
  const pos = useRef({ x: 0, y: 0 })

  const write = () => {
    const { x, y } = pos.current
    if (near.current) near.current.style.transform = `translate(${x * 6}px, ${y * 6}px) rotate(${x * 1.5}deg)`
    if (far.current) far.current.style.transform = `translate(${x * 3.6}px, ${y * 3.6}px) rotate(${x * 0.9}deg)`
  }
  const sx = useSpring(
    0,
    (v) => {
      pos.current.x = v
      write()
    },
    SOFT
  )
  const sy = useSpring(
    0,
    (v) => {
      pos.current.y = v
      write()
    },
    SOFT
  )

  const aim = (e: React.PointerEvent) => {
    const r = frame.current!.getBoundingClientRect()
    sx.to(Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)))
    sy.to(Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1)))
  }
  const rest = () => {
    sx.to(0)
    sy.to(0)
  }

  return (
    <div
      ref={frame}
      className="m-lean"
      style={{ aspectRatio: '16 / 10' }}
      onPointerMove={aim}
      onPointerDown={aim}
      onPointerLeave={rest}
      onPointerUp={rest}
      onPointerCancel={rest}
    >
      <img ref={far} className="m-lean__layer" src={src} alt="" aria-hidden style={{ opacity: 0.55, filter: 'blur(6px)' }} />
      <img
        ref={near}
        className="m-lean__layer"
        src={src}
        alt={alt}
        style={{ WebkitMaskImage: 'linear-gradient(90deg, transparent 20%, #000 60%)', maskImage: 'linear-gradient(90deg, transparent 20%, #000 60%)' }}
      />
    </div>
  )
}
