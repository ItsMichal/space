'use client'

import { Search } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * `:fig[N]` in running text: a chip that points at the post's Nth image. Hovering or focusing it lights that figure (so the reader
 * can see what is meant without losing their place); following it jumps there.
 */
export function FigRef({ n }: { n: string }) {
  const light = (on: boolean) =>
    document.getElementById(`fig-${n}`)?.classList.toggle('is-lit', on)
  return (
    <a
      href={`#fig-${n}`}
      className="figref"
      aria-label={`Figure ${n}`}
      onMouseEnter={() => light(true)}
      onMouseLeave={() => light(false)}
      onFocus={() => light(true)}
      onBlur={() => light(false)}
    >
      <Search size={11} strokeWidth={2} aria-hidden />
      <span>fig {n}</span>
    </a>
  )
}

/** `:term[...]{c=...}`: a term in one of the TERM_COLOURS, the colour the post's figures use for the same thing. */
export function Term({ c, children }: { c: string; children?: ReactNode }) {
  return <span className={`term term--${c}`}>{children}</span>
}
