import { MoodStage } from '@/components/mood/MoodStage'
import { Specimen } from '@/components/mood/Specimen'
import { TypeHero } from '@/components/mood/TypeHero'
import { fraunces, instrument } from '@/components/mood/fonts'
import { profile } from '@/content/profile'

// Dev-only prototype (page.dev.tsx is not built for production). Judge the mood here; nothing leaks to the live site.
export const metadata = { title: 'Mood', robots: { index: false } }

type Sw = { name: string; value: string; note: string }
const tints: Sw[] = [
  { name: 'paper (airier)', value: '#f8f6ef', note: 'Was #f4f1e8. Ink 15.3:1, muted 6.5:1.' },
  { name: 'sky', value: '#dcebf1', note: 'The top of the wash. Fill only; ink 13.5:1, muted 5.0:1 on it.' },
  { name: 'aqua', value: '#3f9db3', note: 'Water drops, glass highlights. 2.9:1. Marks only, never text.' },
  { name: 'aqua-deep', value: '#23788c', note: 'The same water as a line or small icon. 4.7:1.' },
  { name: 'leaf', value: '#5f9a4f', note: 'Lusher green beside moss. 3.1:1. Marks only.' },
  { name: 'moss (existing accent)', value: '#3d6a35', note: 'Unchanged. 5.9:1 on the new paper.' },
]

function Brush({ className = '' }: { className?: string }) {
  // A hand-drawn underline: one path, wobbled by feTurbulence so no two renders look machine-straight.
  return (
    <svg aria-hidden="true" viewBox="0 0 320 14" className={className} preserveAspectRatio="none">
      <defs>
        <filter id="wob" x="-5%" y="-80%" width="110%" height="260%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035 0.2" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" />
        </filter>
      </defs>
      <path d="M3 8 C60 3, 120 11, 190 6 S290 7, 317 5" fill="none" stroke="var(--accent)" strokeOpacity="0.7" strokeWidth="2.6" strokeLinecap="round" filter="url(#wob)" />
    </svg>
  )
}

export default function MoodPage() {
  return (
    <div className={`${instrument.variable} ${fraunces.variable}`}>
      <MoodStage shadow={<Specimen id="eriophorum" width="min(70vw, 760px)" />}>
        <div className="mx-auto max-w-content px-space-4 md:px-space-8">
          <section className="relative min-h-[100svh]">
            <div className="mood-hero-art" aria-hidden="true">
              <div className="mood-drift">
                <div className="mood-arrive">
                  <div className="mood-sway">
                    <Specimen id="lupinus" width="clamp(190px, 36vw, 470px)" priority />
                  </div>
                </div>
              </div>
            </div>
            <div className="relative z-10">
              <TypeHero first={profile.firstName} last={profile.lastName} role={profile.role} intro={profile.intro} />
            </div>
          </section>

          <section className="relative mt-space-8 min-h-[520px] md:min-h-[460px]" aria-label="Sprig beside a section">
            <div className="mood-rise relative z-10">
              <p className="max-w-[22ch] font-serif text-[30px] leading-[1.22] md:text-[44px]">Slowly, at the pace of the scroll.</p>
              <Brush className="mt-space-2 h-[12px] w-[180px] md:w-[240px]" />
              <p className="mt-space-4 max-w-[38ch] font-serif text-[18px] leading-[1.5] text-ink-muted">
                The specimen rises a little as you arrive and rests when you do. It sways a hair, over eighteen seconds. Nothing pins, snaps or holds the page.
              </p>
            </div>
            <div className="mood-rise absolute -right-[18px] bottom-0 md:bottom-auto md:right-[4%] md:top-0" aria-hidden="true">
              <div className="mood-sway">
                <Specimen id="silene" width="clamp(190px, 30vw, 360px)" />
              </div>
            </div>
          </section>

          <section className="relative mt-space-16" aria-label="Pressed flower beside a project">
            <h2 className="mb-space-6 font-serif text-[34px] leading-[1.1] md:text-[44px]">Selected work</h2>
            <div className="mood-rise relative border-t border-hairline py-space-6 pr-[34%] md:pr-[28%]">
              <p className="text-[21px] font-semibold leading-[1.25] tracking-[-0.01em]">Mountaintop</p>
              <p className="mt-space-1 max-w-[34ch] font-serif text-[17px] leading-[1.45] text-ink-muted">A pressed flower sits beside the featured project, as if tucked into the page.</p>
              <div className="absolute -right-[10px] top-1/2 -translate-y-1/2 md:right-0" aria-hidden="true">
                <div className="mood-sway">
                  <Specimen id="dryas" width="clamp(120px, 24vw, 280px)" style={{ transform: 'rotate(-6deg)' }} />
                </div>
              </div>
            </div>
            <div className="border-t border-hairline" />
          </section>

          <section className="mood-rise mt-space-16" aria-label="Shape language">
            <h2 className="mb-space-4 font-serif text-[34px] leading-[1.1] md:text-[44px]">Shapes that were drawn</h2>
            <div className="grid gap-space-6 md:grid-cols-3">
              <div>
                <svg viewBox="0 0 200 130" className="h-[130px] w-full" aria-hidden="true">
                  <defs>
                    <filter id="edge" x="-10%" y="-10%" width="120%" height="120%">
                      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="9" result="n" />
                      <feDisplacementMap in="SourceGraphic" in2="n" scale="5" />
                      <feGaussianBlur stdDeviation="0.5" />
                    </filter>
                  </defs>
                  <path d="M40 70 C30 28 82 10 118 24 C158 36 176 70 150 98 C122 126 52 120 40 70 Z" fill="#dcebf1" stroke="#23788c" strokeOpacity="0.35" strokeWidth="1.2" filter="url(#edge)" />
                </svg>
                <p className="mt-space-2 font-serif text-[16px] leading-[1.4] text-ink-muted">A blob with a watercolor edge, where a circle or a pill would be: a frame, a hover wash, a section marker.</p>
              </div>
              <div>
                <svg viewBox="0 0 200 130" className="h-[130px] w-full" aria-hidden="true">
                  <path d="M10 70 C50 50 80 90 110 66 S170 52 192 70" fill="none" stroke="var(--ink-faint)" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M104 68 C98 52 114 40 122 54 C128 62 114 74 104 68 Z" fill="#c46f95" fillOpacity="0.75" />
                  <path d="M70 76 C66 92 82 100 88 88 C90 80 80 74 70 76 Z" fill="#5f9a4f" fillOpacity="0.6" />
                </svg>
                <p className="mt-space-2 font-serif text-[16px] leading-[1.4] text-ink-muted">A wandering line with a petal or two, in place of the perfect hairline. Rare.</p>
              </div>
              <div>
                <svg viewBox="0 0 200 130" className="h-[130px] w-full" aria-hidden="true">
                  <path d="M100 18 C130 52 140 78 112 104 C92 118 66 104 70 80 C72 56 90 44 100 18 Z" fill="#3f9db3" fillOpacity="0.22" stroke="#3f9db3" strokeOpacity="0.7" strokeWidth="1.4" />
                  <path d="M88 62 Q82 80 92 92 Q86 76 88 62 Z" fill="#fff" fillOpacity="0.9" />
                </svg>
                <p className="mt-space-2 font-serif text-[16px] leading-[1.4] text-ink-muted">The water drop: lopsided, clear, one highlight. It rests on a leaf and never floats alone.</p>
              </div>
            </div>
          </section>

          <section className="mood-rise relative mt-space-16 pb-space-24" aria-label="Proposed tints">
            <h2 className="mb-space-4 font-serif text-[34px] leading-[1.1] md:text-[44px]">Light, sky and water</h2>
            <ul className="grid gap-space-3 md:grid-cols-2">
              {tints.map((t) => (
                <li key={t.name} className="mood-swatch">
                  <span aria-hidden="true" className="mood-petal" style={{ background: t.value, border: '1px solid #18211b14' }} />
                  <span>
                    <span className="block text-[15px] font-medium">
                      {t.name} <span className="font-serif font-normal text-ink-muted">{t.value}</span>
                    </span>
                    <span className="block font-serif text-[14px] leading-[1.35] text-ink-muted">{t.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </MoodStage>
    </div>
  )
}
