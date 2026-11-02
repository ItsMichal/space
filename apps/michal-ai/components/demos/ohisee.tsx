import { Avatar, Bar, Collapse, Count, Meter, Stage, Window, type Act } from '@/components/stageshow/kit'
import './ohisee.css'

// OhISee in a stream chat. Beats: a viewer takes a note (the notepad emoji
// and an emote); the bot saves it, tagged with the game on stream; someone
// types !Quiz; the bot asks a multiple-choice question and the votes come in.
// Plays once.
//
// Real strings: the command names, the note format, the bot's replies.

type S = { note: boolean; saved: boolean; quiz: boolean; poll: boolean; votes: [number, number, number] }
const initial: S = { note: false, saved: false, quiz: false, poll: false, votes: [0, 0, 0] }
const poster: S = { note: true, saved: true, quiz: true, poll: true, votes: [4, 17, 3] }

const OPTIONS = ['A) Morph ball', 'B) Wall jump', 'C) Speed booster']

async function script(a: Act<S>) {
  await a.wait(700)
  a.mark('note')
  a.put({ note: true })
  await a.wait(800)
  a.put({ saved: true })
  await a.wait(1000)
  a.mark('quiz')
  a.put({ quiz: true })
  await a.wait(700)
  a.put({ poll: true })
  await a.wait(500)
  a.put({ votes: [4, 17, 3] })
  await a.wait(2600)
}

function Msg({ who, children, bot }: { who: string; children: React.ReactNode; bot?: boolean }) {
  return (
    <div className="oh-msg" data-bot={bot || undefined}>
      <Avatar name={who} size={20} />
      <span className="oh-who">{who}</span>
      <span className="oh-text">{children}</span>
    </div>
  )
}

export default function OhISee() {
  return (
    <Stage<S> width={800} height={500} compact={{ below: 600, width: 400, height: 250 }} initial={initial} poster={poster} script={script} play="once" theme="dark" className="oh">
      {(s) => {
        const total = s.votes[0] + s.votes[1] + s.votes[2]
        return (
          <Window title="Stream chat" className="dm-win oh-win">
            <div className="oh-page">
              <div className="oh-past dm-wide">
                {[52, 38, 64].map((w, i) => (
                  <div key={i} className="oh-msg">
                    <Bar w={20} h={20} r={10} tone={2} />
                    <Bar w={`${w}%`} h={9} tone={2} />
                  </div>
                ))}
              </div>
              <Collapse open={s.note} reveal="drop">
                <Msg who="speedfan42">📝 PogChamp the wall jump here saves 40 seconds</Msg>
              </Collapse>
              <Collapse open={s.saved} reveal="drop">
                <Msg who="OhISee" bot>
                  Saved note #12 for Super Metroid
                </Msg>
              </Collapse>
              <Collapse open={s.quiz} reveal="drop">
                <Msg who="lurker_ok">!Quiz</Msg>
              </Collapse>
              <Collapse open={s.poll} reveal="drop">
                <div className="oh-poll">
                  <span className="oh-q">Which trick saves 40 seconds?</span>
                  {OPTIONS.map((o, i) => (
                    <div key={o} className="oh-opt">
                      <span className="oh-label">{o}</span>
                      <Meter value={total ? s.votes[i] / total : 0} tone={i === 1 ? 'success' : 'ink'} />
                      <Count value={s.votes[i]} className="oh-n" />
                    </div>
                  ))}
                </div>
              </Collapse>
            </div>
          </Window>
        )
      }}
    </Stage>
  )
}
