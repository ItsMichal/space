import { Code, Stage, Window, type Act } from '@/components/stageshow/kit'
import './intro-to-web-dev.css'

// The workshop's first React component. Beats: the component is written line
// by line; its preview appears beside it; the button is clicked three times
// and the count follows. Plays once; the still is the third click.
//
// Real strings: the code, the file name, the button's label.

const LINES = [
  "import { useState } from 'react'",
  '',
  'export default function App() {',
  '  const [count, setCount] = useState(0)',
  '  return (',
  '    <button onClick={() => setCount(count + 1)}>',
  '      Clicked {count} times',
  '    </button>',
  '  )',
  '}',
]

type S = { lines: number; preview: boolean; count: number; press: boolean }
const initial: S = { lines: 0, preview: false, count: 0, press: false }
const poster: S = { lines: LINES.length, preview: true, count: 3, press: false }

async function script(a: Act<S>) {
  await a.wait(500)
  a.mark('write')
  for (let i = 1; i <= LINES.length; i++) {
    a.put({ lines: i })
    await a.wait(LINES[i - 1] ? 230 : 80)
  }
  await a.wait(300)
  a.mark('preview')
  a.put({ preview: true })
  await a.wait(700)
  await a.move('btn')
  for (let n = 1; n <= 3; n++) {
    await a.click()
    a.put({ count: n })
    await a.wait(380)
  }
  await a.wait(2200)
}

export default function IntroToWebDev() {
  return (
    <Stage<S>
      width={800}
      height={500}
      compact={{ below: 600, width: 400, height: 250 }}
      initial={initial}
      poster={poster}
      script={script}
      play="once"
      cursor={{ at: { wide: { x: 760, y: 470 }, compact: { x: 380, y: 236 } } }}
      className="wd"
    >
      {(s) => (
        <>
          <Window title="App.jsx" className="dm-win wd-win">
            <div className="wd-ed">
              <Code lines={LINES} count={s.lines} />
            </div>
          </Window>
          <div className="wd-preview" data-on={s.preview || undefined}>
            <span className="wd-url">localhost:5173</span>
            <div className="wd-body">
              <span className="wd-btn" data-target="btn">
                Clicked {s.count} times
              </span>
            </div>
          </div>
        </>
      )}
    </Stage>
  )
}
