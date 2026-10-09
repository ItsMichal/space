import type { ReactNode } from 'react'

type Props = {
  eyebrow?: string
  first: string
  last: string
  role: string
  intro?: ReactNode
}

export function NameHeader({ eyebrow, first, last, role, intro }: Props) {
  return (
    <header className="pt-[120px] md:pt-[160px]">
      {eyebrow ? <p className="eyebrow mb-space-6">{eyebrow}</p> : null}
      <h1 className="text-[clamp(44px,14.4vw,56px)] font-semibold leading-[0.9] tracking-[-0.045em] md:text-[88px] lg:text-display-name">
        <span className="block">{first}</span>
        <span className="block">{last}</span>
      </h1>
      <p className="mt-space-6 max-w-[56ch] text-body text-ink-muted">{role}</p>
      {intro ? <p className="mt-space-4 max-w-[34ch] font-serif text-[22px] leading-[1.4] text-ink md:text-[26px]">{intro}</p> : null}
    </header>
  )
}
