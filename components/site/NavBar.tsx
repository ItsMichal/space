'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GlassEffectContainer, GlassFold, GlassFoldItem, glass, useGlassNamespace } from '@/components/glass'
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
 * Floating nav: a single glass pill inside a GlassEffectContainer (so extra shapes, such as a presence
 * indicator, can be added later and will merge with it). Below 640px the pill folds open into a menu
 * sheet that unfolds from, and folds back into, the pill (44px targets, safe-area aware).
 */
export function NavBar() {
  const pathname = usePathname()
  const ns = useGlassNamespace('nav')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLElement | null>(null)

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
        className="flex w-full max-w-[640px] items-start justify-center sm:w-auto sm:max-w-none"
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
      </div>
    </GlassEffectContainer>
  )
}
