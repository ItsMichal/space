'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GlassEffectContainer, GlassFold, GlassFoldItem, glass, useGlassNamespace } from '@/components/glass'
import PresenceChip from '@/components/presence/PresenceChip'
import { HalmicMark } from './HalmicMark'

const links = [
  { label: 'Work', href: '/projects', match: '/projects' },
  { label: 'Writing', href: '/writing', match: '/writing' },
  { label: 'About', href: '/#about', match: null },
]

function MenuIcon({ open }: { open: boolean }) {
  // two bars that cross into an x
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M4 7h12" style={{ transformOrigin: '10px 10px', transition: 'transform 260ms cubic-bezier(.2,.8,.2,1)', transform: open ? 'translateY(3px) rotate(45deg)' : 'none' }} />
      <path d="M4 13h12" style={{ transformOrigin: '10px 10px', transition: 'transform 260ms cubic-bezier(.2,.8,.2,1)', transform: open ? 'translateY(-3px) rotate(-45deg)' : 'none' }} />
    </svg>
  )
}

/**
 * Floating nav. One GlassEffectContainer holds two shapes: the nav pill and the presence chip. At
 * rest they sit a hand apart; once the page scrolls they slide together and the container's smooth
 * union fuses them into one liquid shape. Below 640px the pill folds open into a menu sheet
 * (the whole row hinges down; 44px targets).
 */
export function NavBar() {
  const pathname = usePathname()
  const ns = useGlassNamespace('nav')
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    let raf = 0
    const read = () => {
      raf = 0
      setScrolled(window.scrollY > 32)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  const close = useCallback(() => setOpen(false), [])

  const linkClass = (current: boolean) =>
    `flex min-h-[44px] items-center rounded-sm text-body-strong transition-colors duration-150 hover:text-ink ${current ? 'text-ink' : 'text-ink-muted'}`

  return (
    <GlassEffectContainer
      as="header"
      spacing={16}
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
      }}
      ref={rootRef}
    >
      <div
        className="flex w-full max-w-[640px] items-start justify-center transition-[gap] duration-300 ease-out sm:w-auto sm:max-w-none"
        style={{ gap: scrolled ? 4 : 16 }}
      >
        <GlassFold
          as="nav"
          aria-label="Main"
          effect={glass.regular}
          shape={{ cornerRadius: 28 }}
          id="pill"
          namespace={ns}
          open={open}
          panelId="nav-sheet"
          className="pointer-events-auto min-w-0 flex-1 sm:flex-none"
          headerClassName="flex min-h-[52px] items-center justify-between gap-space-3 pl-space-4 pr-[4px] sm:gap-space-6 sm:pr-space-4"
          panelClassName="flex flex-col px-space-4 pb-space-3 pt-space-1 sm:hidden"
          header={
            <>
              <Link href="/" aria-label="Home" className="flex min-h-[44px] items-center rounded-sm text-ink" onClick={close}>
                <HalmicMark height={18} />
              </Link>
              <ul className="m-0 hidden list-none items-center gap-space-6 p-0 sm:flex">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} aria-current={l.match && pathname.startsWith(l.match) ? 'page' : undefined} className={linkClass(!!l.match && pathname.startsWith(l.match))}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
                aria-controls="nav-sheet"
                onClick={() => setOpen((o) => !o)}
                className="flex size-11 items-center justify-center rounded-pill text-ink sm:hidden"
              >
                <MenuIcon open={open} />
              </button>
            </>
          }
        >
          {links.map((l, i) => (
            <GlassFoldItem key={l.href} index={i} as="div">
              <Link
                href={l.href}
                onClick={close}
                aria-current={l.match && pathname.startsWith(l.match) ? 'page' : undefined}
                className={`${linkClass(!!l.match && pathname.startsWith(l.match))} w-full border-t border-hairline text-title`}
              >
                {l.label}
              </Link>
            </GlassFoldItem>
          ))}
        </GlassFold>
        <div className={`pointer-events-auto shrink-0 ${open ? 'max-sm:hidden' : ''}`}>
          <PresenceChip />
        </div>
      </div>
    </GlassEffectContainer>
  )
}
