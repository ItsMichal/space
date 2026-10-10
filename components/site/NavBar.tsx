'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LiquidGlass } from '@/components/glass/LiquidGlass'
import { HalmicMark } from './HalmicMark'

const links = [
  { label: 'Work', href: '/projects', match: '/projects' },
  { label: 'Writing', href: '/writing', match: '/writing' },
  { label: 'About', href: '/#about', match: null },
]

export function NavBar() {
  const pathname = usePathname()
  return (
    <header className="pointer-events-none fixed inset-x-0 top-space-4 z-50 flex justify-center px-space-4">
      <LiquidGlass
        as="nav"
        pill
        aria-label="Main"
        className="pointer-events-auto flex w-full max-w-[560px] items-center justify-between gap-space-3 py-space-2 px-space-4 sm:w-auto sm:max-w-none sm:justify-center sm:gap-space-6"
      >
        <Link href="/" aria-label="Home" className="rounded-sm text-ink">
          <HalmicMark height={18} />
        </Link>
        <ul className="m-0 flex list-none items-center gap-space-4 p-0 sm:gap-space-6">
          {links.map((l) => {
            const current = l.match ? pathname.startsWith(l.match) : false
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={current ? 'page' : undefined}
                  className={`rounded-sm text-body-strong transition-colors duration-150 hover:text-ink ${
                    current ? 'text-ink' : 'text-ink-muted'
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </LiquidGlass>
    </header>
  )
}
