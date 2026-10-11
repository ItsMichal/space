import type { CSSProperties, ReactNode } from 'react'
import { linearSpring } from '@space/motion/linearSpring'
import { settleLine } from '@space/motion/settle'

// SettleText's maths, computed once on the server and handed to CSS: three springs with different timings (opacity quick
// and critical, blur slow and critical, rise plus a hair of rotation underdamped), and seeded per-line stagger and tilt.
// No client JS, no measuring, nothing to flash: the name paints with the first HTML and settles on the compositor.
const SPRING = {
  o: linearSpring({ response: 0.34, damping: 1 }),
  b: linearSpring({ response: 0.62, damping: 1 }),
  m: linearSpring({ response: 0.7, damping: 0.62 }),
}
const lineVars = (i: number): CSSProperties => {
  const l = settleLine(i, { rise: -8, tilt: 0.8, blur: 6 })
  return { '--d': `${80 + l.delay}ms`, '--ny': `${l.fromY.toFixed(2)}px`, '--nr': `${l.fromRot.toFixed(3)}deg`, '--nb': `${l.fromBlur}px` } as CSSProperties
}
const rootVars = {
  '--so-e': SPRING.o.easing, '--so-d': `${SPRING.o.duration}ms`,
  '--sb-e': SPRING.b.easing, '--sb-d': `${SPRING.b.duration}ms`,
  '--sm-e': SPRING.m.easing, '--sm-d': `${SPRING.m.duration}ms`,
} as CSSProperties

type Props = {
  first: string
  last: string
  role: string
  intro?: ReactNode
}

/** Hero: name, role and the intro slot (the rotating "lately I've built" line). All in the display face. */
export function NameHeader({ first, last, role, intro }: Props) {
  return (
    <header className="pt-[112px] md:pt-[150px]">
      <h1
        style={rootVars}
        className="settle font-display font-normal leading-[0.88] tracking-[-0.025em] text-[clamp(52px,calc((100vw-32px)/5.55),76px)] md:text-[clamp(110px,calc((100vw-64px)/5.55),176px)]"
      >
        <span className="block" style={lineVars(0)}>{first}</span>
        <span className="block" style={lineVars(1)}>{last}</span>
      </h1>
      <p className="mt-space-6 max-w-[34ch] font-display text-[24px] italic leading-[1.2] text-ink-muted md:mt-space-8 md:text-[32px]">{role}</p>
      {intro ? <div className="name-intro mt-space-6 max-w-[40ch] font-display text-[27px] leading-[1.2] text-ink md:mt-space-8 md:text-[38px]">{intro}</div> : null}
    </header>
  )
}
