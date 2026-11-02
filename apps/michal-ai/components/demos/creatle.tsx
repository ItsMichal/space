import type { CSSProperties } from 'react'
import { Stage, Window, type Act } from '@/components/stageshow/kit'
import './creatle.css'

// Forty-twodle, one of the games made on Creatle: guess the equation that
// makes 42. Beats: the first guess is already scored; the second is typed and
// its tiles turn over one by one; the third is typed and every tile turns
// green; Solved. Plays once.
//
// Real strings: the game's name, the guesses, the result.

const TARGET = '100-58'
const ROWS = 4

type S = { r1: string; r2: string; scored: number; solved: boolean }
const initial: S = { r1: '', r2: '', scored: 1, solved: false }
const poster: S = { r1: '50-8+0', r2: TARGET, scored: 3, solved: true }

/** Wordle scoring: greens first, then yellows from what is left of the target. */
function score(guess: string): ('g' | 'y' | 'x')[] {
  const out: ('g' | 'y' | 'x')[] = Array(guess.length).fill('x')
  const left: string[] = []
  for (let i = 0; i < TARGET.length; i++) guess[i] === TARGET[i] ? (out[i] = 'g') : left.push(TARGET[i])
  for (let i = 0; i < guess.length; i++) {
    if (out[i] === 'g') continue
    const j = left.indexOf(guess[i])
    if (j >= 0) (out[i] = 'y'), left.splice(j, 1)
  }
  return out
}

async function script(a: Act<S>) {
  await a.wait(700)
  a.mark('guess')
  await a.type('r1', '50-8+0', { interval: 140 })
  await a.wait(250)
  a.put({ scored: 2 })
  await a.wait(1100)
  a.mark('solve')
  await a.type('r2', TARGET, { interval: 140 })
  await a.wait(250)
  a.put({ scored: 3 })
  await a.wait(900)
  a.put({ solved: true })
  await a.wait(2400)
}

export default function Creatle() {
  return (
    <Stage<S> width={800} height={500} compact={{ below: 600, width: 400, height: 250 }} initial={initial} poster={poster} script={script} play="once" className="cr">
      {(s) => {
        const rows = ['12*3+6', s.r1, s.r2, '']
        return (
          <Window title="Forty-twodle" className="dm-win cr-win">
            <div className="cr-page">
              <div className="cr-board">
                {Array.from({ length: ROWS }, (_, r) => {
                  const marks = r < s.scored ? score(rows[r]) : null
                  return (
                    <div key={r} className="cr-row">
                      {Array.from({ length: 6 }, (_, c) => (
                        <span key={c} className="cr-tile" data-filled={rows[r][c] ? '' : undefined} data-mark={marks?.[c]} style={{ '--i': c } as CSSProperties}>
                          {rows[r][c] ?? ''}
                        </span>
                      ))}
                      <span className="cr-eq">= 42</span>
                    </div>
                  )
                })}
              </div>
              <div className="cr-note dm-in" data-on={s.solved || undefined}>
                Solved in 3
              </div>
            </div>
          </Window>
        )
      }}
    </Stage>
  )
}
