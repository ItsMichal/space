import { Avatar, Badge, Bar, Collapse, Stage, Stream, Window, type Act } from '@/components/stageshow/kit'
import './ai-crofty.css'

// AI Croft: telemetry from the F1 game turned into live commentary. Beats:
// packets come off the game as typed lines; the bot in the league's voice
// channel starts speaking and its line streams; the race goes on. Plays once.
//
// Real strings: the kind of packet data, the pipeline's output (a spoken line
// in the league Discord).

const PACKETS = [
  'LAP 23  P4  GAP +0.412',
  'S2 1:31.442  DRS OPEN',
  'TYRE SOFT 38%  ERS 61%',
  'CAR AHEAD  GAP +0.198',
  'OVERTAKE  P3',
]
const LINE = 'Into turn one, and he has done it! Up to third, on tyres that are hanging on by a thread.'

type S = { packets: number; speaking: boolean; words: number }
const initial: S = { packets: 1, speaking: false, words: 0 }
const poster: S = { packets: PACKETS.length, speaking: true, words: 99 }

async function script(a: Act<S>) {
  await a.wait(500)
  a.mark('telemetry')
  for (let i = 2; i <= PACKETS.length; i++) {
    a.put({ packets: i })
    await a.wait(360)
  }
  await a.wait(300)
  a.mark('speak')
  a.put({ speaking: true })
  await a.wait(400)
  const n = LINE.split(' ').length
  for (let w = 1; w <= n; w++) {
    a.put({ words: w })
    await a.wait(90)
  }
  await a.wait(2400)
}

export default function AiCrofty() {
  return (
    <Stage<S> width={800} height={500} compact={{ below: 600, width: 400, height: 250 }} initial={initial} poster={poster} script={script} play="once" theme="dark" className="ac">
      {(s) => (
        <>
          <Window title="#race-control" className="dm-win ac-win">
            <div className="ac-page">
              <div className="ac-past dm-wide">
                {[46, 30].map((w, i) => (
                  <div key={i} className="ac-msg">
                    <Bar w={32} h={32} r={16} tone={2} />
                    <div className="ac-body">
                      <Bar w={90} h={10} tone={2} />
                      <Bar w={`${w}%`} h={10} tone={1} />
                    </div>
                  </div>
                ))}
              </div>
              <Collapse open={s.speaking} reveal="drop">
                <div className="ac-msg">
                  <Avatar name="AI Croft" size={32} />
                  <div className="ac-body">
                    <div className="ac-top">
                      <span className="ac-who">AI Croft</span>
                      <Badge tone="success" dot>
                        Speaking
                      </Badge>
                    </div>
                    <Stream text={LINE} count={s.words} className="ac-text" />
                  </div>
                </div>
              </Collapse>
            </div>
          </Window>
          <div className="ac-term">
            <span className="ac-term-head">udp :20777</span>
            {PACKETS.slice(0, s.packets).map((p) => (
              <div key={p} className="ac-pkt">
                {p}
              </div>
            ))}
          </div>
        </>
      )}
    </Stage>
  )
}
