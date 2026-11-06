import type { CSSProperties, ReactNode } from 'react'
import './name-header.css'

export type Alum = { name: string; logo: string; aspect: number; cap: number; mid: number; trail?: number }

/** How tall every mark's capital letters are drawn, in the row's unit (--u, the small size). */
const CAP = 0.56

type Props = {
  first: string
  last: string
  role: string
  intro?: ReactNode
  /** Past workplaces and schools, as one row of faint marks under the role. */
  alum?: readonly Alum[]
}

/** Hero: name, the intro slot (the rotating "lately I've built" line), then the role. All in the display face. */
export function NameHeader({ first, last, role, intro, alum }: Props) {
  return (
    <header className="pt-[84px] md:pt-[112px]">
      <h1
        data-hero-text="0.4"
        className="name-hero font-display text-display-name"
      >
        <span className="block">{first}</span>
        <span className="block">{last}</span>
      </h1>
      {intro ? <div data-hero-text="0.08" className="name-intro mt-space-4 max-w-[40ch] font-display text-title text-ink md:mt-space-6">{intro}</div> : null}
      <div className="name-role mt-space-4 md:mt-space-6">
        <p data-hero-text="0.08" className="name-hero max-w-[34ch] font-display text-heading italic text-ink-muted">{role}</p>
        {alum?.length ? (
          <div data-hero-text="0.08" role="group" aria-label="Alum of" className="name-alum">
            {alum.map((a) => (
              <span
                key={a.name}
                role="img"
                aria-label={a.name}
                data-hero-mark={a.logo}
                className="name-alum__mark"
                style={
                  {
                    '--logo': `url("${a.logo}")`,
                    height: `calc(${CAP / a.cap} * var(--u))`,
                    width: `calc(${(CAP / a.cap) * a.aspect} * var(--u))`,
                    translate: `0 calc(${(0.5 - a.mid) * (CAP / a.cap)} * var(--u))`,
                    marginRight: a.trail ? `calc(${-a.trail * (CAP / a.cap) * a.aspect} * var(--u))` : undefined,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        ) : null}
      </div>
    </header>
  )
}
