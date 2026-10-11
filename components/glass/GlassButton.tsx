'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { LiquidGlass } from './LiquidGlass'

type Props = {
  children: ReactNode
  href?: string
  onClick?: () => void
  /** Ink fill, no glass: the single most important action on a screen. */
  solid?: boolean
  className?: string
  /** Leading Lucide icon (20px). */
  icon?: ReactNode
  type?: 'button' | 'submit'
}

/** Ink-soak press: the stain starts exactly where the finger or pointer lands, then dries away slowly (craft.css `.ink`). */
const soak = {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.style.setProperty('--x', `${e.clientX - r.left}px`)
    el.style.setProperty('--y', `${e.clientY - r.top}px`)
    el.dataset.soak = 'true'
  },
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void (e.currentTarget.dataset.soak = 'false'),
  onPointerLeave: (e: React.PointerEvent<HTMLElement>) => void (e.currentTarget.dataset.soak = 'false'),
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void (e.currentTarget.dataset.soak = 'false'),
}

const isExternal = (href: string) => /^(https?:)?\/\//.test(href) || href.endsWith('.pdf')

/** Pill glass button. Springs to 1.03 on hover and 0.97 on press (CSS, see .lg-btn). */
export function GlassButton({ children, href, onClick, solid, className = '', icon, type = 'button' }: Props) {
  const cls = `lg-btn ink${solid ? ' lg-btn--solid' : ''}${className ? ` ${className}` : ''}`
  const inner = (
    <>
      {icon}
      <span>{children}</span>
    </>
  )
  const external = href ? isExternal(href) : false
  const extra = external ? { target: '_blank', rel: 'noreferrer' } : {}

  if (solid) {
    // Solid buttons carry no glass, so they skip the refraction hook.
    if (href && !external) return <Link href={href} className={cls} {...soak}>{inner}</Link>
    if (href) return <a href={href} className={cls} {...extra} {...soak}>{inner}</a>
    return <button type={type} onClick={onClick} className={cls} {...soak}>{inner}</button>
  }
  if (href) {
    return (
      <LiquidGlass pill as={external ? 'a' : Link} className={cls} href={href} {...extra} {...soak}>
        {inner}
      </LiquidGlass>
    )
  }
  return (
    <LiquidGlass pill as="button" className={cls} type={type} onClick={onClick} {...soak}>
      {inner}
    </LiquidGlass>
  )
}
