'use client'

import Link from '@/lib/nav'
import { usePathname } from '@/lib/nav'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GlassEffectContainer, GlassFold, GlassFoldItem, glass, useGlassNamespace } from '@/components/glass'
import { StatusSlot } from '@/components/ui/StatusPill'
import { OtherSiteRow, SiteSwitcher } from './SiteSwitcher'
import type { MenuPreview } from '@/lib/menu'

const links = [
  { label: 'Work', href: '/projects', match: '/projects' },
  { label: 'Writing', href: '/writing', match: '/writing' },
  { label: 'About', href: '/about', match: '/about' },
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
// The nav is a clean frosted bar by default (blur and saturate, hairline edge, soft shadow). The SVG-displacement
// Liquid Glass path stays in the code behind NEXT_PUBLIC_GLASS=refract until it has a measured precedent.
const NAV_GLASS = process.env.NEXT_PUBLIC_GLASS === 'refract' ? 'auto' : 'frost'

export function NavBar({ previews }: { previews?: { work: MenuPreview[]; writing: MenuPreview[] } }) {
  const pathname = usePathname()
  const ns = useGlassNamespace('nav')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const wasOpen = useRef(false)

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

  // Scroll is locked only while the sheet is open (phone widths; CSS scopes it). Focus stays on the toggle on open (the
  // sheet follows it in tab order, so keyboard users land on the first link next) and returns to it on close.
  useEffect(() => {
    const root = document.documentElement
    if (open) {
      root.setAttribute('data-nav-open', '')
    } else {
      root.removeAttribute('data-nav-open')
      if (wasOpen.current && document.getElementById('nav-sheet')?.contains(document.activeElement)) buttonRef.current?.focus({ preventScroll: true })
    }
    wasOpen.current = open
    return () => root.removeAttribute('data-nav-open')
  }, [open])

  const close = useCallback(() => setOpen(false), [])

  const linkClass = (current: boolean) =>
    `flex min-h-[44px] items-center rounded-sm text-body-strong transition-colors duration-150 hover:text-ink ${current ? 'text-ink' : 'text-ink-muted'}`

  return (
    <>
    <div aria-hidden className="nav-scrim" data-open={open ? '' : undefined} onClick={close} />
    <GlassEffectContainer
      engine={NAV_GLASS}
      as="header"
      spacing={16}
      className="nav-glass pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-[10px] [overflow-x:clip]"
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
          effect={open ? glass.regular.tint('var(--nav-sheet-tint)') : glass.regular}
          shape={{ cornerRadius: 28 }}
          id="pill"
          namespace={ns}
          open={open}
          panelId="nav-sheet"
          className="pointer-events-auto min-w-0 flex-1 sm:flex-none"
          headerClassName="relative flex min-h-[48px] items-center justify-between gap-space-3 pl-space-4 pr-[4px] sm:gap-space-6 sm:pr-space-4"
          panelClassName="sheet-scroll flex flex-col px-space-4 pb-space-3 pt-space-1 sm:hidden"
          header={
            <>
              <SiteSwitcher onHome={close} />
              <ul className="m-0 hidden list-none items-center gap-space-6 p-0 sm:flex">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} aria-current={l.match && pathname.startsWith(l.match) ? 'page' : undefined} className={`${linkClass(!!l.match && pathname.startsWith(l.match))} -mx-space-3 !rounded-full px-space-3 focus-visible:outline-offset-[-6px]`}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <StatusSlot routeKey={pathname} />
              <button
                ref={buttonRef}
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
          {links.map((l, i) => {
            const rows = l.href === '/projects' ? previews?.work : l.href === '/writing' ? previews?.writing : undefined
            return (
              <div key={l.href} className="sheet-sec">
                <GlassFoldItem index={i} as="div">
                  <Link
                    href={l.href}
                    onClick={close}
                    aria-current={l.match && pathname.startsWith(l.match) ? 'page' : undefined}
                    className={`${linkClass(!!l.match && pathname.startsWith(l.match))} sheet-row min-h-[52px] w-full !text-ink font-display text-heading`}
                  >
                    {l.label}
                  </Link>
                </GlassFoldItem>
                {rows && rows.length > 0 ? (
                  <ul className="sheet-prev">
                    {rows.map((r, k) => (
                      <GlassFoldItem key={r.href} as="li" index={i + k + 1}>
                        <Link href={r.href} onClick={close} className="sheet-prow">
                          <span className="sheet-prow__tile" style={{ backgroundColor: r.tint, backgroundImage: r.thumb ? `url(${r.thumb.lqip})` : undefined }} aria-hidden>
                            {r.thumb ? (
                              <img src={r.thumb.src} alt="" width={44} height={44} loading="lazy" decoding="async" />
                            ) : null}
                          </span>
                          <span className="sheet-prow__text">
                            <span className="sheet-prow__title">{r.title}</span>
                            <span className="sheet-prow__sub">{r.sub}</span>
                          </span>
                        </Link>
                      </GlassFoldItem>
                    ))}
                  </ul>
                ) : null}
              </div>
            )
          })}
          <GlassFoldItem index={5} as="div">
            <OtherSiteRow />
          </GlassFoldItem>
        </GlassFold>
      </div>
    </GlassEffectContainer>
    </>
  )
}
