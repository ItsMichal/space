import { Timeline } from '@/components/ui/Timeline'
import { NumberRoll } from '@/components/ui/NumberRoll'
import { starlinkLaunches, starlinkDatedCount, STARLINK_JOINED_LABEL, STARLINK_MARKETS_SINCE } from '@/content/starlink-launches'

/** Per-project additions that are not part of the markdown body. Keyed by slug; unknown slugs render nothing. */
export function PostExtras({ slug }: { slug: string }) {
  if (slug === 'spacex-starlink-general-projects') return <StarlinkLaunches />
  return null
}

function StarlinkLaunches() {
  return (
    <section aria-labelledby="launches-h" className="postnav postextra">
      <h2 id="launches-h" className="postnav__h">
        Launches since I joined
      </h2>
      <p className="postextra__lede">
        I joined on {STARLINK_JOINED_LABEL}. Since then Starlink has opened roughly{' '}
        <NumberRoll value={STARLINK_MARKETS_SINCE.value} className="postextra__num" /> new markets. Here are {starlinkDatedCount} of them
        that I could date and source, oldest on the left. Drag, swipe or use the arrow keys.
      </p>
      <Timeline items={starlinkLaunches} label="Starlink markets opened since 15 April 2024" statusLabel="Starlink launches" withDay />
    </section>
  )
}
