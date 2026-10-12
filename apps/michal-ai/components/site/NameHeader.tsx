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
        className="font-display font-normal leading-[0.88] tracking-[-0.025em] text-[clamp(44px,calc((100vw-32px)/6.4),64px)] md:text-[clamp(96px,calc((100vw-64px)/6.2),136px)]"
      >
        <span className="block">{first}</span>
        <span className="block">{last}</span>
      </h1>
      <p data-hero-text="0.08" className="mt-space-4 max-w-[34ch] font-display text-[22px] italic leading-[1.2] text-ink-muted md:mt-space-6 md:text-[28px]">{role}</p>
      {intro ? <div data-hero-text="0.08" className="name-intro mt-space-4 max-w-[40ch] font-display text-[25px] leading-[1.2] text-ink md:mt-space-6 md:text-[34px]">{intro}</div> : null}
    </header>
  )
}
