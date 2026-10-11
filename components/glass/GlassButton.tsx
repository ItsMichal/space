'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Glass } from './react'
import { glass } from './glass'
import { InkLayer } from '@/components/motion/InkLayer'

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

const isExternal = (href: string) => /^(https?:)?\/\//.test(href) || href.endsWith('.pdf')

/** Pill glass button: hover lift (CSS), spring press with touch-point glow (engine, interactive glass). */
export function GlassButton({ children, href, onClick, solid, className = '', icon, type = 'button' }: Props) {
  const cls = `lg--pill lg-btn${solid ? ' lg-btn--solid' : ''}${className ? ` ${className}` : ''}`
  const inner = (
    <>
      <InkLayer />
      {icon}
      <span>{children}</span>
    </>
  )
  const external = href ? isExternal(href) : false
  const extra = external ? { target: '_blank', rel: 'noreferrer' } : {}

  if (solid) {
    // Solid buttons carry no glass, so they skip the refraction hook.
    if (href && !external) return <Link href={href} className={cls}>{inner}</Link>
    if (href) return <a href={href} className={cls} {...extra}>{inner}</a>
    return <button type={type} onClick={onClick} className={cls}>{inner}</button>
  }
  if (href) {
    return (
      <Glass effect={glass.regular.interactive()} shape="inherit" as={external ? 'a' : Link} className={cls} href={href} {...extra}>
        {inner}
      </Glass>
    )
  }
  return (
    <Glass effect={glass.regular.interactive()} shape="inherit" as="button" className={cls} type={type} onClick={onClick}>
      {inner}
    </Glass>
  )
}
