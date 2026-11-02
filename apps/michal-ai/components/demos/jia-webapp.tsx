import { Bar, Collapse, Field, Stage, Stream, Text, Window, type Act } from '@/components/stageshow/kit'
import './jia-webapp.css'

// JIA: a tutor beside a worksheet. Beats: the student types where they are
// stuck and sends it; the tutor thinks for a beat; a hint streams in that
// points at the next step without giving the answer. Plays once.
//
// Real strings: the problem, the student's message, the hint.

const PROBLEM = 'A ball is dropped from a height of 20 m. How long does it take to reach the ground?'
const Q = "I don't know where to start"
const A = 'Start with what you know: it falls 20 m and starts at rest. Which equation links distance, acceleration and time?'
const WORDS = A.split(' ').length

type S = { draft: string; sent: boolean; phase: 'idle' | 'thinking' | 'answer'; words: number }
const initial: S = { draft: '', sent: false, phase: 'idle', words: 0 }
const poster: S = { draft: '', sent: true, phase: 'answer', words: WORDS }

async function script(a: Act<S>) {
  await a.wait(600)
  a.mark('type')
  await a.type('draft', Q, { interval: 45 })
  await a.wait(350)
  a.put({ sent: true, draft: '' })
  await a.wait(400)
  a.put({ phase: 'thinking' })
  await a.wait(1000)
  a.mark('hint')
  a.put({ phase: 'answer' })
  for (let i = 1; i <= WORDS; i++) {
    a.put({ words: i })
    await a.wait(55)
  }
  await a.wait(2400)
}

export default function JiaWebapp() {
  return (
    <Stage<S> width={800} height={500} compact={{ below: 600, width: 400, height: 250 }} initial={initial} poster={poster} script={script} play="once" className="ji">
      {(s) => (
        <Window title="Worksheet 3: Free fall" className="dm-win ji-win">
          <div className="ji-page">
            <section className="ji-sheet dm-wide">
              <span className="ji-num">Problem 2</span>
              <Text wrap className="ji-problem">
                {PROBLEM}
              </Text>
              <Bar w="100%" h={64} r={8} tone={1} />
              <span className="ji-num">Problem 3</span>
              <Bar w="92%" h={7} tone={2} />
              <Bar w="70%" h={7} tone={2} />
            </section>
            <section className="ji-chat">
              <div className="ji-thread">
                <Collapse open={s.sent} reveal="drop" from="below">
                  <div className="ji-q">{Q}</div>
                </Collapse>
                <Collapse open={s.phase === 'thinking'}>
                  <span className="ji-thinking">Thinking</span>
                </Collapse>
                <Collapse open={s.phase === 'answer'}>
                  <Stream className="ji-a" text={A} count={s.words} />
                </Collapse>
              </div>
              <Field className="ji-composer" value={s.draft} placeholder="Ask the tutor" focused={!s.sent} />
            </section>
          </div>
        </Window>
      )}
    </Stage>
  )
}
