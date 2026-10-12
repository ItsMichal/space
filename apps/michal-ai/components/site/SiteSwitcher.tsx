'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { FOR_MICHAL as SIB } from '@space/crosslinks'
import { SiteMark } from './SiteMark'
import './switcher.css'

/** The other site's mark (shared copy, packages/crosslinks), filled with currentColor. */
export function OtherSiteMark({ height = 16 }: { height?: number }) {
  const [, , w, h] = SIB.mark.viewBox.split(' ').map(Number)
  return (
    <svg viewBox={SIB.mark.viewBox} height={height} width={(height * w) / h} fill="currentColor" aria-hidden="true" focusable="false">
      {SIB.mark.paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

/**
 * The logo with a quiet dropdown under it holding the one link to the other site. Hover (fine pointers) opens it after
 * 120ms and closes it 150ms after the pointer leaves; keyboard focus anywhere inside opens it; Escape closes it. All of it
 * is CSS (switcher.css) except the Escape latch, so the link is always a real, focusable link in the accessibility tree:
 * the menu is only transparent when closed, never display:none or visibility:hidden. Touch screens have no hover, so the
 * phone menu carries the same row (see OtherSiteRow).
 */
export function SiteSwitcher({ onHome }: { onHome?: () => void }) {
  const [dismissed, setDismissed] = useState(false)
  const logo = useRef<HTMLAnchorElement | null>(null)
  return (
    <div
      className="xsw"
      data-dismissed={dismissed ? '' : undefined}
      onPointerLeave={() => setDismissed(false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDismissed(false)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || dismissed) return
        setDismissed(true)
        if (e.target !== logo.current) logo.current?.focus({ preventScroll: true })
      }}
    >
      <Link ref={logo} href="/" aria-label="michal.ai, home" className="xsw__logo" onClick={onHome}>
        <SiteMark height={20} />
      </Link>
      <ul className="xsw__menu">
        <li>
          <a href={SIB.origin} rel="me" className="xsw__row" onFocus={() => setDismissed(false)}>
            <OtherSiteMark height={16} />
            <span>{SIB.domain}</span>
            <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden />
          </a>
        </li>
      </ul>
    </div>
  )
}

/** The same row for touch screens: the last, quiet row of the phone menu sheet. */
export function OtherSiteRow() {
  return (
    <a href={SIB.origin} rel="me" className="xsw__sheet">
      <OtherSiteMark height={16} />
      <span>{SIB.domain}</span>
      <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden />
    </a>
  )
}
