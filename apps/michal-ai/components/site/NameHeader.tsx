import type { ReactNode } from 'react'

type Props = {
  first: string
  last: string
  role: string
  intro?: ReactNode
}

/** Hero: name, role and the intro slot (the rotating "lately I've built" line). All in the display face. */
export function NameHeader({ first, last, role, intro }: Props) {
  return (
    <header className="pt-[84px] md:pt-[112px]">
      <h1
        data-hero-text="0.4"
        className="font-display text-display-name"
      >
        <span className="block">{first}</span>
        <span className="block">{last}</span>
      </h1>
      <p data-hero-text="0.08" className="mt-space-4 max-w-[34ch] font-display text-heading italic text-ink-muted md:mt-space-6">{role}</p>
      {intro ? <div data-hero-text="0.08" className="name-intro mt-space-4 max-w-[40ch] font-display text-title text-ink md:mt-space-6">{intro}</div> : null}
    </header>
  )
}
