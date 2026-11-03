import { Stage, Window, type Act } from '@/components/stageshow/kit'
import './airplane-game.css'

// Airplane Game, drawn the way airplane.html draws it: a 24 by 32 tile grid,
// black on white, the plane a three tile body with a tail, one building per
// column. Beats: the plane flies right, drops two bombs, each flattens its
// building and the score goes up by its height; at the edge the plane comes
// down a row and turns. Plays once.
//
// Real strings: the game's own HUD (LVL, HI, SC with zero padding).

const X = 24
const Y = 32
const START = 5
const SKYLINE = [9, 14, 6, 17, 12, 4, 19, 10, 15, 7, 13, 18, 5, 11, 16, 8, 20, 6, 14, 9, 17, 3, 12, 10]
const DROPS = [6, 16]

type S = { x: number; y: number; right: boolean; bomb: { x: number; y: number } | null; heights: number[]; points: number }
const initial: S = { x: 1, y: START, right: true, bomb: null, heights: SKYLINE, points: 0 }

/** One game tick, as gameLoop() does it: move, turn at the edge, drop the bomb a row, flatten what it hits. */
function tick(s: S): S {
  let { x, y, right, bomb, heights, points } = s
  x += right ? 1 : -1
  if (right && x === X - 1) (right = false), y++
  else if (!right && x === 0) (right = true), y++
  if (bomb) {
    bomb = { x: bomb.x, y: bomb.y + 1 }
    if (bomb.y === Y - heights[bomb.x]) {
      points += heights[bomb.x]
      heights = heights.map((h, i) => (i === bomb!.x ? 0 : h))
      bomb = null
    }
  }
  return { x, y, right, bomb, heights, points }
}

function run(ticks: number) {
  let s = initial
  for (let t = 0; t < ticks; t++) {
    if (!s.bomb && DROPS.includes(s.x) && s.right) s = { ...s, bomb: { x: s.x, y: s.y + 1 } }
    s = tick(s)
  }
  return s
}

const TICKS = 34
const poster = run(TICKS)

async function script(a: Act<S>) {
  await a.wait(500)
  a.mark('fly')
  for (let t = 1; t <= TICKS; t++) {
    a.set(run(t))
    await a.wait(120)
  }
  await a.wait(2400)
}

const pad = (n: number) => String(n).padStart(5, '0')

export default function AirplaneGame() {
  return (
    <Stage<S> width={800} height={500} compact={{ below: 600, width: 400, height: 250 }} initial={initial} poster={poster} script={script} play="once" className="ap">
      {(s) => (
        <Window title="Airplane Game" className="dm-win ap-win">
          <div className="ap-game">
            <svg viewBox={`0 0 ${X} ${Y}`} preserveAspectRatio="none" className="ap-svg">
              {s.heights.map((h, i) => (h ? <rect key={i} x={i} y={Y - h} width={1} height={h} /> : null))}
              <rect x={s.x - 1} y={s.y} width={3} height={1} />
              <rect x={s.right ? s.x - 1 : s.x + 1} y={s.y - 1} width={1} height={1} />
              {s.bomb && <rect x={s.bomb.x} y={s.bomb.y} width={1} height={1} />}
            </svg>
            <div className="ap-hud">
              <span>LVL 01</span>
              <span>HI {pad(Math.max(120, s.points))}</span>
              <span>SC {pad(s.points)}</span>
            </div>
          </div>
        </Window>
      )}
    </Stage>
  )
}
