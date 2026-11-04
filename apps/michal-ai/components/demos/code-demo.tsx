import { Code, Stage, Window, type Act } from '@/components/stageshow/kit'
import './code-demo.css'

// A project's own source, written out line by line in an editor window. No run, no output: the lines are copied from the
// project's repository, so nothing on screen is made up. Plays once; the still is the whole excerpt.

type S = { lines: number }

export function CodeDemo({ file, lines }: { file: string; lines: string[] }) {
  async function script(a: Act<S>) {
    await a.wait(500)
    for (let i = 1; i <= lines.length; i++) {
      a.put({ lines: i })
      await a.wait(lines[i - 1].trim() ? 170 : 60)
    }
    await a.wait(2400)
  }
  return (
    <Stage<S>
      width={800}
      height={500}
      compact={{ below: 600, width: 400, height: 250 }}
      initial={{ lines: 0 }}
      poster={{ lines: lines.length }}
      script={script}
      play="once"
      className="cd"
    >
      {(s) => (
        <Window title={file} className="dm-win cd-win">
          <div className="cd-ed">
            <Code lines={lines} count={s.lines} />
          </div>
        </Window>
      )}
    </Stage>
  )
}
