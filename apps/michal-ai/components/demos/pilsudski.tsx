import { Avatar, Bar, Collapse, Count, Field, Meter, Stage, Stream, Window, type Act } from '@/components/stageshow/kit'
import './pilsudski.css'

// A dialogue with Kaiser Wilhelm II (the class project behind Pilsudski).
// Beats: a question is typed and sent; the Kaiser answers, his words arriving
// one by one; his temperament rises with the question. Plays once.
//
// Real strings: the question, the answer, the temperament scale.

const Q = 'Why did Germany back Austria-Hungary in 1914?'
const A = 'We stand by our ally. Russia mobilizes on our border, and Germany will not wait to be encircled.'
const WORDS = A.split(' ').length

type S = { draft: string; sent: boolean; words: number; temper: number }
const initial: S = { draft: '', sent: false, words: 0, temper: 10 }
const poster: S = { draft: '', sent: true, words: WORDS, temper: 14 }

async function script(a: Act<S>) {
  await a.wait(600)
  a.mark('ask')
  await a.type('draft', Q, { interval: 40 })
  await a.wait(300)
  a.put({ sent: true, draft: '' })
  await a.wait(900)
  a.mark('answer')
  a.put({ temper: 14 })
  for (let i = 1; i <= WORDS; i++) {
    a.put({ words: i })
    await a.wait(70)
  }
  await a.wait(2400)
}

export default function Pilsudski() {
  return (
    <Stage<S> width={800} height={500} compact={{ below: 600, width: 400, height: 250 }} initial={initial} poster={poster} script={script} play="once" className="pi">
      {(s) => (
        <Window title="Kaiser Wilhelm II" className="dm-win pi-win">
          <div className="pi-page">
            <div className="pi-head">
              <Avatar name="Wilhelm" size={30} />
              <span className="pi-name">Kaiser Wilhelm II</span>
              <span className="pi-temper">
                Temperament <Count value={s.temper} /> / 20
              </span>
              <Meter className="pi-meter" value={s.temper / 20} tone={s.temper > 12 ? 'warning' : 'ink'} />
            </div>
            <div className="pi-thread">
              <div className="pi-past dm-wide">
                <Bar w={200} h={30} r={15} tone={1} />
                <Bar w="84%" h={8} r={4} tone={2} />
                <Bar w="58%" h={8} r={4} tone={2} />
              </div>
              <Collapse open={s.sent} reveal="drop" from="below">
                <div className="pi-q">{Q}</div>
              </Collapse>
              <Collapse open={s.sent && s.words > 0}>
                <Stream className="pi-a" text={A} count={s.words} />
              </Collapse>
            </div>
            <Field className="pi-composer" value={s.draft} placeholder="Ask the Kaiser" focused={!s.sent} />
          </div>
        </Window>
      )}
    </Stage>
  )
}
