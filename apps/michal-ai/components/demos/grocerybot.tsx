import type { CSSProperties } from 'react'
import { Bar, Check, Stage, States, Window, type Act } from '@/components/stageshow/kit'
import './grocerybot.css'

// Grocerybot: a shopping list on a small web page, and the robot that shops
// it in a simulated store. Beats: two more items are ticked; Shop is clicked;
// the robot drives aisle to aisle and the status follows it; it heads for
// checkout. Plays once.
//
// Real strings: the default list (oranges and beers), the flow (pick items,
// click shop, robot collects them, returns to checkout).

const ITEMS = ['Oranges', 'Beers', 'Eggs', 'Cereal']
// map positions (px inside the map) the robot drives through, and what it is doing there
const STOPS = [
  { x: 24, y: 220, say: 'Waiting for a list' },
  { x: 84, y: 60, say: 'Picking Oranges, aisle 1' },
  { x: 164, y: 150, say: 'Picking Beers, aisle 3' },
  { x: 244, y: 60, say: 'Picking Eggs, aisle 5' },
  { x: 244, y: 220, say: 'Heading to checkout' },
]

type S = { picked: boolean[]; shopping: boolean; stop: number }
const initial: S = { picked: [true, true, false, false], shopping: false, stop: 0 }
const poster: S = { picked: [true, true, true, false], shopping: true, stop: 4 }

async function script(a: Act<S>) {
  await a.wait(600)
  a.mark('list')
  await a.move('item-2')
  await a.click()
  a.put({ picked: [true, true, true, false] })
  await a.wait(400)
  await a.move('shop')
  await a.click()
  a.mark('shop')
  a.put({ shopping: true })
  for (let i = 1; i < STOPS.length; i++) {
    await a.wait(i === 1 ? 300 : 900)
    a.put({ stop: i })
  }
  await a.wait(2400)
}

export default function Grocerybot() {
  return (
    <Stage<S>
      width={800}
      height={500}
      compact={{ below: 600, width: 400, height: 250 }}
      initial={initial}
      poster={poster}
      script={script}
      play="once"
      cursor={{ at: { wide: { x: 420, y: 470 }, compact: { x: 220, y: 236 } } }}
      className="gb"
    >
      {(s) => {
        const at = STOPS[s.stop]
        return (
          <Window url="localhost:5000" className="dm-win gb-win">
            <div className="gb-page">
              <div className="gb-list">
                <span className="gb-head">Shopping list</span>
                {ITEMS.map((it, i) => (
                  <div key={it} className="gb-item" data-target={`item-${i}`}>
                    <Check on={s.picked[i]} />
                    {it}
                  </div>
                ))}
                <span className="gb-shop" data-target="shop" data-on={s.shopping || undefined}>
                  Shop
                </span>
              </div>
              <div className="gb-map">
                {[0, 1, 2].map((c) => (
                  <Bar key={c} w={40} h={150} r={4} tone={1} className="gb-aisle" style={{ left: 114 + c * 80 }} />
                ))}
                <span className="gb-till">Checkout</span>
                <span className="gb-bot" style={{ '--x': `${at.x}px`, '--y': `${at.y}px` } as CSSProperties} />
                <div className="gb-status">
                  <States align="start" value={String(s.stop)} states={Object.fromEntries(STOPS.map((p, i) => [String(i), p.say]))} />
                </div>
              </div>
            </div>
          </Window>
        )
      }}
    </Stage>
  )
}
