import { Collapse, Count, Field, Stage, Window, type Act } from '@/components/stageshow/kit'
import './sea-of-thoughts.css'

// Sea of Thoughts. Beats: a thought is typed; Send puts it in a bottle and it
// floats off; a bottle from someone else washes up and opens. Plays once.
//
// Real strings: the idea (a short message in a bottle, read by whoever else is
// online), the count of people in the sea.

const MINE = 'I finally called my grandma back today'
const THEIRS = 'Whoever reads this: you are doing better than you think.'

type S = { text: string; sent: boolean; incoming: boolean }
const initial: S = { text: '', sent: false, incoming: false }
const poster: S = { text: '', sent: true, incoming: true }

async function script(a: Act<S>) {
  await a.wait(500)
  a.mark('write')
  await a.move('msg')
  await a.type('text', MINE, { interval: 45 })
  await a.wait(300)
  await a.move('send')
  await a.click()
  a.mark('send')
  a.put({ sent: true, text: '' })
  await a.wait(1300)
  a.mark('receive')
  a.put({ incoming: true })
  await a.wait(2600)
}

export default function SeaOfThoughts() {
  return (
    <Stage<S>
      width={800}
      height={500}
      compact={{ below: 600, width: 400, height: 250 }}
      initial={initial}
      poster={poster}
      script={script}
      play="once"
      cursor={{ at: { wide: { x: 600, y: 470 }, compact: { x: 300, y: 236 } } }}
      className="st"
    >
      {(s) => (
        <Window title="Sea of Thoughts" className="dm-win st-win">
          <div className="st-page">
            <span className="st-count">
              <Count value={s.incoming ? 14 : 13} /> people in the sea
            </span>
            <div className="st-write">
              <Field value={s.text} placeholder="Write a thought..." focused={!s.sent} className="st-field" data-target="msg" />
              <span className="st-send" data-target="send">
                Send
              </span>
            </div>
            <span className="st-gone" data-on={s.sent || undefined}>
              {MINE}
            </span>
            <Collapse open={s.incoming} reveal="drop">
              <div className="st-found">
                <span className="st-label">A bottle washed up</span>
                <span className="st-msg">{THEIRS}</span>
              </div>
            </Collapse>
            <div className="st-sea" />
          </div>
        </Window>
      )}
    </Stage>
  )
}
