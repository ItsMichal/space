import type { CSSProperties, ReactNode } from 'react'
import '@/components/micro/micro.css'
import { BlossomLean } from '@/components/micro/BlossomLean'
import { InkButton } from '@/components/micro/InkButton'
import { LeafShadow } from '@/components/micro/LeafShadow'
import { PetalFall } from '@/components/micro/PetalFall'
import { Replay } from '@/components/micro/Replay'
import { SlowImage } from '@/components/micro/SlowImage'

export const metadata = { title: 'Micro-interactions (dev)', robots: { index: false } }

const rows = [
  ['Mountaintop', 'A rhythm game that lets you stay on beat', '2024 · Unity'],
  ['Barcode Wizards', 'Office tooling with a sense of humor', '2023 · TypeScript'],
  ['F1 commentator', 'Realtime commentary from telemetry', '2025 · Python'],
]

function Sec({ n, title, note, children }: { n: number; title: string; note: string; children: ReactNode }) {
  return (
    <section className="m-sec">
      <p className="m-label">
        {n}. {title}: {note}
      </p>
      {children}
    </section>
  )
}

export default function MicroPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: 'var(--space-12) var(--space-4) var(--space-24)' }}>
      <Replay label="replay the title">
        <h1 className="m-settle" style={{ font: '600 clamp(44px, 9vw, 84px)/0.98 var(--font-sans)', letterSpacing: '-0.035em', margin: 0 }}>
          <span style={{ '--i': 0 } as CSSProperties}>Micro-</span>
          <span style={{ '--i': 1 } as CSSProperties}>interactions</span>
        </h1>
      </Replay>
      <p style={{ font: '400 21px/1.5 var(--font-serif)', color: 'var(--ink-muted)', maxWidth: '44ch', margin: 'var(--space-6) 0 var(--space-12)' }}>
        Ten quiet movements, each with a touch equivalent and a still frame under reduced motion. Hover, press, drag, or scroll. See{' '}
        <a className="m-tendril" href="#fn1">
          the footnote
        </a>
        .
      </p>

      <Sec n={1} title="Tendril underline" note="grows from the left, withdraws to the right">
        <p style={{ font: '400 21px/1.6 var(--font-serif)', margin: 0 }}>
          A{' '}
          <a className="m-tendril" href="#x">
            link in a sentence
          </a>{' '}
          and{' '}
          <a className="m-tendril" href="#y">
            another one close by
          </a>
          , so you can sweep between them.
        </p>
      </Sec>

      <Sec n={2} title="Settling title" note="two lines laid down 90ms apart over 1.4s (the title above)">
        <p style={{ font: '400 17px/1.6 var(--font-serif)', margin: 0, color: 'var(--ink-muted)' }}>Use the replay link at the top of the page.</p>
      </Sec>

      <Sec n={3} title="Slow arrival" note="opacity 1.4s, settle from 1.02 over 2.4s, once">
        <SlowImage src="/micro/hydrangea.jpg" alt="Hydrangea with soft bokeh" />
      </Sec>

      <Sec n={4} title="Breathing edge" note="the feathered edge inhales on hover, focus or press">
        <button
          type="button"
          className="m-edge"
          style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', background: 'none', border: 0, padding: 0 }}
          aria-label="Daylily photograph, press to let its edge breathe"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/micro/daylily.jpg" alt="Red and yellow daylily" />
        </button>
      </Sec>

      <Sec n={5} title="Blossom lean" note="move the pointer or drag a finger across; it leans a degree and settles">
        <BlossomLean src="/micro/cherry-blossom.jpg" alt="Cherry blossoms, softly out of focus" />
      </Sec>

      <Sec n={6} title="Ink-soak press" note="a stain from the exact press point, fading after release">
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <InkButton>Read the write-up</InkButton>
          <InkButton>Get in touch</InkButton>
        </div>
      </Sec>

      <Sec n={7} title="Row hairline growth" note="a moss line grows along the rule; the title leans 4px right">
        <div style={{ borderBottom: '1px solid var(--hairline)' }}>
          {rows.map(([t, d, m]) => (
            <a key={t} className="m-row" href="#row">
              <div>
                <div className="m-row__t">{t}</div>
                <div style={{ color: 'var(--ink-muted)', maxWidth: '56ch' }}>{d}</div>
              </div>
              <div className="m-row__m">{m}</div>
            </a>
          ))}
        </div>
      </Sec>

      <Sec n={8} title="Leaf shadow" note="an idle cloud-slow pass across the paper (40s)">
        <LeafShadow>
          <div style={{ padding: 'var(--space-16) var(--space-6)', background: 'var(--paper-raised)' }}>
            <p style={{ font: '400 24px/1.4 var(--font-serif)', margin: 0, maxWidth: '30ch' }}>Keep still for a while. A shadow will cross the paper.</p>
          </div>
        </LeafShadow>
      </Sec>

      <Sec n={9} title="Petal fall" note="one petal, once, when this section is first reached">
        <Replay label="replay the petal">
          <PetalFall>
            <div style={{ padding: 'var(--space-12) var(--space-6)', minHeight: 360, background: 'var(--paper-raised)', borderRadius: 12 }}>
              <p style={{ font: '400 24px/1.4 var(--font-serif)', margin: 0, maxWidth: '24ch' }}>Spring arrives a little at a time.</p>
            </div>
          </PetalFall>
        </Replay>
      </Sec>

      <Sec n={10} title="Footnote dew" note="jump here and the landing spot dries slowly">
        <p id="fn1" className="m-fn" style={{ font: '400 17px/1.6 var(--font-serif)', margin: 0, padding: 'var(--space-2) var(--space-3)', color: 'var(--ink-muted)' }}>
          1. The highlight at the target fades over 2.8s, starting after a short hold.
        </p>
      </Sec>
    </main>
  )
}
