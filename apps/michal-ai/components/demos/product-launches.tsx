import { Badge, Count, Spinner, Stage, Window, type Act } from '@/components/stageshow/kit'
import './product-launches.css'

// Starlink launches: one market of many goes live. Beats: the grid of markets,
// all live but one, Scheduled; it turns to Launching with a spinner; it goes
// Live on the same pill and the count of live markets ticks up. Plays once.
//
// Real strings: the market names, the statuses, the counter.

type S = { state: 'scheduled' | 'launching' | 'live' }
const initial: S = { state: 'scheduled' }
const poster: S = { state: 'live' }

const MARKETS = ['United States', 'Canada', 'Japan', 'Brazil', 'Philippines', 'Kenya', 'Poland', 'Indonesia', 'Mexico', 'Chile', 'Spain', 'Australia']
const NEW = 4

async function script(a: Act<S>) {
  await a.wait(900)
  a.mark('launch')
  a.put({ state: 'launching' })
  await a.wait(1500)
  a.mark('live')
  a.put({ state: 'live' })
  await a.wait(2600)
}

export default function ProductLaunches() {
  return (
    <Stage<S> width={800} height={500} compact={{ below: 600, width: 400, height: 250 }} initial={initial} poster={poster} script={script} play="once" className="pl">
      {(s) => (
        <Window title="Launches" className="dm-win pl-win">
          <div className="pl-page">
            <div className="pl-head">
              <span className="pl-title">Starlink Mini</span>
              <span className="pl-count">
                <Count value={s.state === 'live' ? 12 : 11} /> of 12 markets live
              </span>
            </div>
            <div className="pl-grid">
              {MARKETS.map((m, i) => {
                const st = i === NEW ? s.state : 'live'
                return (
                  <div key={m} className="pl-tile" data-new={i === NEW || undefined}>
                    <span className="pl-name">{m}</span>
                    <Badge
                      tone={st === 'live' ? 'success' : 'neutral'}
                      dot={st !== 'launching'}
                      icon={st === 'launching' ? <Spinner size={9} /> : undefined}
                      className="pl-badge"
                    >
                      {st === 'live' ? 'Live' : st === 'launching' ? 'Launching' : 'Scheduled'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>
        </Window>
      )}
    </Stage>
  )
}
