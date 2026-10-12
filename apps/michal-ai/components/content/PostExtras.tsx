import { Timeline } from '@/components/ui/Timeline'
import { starlinkLaunches } from '@/content/starlink-launches'

/** Per-project additions that are not part of the markdown body. Keyed by slug; unknown slugs render nothing. */
export function PostExtras({ slug }: { slug: string }) {
  if (slug === 'starlink') return <StarlinkLaunches />
  return null
}

function StarlinkLaunches() {
  return (
    <section aria-labelledby="launches-h" className="postnav postextra card surface">
      <h2 id="launches-h" className="postnav__h">
        Launches since I joined
      </h2>
      <p className="postextra__lede">
        I joined on 15 April 2024. Here are launches since then that I could date and source.
      </p>
      <p className="postextra__hint">Drag, swipe or use the arrow keys.</p>
      <Timeline items={starlinkLaunches} label="Starlink markets opened since 15 April 2024" statusLabel="Starlink launches" withDay />
    </section>
  )
}
