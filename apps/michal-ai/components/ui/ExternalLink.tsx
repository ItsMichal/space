import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import './ui.css'

/**
 * A link off the site: opens in a new tab, says so to screen readers and, unless `arrow` is false, ends in the up-right arrow.
 * `me` marks the owner's own profiles (rel="me").
 */
export function ExternalLink({ href, children, className = 'link', me = false, arrow = true }: { href: string; children: ReactNode; className?: string; me?: boolean; arrow?: boolean }) {
  return (
    <a href={href} className={className} target="_blank" rel={me ? 'me noopener noreferrer' : 'noopener noreferrer'}>
      {children}
      {arrow ? <ArrowUpRight size={13} strokeWidth={1.5} aria-hidden className="ext-arrow" /> : null}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}
