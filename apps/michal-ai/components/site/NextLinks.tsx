import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import './home.css'

export type NextLink = { label: string; href: string; external?: boolean }

/** The end of the page: plain link names to where to go next, in the display serif. */
export function NextLinks({ links, label }: { links: NextLink[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="nx">
        {links.map((l) => (
          <li key={l.href}>
            {l.external ? (
              <a href={l.href} className="nx__a" target="_blank" rel="noreferrer">
                <span>{l.label}</span>
                <ArrowUpRight size={20} strokeWidth={1.4} aria-hidden />
              </a>
            ) : (
              <Link href={l.href} className="nx__a">
                <span>{l.label}</span>
                <ArrowUpRight size={20} strokeWidth={1.4} aria-hidden />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
