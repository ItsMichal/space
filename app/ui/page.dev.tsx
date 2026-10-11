import { Timeline, type TimelineItem } from '@/components/ui/Timeline'
import { Gallery } from '@/components/ui/Gallery'
import { FactRows } from '@/components/ui/FactRows'
import { Disclosure } from '@/components/ui/Disclosure'
import { NumberRoll } from '@/components/ui/NumberRoll'
import { PreviewLink } from '@/components/ui/PreviewLink'
import { StressToggle } from '@/components/ui/StressToggle'
import { Zoomable } from '@/components/media/Zoomable'
import { DemoSegmented, DemoPageControl } from './demos'
import { starlinkLaunches, STARLINK_JOINED_LABEL } from '@/content/starlink-launches'
import { getChildren, getPost } from '@/lib/content'
import { postPath } from '@/lib/seo'
import { profile } from '@/content/profile'

export const metadata = { title: 'UI kit (dev)', robots: { index: false } }

const h2 = 'mb-space-4 text-[26px] font-semibold leading-[1.1] tracking-[-0.02em]'
const sec = 'mb-space-16'

export default function Page() {
  const log: TimelineItem[] = getChildren('project-mountaintop').map((c) => ({
    id: c.slug,
    date: c.date,
    title: c.title,
    summary: c.description,
    image: c.cover ? { src: c.cover, alt: c.coverAlt ?? '' } : undefined,
    link: { href: postPath(c), label: 'Read the entry' },
  }))
  const exp: TimelineItem[] = [...profile.experience]
    .sort((a, b) => ('since' in a ? Number(a.since) : 9999) - ('since' in b ? Number(b.since) : 9999))
    .map((e) => ({ id: e.company, date: 'since' in e ? e.since : undefined, dateLabel: 'years' in e ? e.years : 'Ongoing', title: e.company, summary: e.role }))
  const mt = getPost('project-mountaintop')
  const slides = (mt?.gallery ?? []).map((g) => ({
    key: g.src,
    caption: g.caption,
    node: <Zoomable src={g.src} alt={g.alt} caption={g.caption} sizes="(min-width: 900px) 760px, 90vw" />,
  }))
  return (
    <div className="mx-auto max-w-content px-space-4 pb-space-24 pt-[120px] md:px-space-8">
      <h1 className="mb-space-12 text-[clamp(36px,11vw,56px)] font-semibold leading-none tracking-[-0.03em]">UI kit</h1>

      <section className={sec} aria-labelledby="t1">
        <h2 id="t1" className={h2}>Timeline: experience</h2>
        <StressToggle pick=".tl-tab">
          <div className="max-w-[640px]">
            <Timeline items={exp} label="Experience (dev)" statusLabel="Experience" />
          </div>
        </StressToggle>
      </section>

      <section className={sec} aria-labelledby="t2">
        <h2 id="t2" className={h2}>Timeline: Mountaintop log</h2>
        <div className="max-w-[640px]">
          <Timeline items={log} label="Project Mountaintop progress log" initial={0} statusLabel="Mountaintop" />
        </div>
      </section>

      <section className={sec} aria-labelledby="t3">
        <h2 id="t3" className={h2}>Timeline: Starlink launches since {STARLINK_JOINED_LABEL}</h2>
        <p className="mb-space-4 max-w-[56ch] font-serif text-ink-muted">
          {starlinkDatedCount} sourced markets, high and medium confidence only. Roughly <NumberRoll value={STARLINK_MARKETS_SINCE.value} /> new markets in all.
        </p>
        <div className="max-w-[760px]">
          <Timeline items={starlinkLaunches} label="Starlink launches since I joined" initial={0} statusLabel="Starlink" withDay />
        </div>
      </section>

      <section className={sec} aria-labelledby="g1">
        <h2 id="g1" className={h2}>Gallery and page control</h2>
        <StressToggle pick=".pc-hit">
          <div className="max-w-[900px]">
            <Gallery slides={slides} label="Mountaintop images (dev)" autoplayMs={4500} />
          </div>
        </StressToggle>
        <p className="mb-space-2 mt-space-8 font-serif text-ink-muted">Page control alone (10 pages, autoplay running):</p>
        <DemoPageControl />
      </section>

      <section className={sec} aria-labelledby="s1">
        <h2 id="s1" className={h2}>Segmented control</h2>
        <StressToggle pick=".seg-opt">
          <DemoSegmented />
        </StressToggle>
      </section>

      <section className={sec} aria-labelledby="f1">
        <h2 id="f1" className={h2}>Fact rows</h2>
        <FactRows
          facts={[
            { label: 'Year', value: '2023 – 2024' },
            { label: 'Role', value: 'Game developer, UI/UX and music' },
            { label: 'Stack', value: 'Unity · Arduino · C#' },
            { label: 'Links', value: <a href="https://www.youtube.com/watch?v=Gv-xMeMM8m4">Gameplay video</a> },
          ]}
        />
      </section>

      <section className={sec} aria-labelledby="d1">
        <h2 id="d1" className={h2}>Disclosure</h2>
        <StressToggle pick=".dc-btn">
          <div className="max-w-[640px]">
            <Disclosure summary="More about this project">
              <p>The poles carry an accelerometer each; the Unity build reads them over serial and judges hits against the beat map. I wrote the score, the UI and the controller firmware.</p>
              <p className="mt-space-3">The first build ran on a laptop and two breadboards. The second one fit inside the pole handles.</p>
            </Disclosure>
            <Disclosure summary="How was the music made?">
              <p>Short loops, layered by hand, then stretched to match each level&apos;s pace.</p>
            </Disclosure>
          </div>
        </StressToggle>
      </section>

      <section className={sec} aria-labelledby="p1">
        <h2 id="p1" className={h2}>Preview link</h2>
        <p className="max-w-[56ch] font-serif text-[19px] leading-[1.55]">
          Hover (or press and hold on a phone) the link to see{' '}
          <PreviewLink
            href="/projects/project-mountaintop"
            preview={{ title: mt?.title ?? '', description: mt?.description ?? '', image: mt?.cover, meta: '2023' }}
          >
            Project Mountaintop
          </PreviewLink>{' '}
          without leaving the page.
        </p>
      </section>

      <section className={sec} aria-labelledby="n1">
        <h2 id="n1" className={h2}>Number roll</h2>
        <p className="font-serif text-[40px] leading-none">
          <NumberRoll value={1270} text="1,270" /> <span className="text-[18px] text-ink-muted">scroll down and up to see it only once</span>
        </p>
      </section>
    </div>
  )
}
