import { Bar, Collapse, Field, Spinner, Stage, States, Window, type Act } from '@/components/stageshow/kit'
import './askawai.css'

// AskawAI: a worksheet from a topic. Beats: the topic is typed; Generate is
// pressed and works for a beat; questions arrive one by one, each with its
// answer; Export to DOCX appears under them. Plays once.
//
// Real strings: the topic, the questions and answers, the buttons.

type S = { topic: string; gen: 'idle' | 'busy' | 'done'; n: number; export: boolean }
const TOPIC = 'Photosynthesis'
const initial: S = { topic: '', gen: 'idle', n: 0, export: false }
const poster: S = { topic: TOPIC, gen: 'done', n: 3, export: true }

const QS = [
  { q: 'What gas do plants take in during photosynthesis?', a: 'Carbon dioxide' },
  { q: 'Where in the cell does photosynthesis happen?', a: 'The chloroplast' },
  { q: 'What are the two products of photosynthesis?', a: 'Glucose and oxygen' },
]

async function script(a: Act<S>) {
  await a.wait(500)
  a.mark('type')
  await a.type('topic', TOPIC, { interval: 60 })
  await a.wait(300)
  await a.move('gen')
  await a.click()
  a.put({ gen: 'busy' })
  await a.wait(1100)
  a.mark('questions')
  a.put({ gen: 'done' })
  for (let i = 1; i <= QS.length; i++) {
    a.put({ n: i })
    await a.wait(520)
  }
  a.put({ export: true })
  await a.wait(2400)
}

export default function Askawai() {
  return (
    <Stage<S>
      width={800}
      height={500}
      compact={{ below: 600, width: 400, height: 250 }}
      initial={initial}
      poster={poster}
      script={script}
      play="once"
      cursor={{ at: { wide: { x: 640, y: 300 }, compact: { x: 360, y: 200 } } }}
      className="aw"
    >
      {(s) => (
        <Window title="AskawAI" className="dm-win aw-win">
          <div className="aw-page">
            <div className="aw-bar">
              <Field className="aw-field" value={s.topic} placeholder="Enter a topic" focused={s.gen === 'idle'} />
              <span className="aw-gen" data-target="gen">
                <States value={s.gen === 'busy' ? 'busy' : 'idle'} states={{ idle: <span>Generate</span>, busy: <Spinner size={13} /> }} />
              </span>
            </div>
            <div className="aw-list">
              {QS.map((q, i) => (
                <Collapse key={q.q} open={s.n > i} reveal="drop">
                  <div className="aw-q">
                    <span className="aw-q__q">
                      {i + 1}. {q.q}
                    </span>
                    <span className="aw-q__a">{q.a}</span>
                  </div>
                </Collapse>
              ))}
            </div>
            <div className="aw-foot dm-in" data-on={s.export || undefined}>
              <span className="aw-export">Export to DOCX</span>
              <Bar w={90} h={6} tone={1} />
            </div>
          </div>
        </Window>
      )}
    </Stage>
  )
}
