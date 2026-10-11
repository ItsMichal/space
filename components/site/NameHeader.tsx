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
    <header className="pt-[112px] max-md:min-h-[calc(100svh-120px)] md:pt-[150px]">
      <h1
        className="settle font-display font-normal leading-[0.88] tracking-[-0.025em] text-[clamp(52px,calc((100vw-32px)/5.55),76px)] md:text-[clamp(110px,calc((100vw-64px)/5.55),176px)]"
      >
        <span className="block" style={{ ['--i' as string]: 0 } as React.CSSProperties}>{first}</span>
        <span className="block" style={{ ['--i' as string]: 1 } as React.CSSProperties}>{last}</span>
      </h1>
      <p className="mt-space-6 max-w-[34ch] font-display text-[24px] italic leading-[1.2] text-ink-muted md:mt-space-8 md:text-[32px]">{role}</p>
      {intro ? <div className="name-intro mt-space-6 max-w-[40ch] font-display text-[27px] leading-[1.2] text-ink md:mt-space-8 md:text-[38px]">{intro}</div> : null}
    </header>
  )
}
