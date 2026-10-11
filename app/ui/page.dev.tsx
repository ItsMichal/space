import { Timeline, type TimelineItem } from '@/components/ui/Timeline'
import { starlinkLaunches, starlinkDatedCount, STARLINK_JOINED_LABEL } from '@/content/starlink-launches'
import { getChildren } from '@/lib/content'
import { postPath } from '@/lib/seo'
import { profile } from '@/content/profile'

export const metadata = { title: 'UI kit (dev)', robots: { index: false } }

const h2 = 'mb-space-4 text-[26px] font-semibold leading-[1.1] tracking-[-0.02em]'

export default function Page() {
  const log: TimelineItem[] = getChildren('project-mountaintop').map((c) => ({
    id: c.slug,
    date: c.date,
    title: c.title,
    summary: c.description,
    image: c.cover ? { src: c.cover, alt: c.coverAlt ?? '' } : undefined,
    link: { href: postPath(c), label: 'Read the entry' },
  }))
  const exp: TimelineItem[] = [...profile.experience].sort((a, b) => ('since' in a ? Number(a.since) : 9999) - ('since' in b ? Number(b.since) : 9999)).map((e) => ({
    id: e.company,
    date: 'since' in e ? e.since : undefined,
    dateLabel: 'years' in e ? e.years : 'Ongoing',
    title: e.company,
    summary: e.role,
  }))
  return (
    <div className="mx-auto max-w-content px-space-4 pb-space-24 pt-[120px] md:px-space-8">
      <h1 className="mb-space-12 text-[clamp(36px,11vw,56px)] font-semibold leading-none tracking-[-0.03em]">UI kit</h1>

      <section className="mb-space-16" aria-labelledby="t1">
        <h2 id="t1" className={h2}>
          Timeline: experience
        </h2>
        <div className="max-w-[640px]">
          <Timeline items={exp} label="Experience (dev)" statusLabel="Experience" />
        </div>
      </section>

      <section className="mb-space-16" aria-labelledby="t2">
        <h2 id="t2" className={h2}>
          Timeline: Mountaintop log
        </h2>
        <div className="max-w-[640px]">
          <Timeline items={log} label="Project Mountaintop progress log" initial={0} statusLabel="Mountaintop" />
        </div>
      </section>

      <section className="mb-space-16" aria-labelledby="t3">
        <h2 id="t3" className={h2}>
          Timeline: Starlink launches since {STARLINK_JOINED_LABEL}
        </h2>
        <p className="mb-space-4 max-w-[56ch] font-serif text-ink-muted">
          {starlinkDatedCount} sourced markets, high and medium confidence only.
        </p>
        <div className="max-w-[760px]">
          <Timeline items={starlinkLaunches} label="Starlink launches since I joined" initial={0} statusLabel="Starlink" withDay />
        </div>
      </section>
    </div>
  )
}
