import { Badge, Bar, Collapse, Facepile, Meter, Stage, Window, type Act } from '@/components/stageshow/kit'
import './isat-dashboard.css'

// The iSAT teacher dashboard. Beats: four groups at work, each with how much
// of the talk is shared; one group's activity drops; an insight opens at the
// top naming the group, and its card is marked. Plays once.
//
// Real strings: the groups, the activity labels, the insight.

type S = { quiet: boolean; insight: boolean }
const initial: S = { quiet: false, insight: false }
const poster: S = { quiet: true, insight: true }

const GROUPS = [
  { name: 'Group 1', people: ['Ana', 'Ben', 'Cy'], share: 0.72, doing: 'Explaining a solution' },
  { name: 'Group 2', people: ['Dee', 'Eli', 'Fay'], share: 0.64, doing: 'Asking questions' },
  { name: 'Group 3', people: ['Gus', 'Hal', 'Ida'], share: 0.58, doing: 'Planning' },
  { name: 'Group 4', people: ['Jo', 'Kai', 'Lu'], share: 0.8, doing: 'Building on ideas' },
]
const QUIET = 2

async function script(a: Act<S>) {
  await a.wait(1100)
  a.mark('quiet')
  a.put({ quiet: true })
  await a.wait(900)
  a.mark('insight')
  a.put({ insight: true })
  await a.wait(2600)
}

export default function IsatDashboard() {
  return (
    <Stage<S> width={800} height={500} compact={{ below: 600, width: 400, height: 250 }} initial={initial} poster={poster} script={script} play="once" className="is">
      {(s) => (
        <Window title="Classroom: Period 3" className="dm-win is-win">
          <div className="is-page">
            <Collapse open={s.insight} reveal="drop">
              <div className="is-insight">
                <Badge tone="warning" dot>
                  Insight
                </Badge>
                <span>Group 3 has been quiet for 4 minutes</span>
              </div>
            </Collapse>
            <div className="is-grid">
              {GROUPS.map((g, i) => {
                const quiet = i === QUIET && s.quiet
                return (
                  <div key={g.name} className="is-card" data-flag={quiet && s.insight ? '' : undefined}>
                    <div className="is-top">
                      <span className="is-name">{g.name}</span>
                      <Facepile names={g.people} size={20} />
                    </div>
                    <span className="is-doing">{quiet ? 'Quiet' : g.doing}</span>
                    <Meter value={quiet ? 0.12 : g.share} tone={quiet ? 'warning' : 'success'} />
                    <Bar w="62%" h={6} tone={1} className="dm-wide" />
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
