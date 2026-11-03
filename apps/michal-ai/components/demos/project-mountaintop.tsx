import { Count, Stage, Window, type Act } from '@/components/stageshow/kit'
import './project-mountaintop.css'

// Project Mountaintop, the hiking rhythm game. Beats: notes come down four
// lanes to the hit line in time with the song; each one is hit, the combo
// counts up and the hiker climbs; a Perfect flashes on the hit. Plays once.
//
// Real strings: the game's name and its idea (each hit is a step up the
// mountain, the level made from the song's MIDI).

const LANES = 4
const HIT = 360
const SPEED = 26
// [beat it is hit on, lane]
const NOTES: [number, number][] = [
  [8, 0], [10, 2], [12, 1], [13, 3], [15, 0], [16, 2], [18, 1], [19, 3], [21, 2], [22, 0], [24, 1], [25, 3], [27, 2], [28, 1], [30, 0], [31, 3], [33, 2], [34, 0], [36, 1], [37, 3],
]
const BEATS = 25

type S = { beat: number }
const initial: S = { beat: 0 }
const poster: S = { beat: 25 }

async function script(a: Act<S>) {
  await a.wait(400)
  a.mark('play')
  for (let b = 1; b <= BEATS; b++) {
    a.put({ beat: b })
    await a.wait(150)
  }
  await a.wait(2200)
}

export default function ProjectMountaintop() {
  return (
    <Stage<S> width={800} height={500} compact={{ below: 600, width: 400, height: 250 }} initial={initial} poster={poster} script={script} play="once" theme="dark" className="mt">
      {(s) => {
        const hit = NOTES.filter(([t]) => t <= s.beat)
        const last = hit[hit.length - 1]
        const fresh = last && s.beat - last[0] < 2
        return (
          <Window title="Project Mountaintop" className="dm-win mt-win">
            <div className="mt-page">
              <div className="mt-lanes">
                {Array.from({ length: LANES }, (_, l) => (
                  <div key={l} className="mt-lane" data-hit={fresh && last[1] === l ? '' : undefined} />
                ))}
                <div className="mt-line" style={{ top: HIT }} />
                {NOTES.map(([t, l]) =>
                  t > s.beat && HIT - (t - s.beat) * SPEED > -30 ? <span key={t} className="mt-note" style={{ left: l * 70 + 10, top: HIT - (t - s.beat) * SPEED - 10 }} /> : null,
                )}
                <span className="mt-perfect" data-on={fresh || undefined} key={last?.[0]}>
                  Perfect
                </span>
              </div>
              <div className="mt-side">
                <div className="mt-stat">
                  <span>Combo</span>
                  <Count value={hit.length} className="mt-big" />
                </div>
                <div className="mt-stat">
                  <span>Altitude</span>
                  <span className="mt-big">
                    <Count value={1800 + hit.length * 85} format={(n) => n.toLocaleString('en-US')} /> m
                  </span>
                </div>
              </div>
            </div>
          </Window>
        )
      }}
    </Stage>
  )
}
