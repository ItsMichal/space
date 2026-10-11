'use client'

import { useRef, useState, type ReactNode } from 'react'
import { BuddingTimeline } from './BuddingTimeline'
import { DriftingPetal } from './DriftingPetal'
import { InkPress } from './InkPress'
import { SettleText, type SettleHandle } from './SettleText'
import { StretchPill } from './StretchPill'
import { TendrilLink } from './TendrilLink'
import { linearSpring } from '@/lib/motion/linearSpring'

const SPRING = linearSpring({ response: 0.5, damping: 0.72 })

function Pair({ title, note, simple, crafted }: { title: string; note: string; simple: ReactNode; crafted: ReactNode }) {
  return (
    <section className="border-t border-hairline py-12">
      <h2 className="font-sans text-[28px] leading-tight tracking-tight text-ink">{title}</h2>
      <p className="mt-2 max-w-[62ch] font-serif text-[17px] text-ink-muted">{note}</p>
      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <div>
          <p className="mb-3 font-serif text-[15px] italic text-ink-muted">Simple</p>
          <div data-lab="simple" className="flex min-h-[150px] items-center">{simple}</div>
        </div>
        <div>
          <p className="mb-3 font-serif text-[15px] italic text-ink-muted">Crafted</p>
          <div data-lab="crafted" className="flex min-h-[150px] items-center">{crafted}</div>
        </div>
      </div>
    </section>
  )
}

const TITLE = 'Things made slowly, with attention to the small parts, tend to feel alive.'

export function MotionLab() {
  const [simpleP, setSimpleP] = useState(0)
  const [simplePage, setSimplePage] = useState(0)
  const [on, setOn] = useState(true)
  const settle = useRef<SettleHandle>(null)

  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-24 pt-28 md:px-8">
      <style>{`
        .lab-simple-link{position:relative;display:inline-block;font-family:var(--font-serif,serif);font-size:24px}
        .lab-simple-link::after{content:"";position:absolute;left:0;right:0;bottom:-2px;height:1px;background:currentColor;transform:scaleX(0);transform-origin:left;transition:transform .3s ease}
        .lab-simple-link:hover::after,.lab-simple-link:focus-visible::after{transform:scaleX(1)}
        .lab-simple-btn{min-height:44px;padding:0 24px;border-radius:9999px;border:1px solid var(--hairline);background:var(--paper-raised);color:var(--ink);transition:transform .15s ease,background-color .15s ease}
        .lab-simple-btn:active{transform:scale(.97);background:var(--paper-sunk)}
        .lab-simple-dot{position:absolute;left:14px;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:var(--ink);transition:transform .3s ease}
        .lab-fall{animation:lab-fall 6s linear infinite}
        @keyframes lab-fall{from{transform:translateY(-20px)}to{transform:translateY(190px)}}
        .lab-spring-demo{transition:transform ${SPRING.duration}ms ${SPRING.easing}}
        @media (prefers-reduced-motion: reduce){.lab-fall{animation:none;transform:translateY(80px)}.lab-simple-link::after,.lab-simple-dot{transition:none}.lab-spring-demo{transition:none}}
      `}</style>
      <h1 className="font-sans text-[44px] leading-none tracking-tight text-ink">Motion craft lab</h1>
      <p className="mt-4 max-w-[62ch] font-serif text-[19px] text-ink-muted">
        Dev only. Each moment is shown as the simple version (a primitive and a tween) beside the crafted version from{' '}
        <code className="font-mono text-[15px]">lib/motion</code>. All of them can be interrupted mid-flight.
      </p>

      <Pair
        title="Tendril underline"
        note="One hand-drawn stroke: wavering line, variable width, a curl at the end. It draws with a pen that presses in as it lands, and soaks away from the tail."
        simple={<a href="#" className="lab-simple-link text-ink" onClick={(e) => e.preventDefault()}>A link to somewhere</a>}
        crafted={<TendrilLink href="#" className="font-serif text-[24px] text-ink">A link to somewhere</TendrilLink>}
      />

      <Pair
        title="Ink-soak press"
        note="Press and hold, release, press again quickly. The ink blooms from the touch along an irregular edge and keeps soaking after you let go."
        simple={<button className="lab-simple-btn font-sans">Send a note</button>}
        crafted={<InkPress className="font-sans">Send a note</InkPress>}
      />

      <Pair
        title="Budding timeline and stem"
        note="Drag along the track. The stem grows with follow-through; each tick buds into a leaf as the tip passes, and the leaves sway a beat behind."
        simple={
          <div className="w-full max-w-[520px]">
            <div className="relative h-11 touch-pan-y" onPointerDown={(e) => setSimpleP(Math.min(1, Math.max(0, (e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.getBoundingClientRect().width)))}>
              <div className="absolute left-0 right-0 top-1/2 h-px bg-hairline" />
              <div className="absolute left-0 top-1/2 h-px bg-ink transition-[width] duration-300" style={{ width: `${simpleP * 100}%` }} />
              {[0.08, 0.26, 0.44, 0.62, 0.8, 0.97].map((u) => (
                <span key={u} className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink transition-opacity duration-300" style={{ left: `${u * 100}%`, opacity: simpleP >= u ? 1 : 0.25 }} />
              ))}
            </div>
          </div>
        }
        crafted={<BuddingTimeline />}
      />

      <Pair
        title="Stretching page control"
        note="Tap a dot, or drag across. The leading edge jumps ahead, the trailing edge is dragged behind, the waist thins, then it gathers. Tap quickly twice and it redirects without a hitch."
        simple={
          <div className="relative h-11 w-[134px] cursor-pointer" onPointerDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSimplePage(Math.min(4, Math.max(0, Math.round(((e.clientX - r.left) - 14) / 22)))) }}>
            {[0, 1, 2, 3, 4].map((i) => (<span key={i} className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-faint" style={{ left: 14 + i * 22 }} />))}
            <span className="lab-simple-dot" style={{ transform: `translateX(${simplePage * 22}px)` }} />
          </div>
        }
        crafted={<StretchPill />}
      />

      <Pair
        title="Settling title"
        note="Line by line, each with its own seeded timing: opacity fast, blur slow, a little rise and tilt that overshoot and settle."
        simple={
          <div>
            <h3 className={`max-w-[22ch] font-sans text-[32px] leading-[1.1] tracking-tight text-ink transition-all duration-700 ${on ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}>{TITLE}</h3>
            <button className="mt-4 font-serif text-[15px] italic text-ink-muted underline underline-offset-4" onClick={() => setOn((v) => !v)}>toggle</button>
          </div>
        }
        crafted={
          <div>
            <SettleText ref={settle} text={TITLE} as="h3" className="max-w-[22ch] font-sans text-[32px] leading-[1.1] tracking-tight text-ink" />
            <ToggleSettle handle={settle} />
          </div>
        }
      />

      <Pair
        title="A single drifting petal"
        note="A real petal from the owner's photograph. It tumbles on an arc with air drag. Move the pointer near it, or tap to flick it."
        simple={<div className="relative h-[210px] w-full overflow-hidden"><span className="lab-fall absolute left-1/3 top-0 h-5 w-5 rounded-full bg-[#e9b9c6]" /></div>}
        crafted={<DriftingPetal width={54} className="h-[210px] w-full" />}
      />

      <Pair
        title="CSS linear() spring"
        note="A generated spring easing in plain CSS: interruptible, compositor-only. Hover the swatch and move out quickly."
        simple={<div className="h-10 w-10 rounded-md bg-ink-faint transition-transform duration-500 ease-in-out hover:translate-x-32" />}
        crafted={<div className="lab-spring-demo h-10 w-10 rounded-md bg-accent hover:translate-x-32" />}
      />
    </main>
  )
}

function ToggleSettle({ handle }: { handle: React.RefObject<SettleHandle | null> }) {
  const [on, setOn] = useState(true)
  return (
    <button
      className="mt-4 min-h-[44px] font-serif text-[15px] italic text-ink-muted underline underline-offset-4"
      onClick={() => {
        handle.current?.settle(!on)
        setOn(!on)
      }}
    >
      {on ? 'unsettle' : 'settle'}
    </button>
  )
}
