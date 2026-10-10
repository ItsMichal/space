'use client'

import { useEffect, useState } from 'react'

type Face = 'instrument' | 'fraunces' | 'michelangelus' | 'current'

const faces: { id: Face; label: string; note: string }[] = [
  { id: 'instrument', label: 'Instrument Serif', note: 'Narrow, calligraphic, display-first. Closest in proportion to Michelangelus. OFL.' },
  { id: 'fraunces', label: 'Fraunces', note: 'Soft, warm, a little wonky; the most floral. OFL, variable (opsz, SOFT).' },
  { id: 'michelangelus', label: 'Michelangelus', note: 'Your installed copy, if any (local font, never shipped). Otherwise Instrument Serif.' },
  { id: 'current', label: 'Today', note: 'Schibsted Grotesk name, Newsreader voice.' },
]

const display: Record<Face, string> = {
  instrument: 'font-[family-name:var(--font-instrument)] font-normal tracking-[-0.025em] leading-[0.92] text-[clamp(60px,18.5vw,80px)] md:text-[120px] lg:text-[136px]',
  fraunces:
    "font-[family-name:var(--font-fraunces)] font-normal tracking-[-0.035em] leading-[0.94] text-[clamp(48px,14.2vw,62px)] md:text-[96px] lg:text-[112px] [font-variation-settings:'SOFT'_60,'opsz'_144]",
  michelangelus:
    "font-[family-name:'Michelangelus_Local','Instrument_Serif',var(--font-instrument),serif] font-normal tracking-[-0.02em] leading-[0.94] text-[clamp(60px,18vw,78px)] md:text-[120px] lg:text-[136px]",
  current: 'font-sans font-semibold tracking-[-0.045em] leading-[0.9] text-[clamp(44px,14.4vw,56px)] md:text-[88px] lg:text-display-name',
}

export function TypeHero({ first, last, role, intro }: { first: string; last: string; role: string; intro: string }) {
  const [face, setFace] = useState<Face>('instrument')
  const [haveLocal, setHaveLocal] = useState<boolean | null>(null)

  useEffect(() => {
    let live = true
    document.fonts
      .load('16px "Michelangelus Local"')
      .then((f) => live && setHaveLocal(f.length > 0))
      .catch(() => live && setHaveLocal(false))
    return () => {
      live = false
    }
  }, [])

  const current = faces.find((f) => f.id === face)!
  return (
    <header className="pt-[110px] md:pt-[150px]">
      <h1 className={display[face]} lang="pl">
        <span className="block">{first}</span>
        <span className="block">{last}</span>
      </h1>
      <p className="mt-space-6 max-w-[40ch] font-serif text-[20px] italic leading-[1.35] text-ink-muted md:text-[24px]">{role}</p>
      <p className="mt-space-3 max-w-[28ch] font-serif text-[26px] leading-[1.28] md:text-[34px]">{intro}</p>
      <p lang="pl" className="mt-space-6 max-w-[40ch] font-serif text-[17px] leading-[1.5] text-ink-muted">
        Zażółć gęślą jaźń, Łódź, Kraków, Gdańsk, Michał. <em>Źdźbło, świt, żółć.</em>
      </p>

      <div role="group" aria-label="Typeface" className="mt-space-8 flex flex-wrap gap-space-2">
        {faces.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={face === f.id}
            onClick={() => setFace(f.id)}
            className={`min-h-[44px] rounded-full px-space-4 text-[15px] transition-colors duration-200 ${
              face === f.id ? 'bg-ink text-paper' : 'bg-paper-raised text-ink-muted hover:text-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p className="mt-space-2 max-w-[48ch] font-serif text-[15px] italic text-ink-muted">
        {current.note}
        {face === 'michelangelus' ? (haveLocal ? ' Found on this device.' : ' Not installed here, so you are seeing the fallback.') : ''}
      </p>
    </header>
  )
}
