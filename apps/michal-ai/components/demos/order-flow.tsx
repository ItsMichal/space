import { Badge, Bar, Collapse, Count, Field, Spinner, Stage, States, Window, type Act } from '@/components/stageshow/kit'
import './order-flow.css'

// The rewritten Starlink checkout. Beats: a service address is typed; a beat
// of checking coverage; Starlink is available; the order summary fills in and
// Due today counts up to the total. Plays once; the still is the full order.
//
// Real strings: the address, the coverage line, the summary rows and prices.
// The contact and payment fields are placeholder.

type S = { addr: string; check: 'idle' | 'busy' | 'ok'; rows: number }
const ADDR = '350 Fifth Ave, New York, NY'
const initial: S = { addr: '', check: 'idle', rows: 0 }
const poster: S = { addr: ADDR, check: 'ok', rows: 3 }

const ROWS = [
  { k: 'Standard Kit', v: '$349' },
  { k: 'Shipping', v: '$20' },
  { k: 'Residential, first month', v: '$120' },
]
const TOTAL = 489

async function script(a: Act<S>) {
  await a.wait(600)
  a.mark('type')
  await a.type('addr', ADDR, { interval: 42 })
  await a.wait(300)
  a.put({ check: 'busy' })
  await a.wait(1000)
  a.mark('available')
  a.put({ check: 'ok' })
  await a.wait(500)
  for (let i = 1; i <= ROWS.length; i++) {
    a.put({ rows: i })
    await a.wait(260)
  }
  await a.wait(2400)
}

export default function OrderFlow() {
  return (
    <Stage<S> width={800} height={500} compact={{ below: 600, width: 400, height: 250 }} theme="dark" initial={initial} poster={poster} script={script} play="once" className="of">
      {(s) => (
        <Window url="starlink.com/order" className="dm-win of-win">
          <div className="of-page">
            <div className="of-form">
              <span className="of-label">Service address</span>
              <Field className="of-field" value={s.addr} placeholder="Enter your address" focused={s.check === 'idle'} />
              <div className="of-check">
                <States
                  value={s.check}
                  align="start"
                  states={{
                    idle: <span />,
                    busy: (
                      <span className="of-busy">
                        <Spinner size={12} /> Checking coverage
                      </span>
                    ),
                    ok: (
                      <Badge tone="success" dot>
                        Starlink is available
                      </Badge>
                    ),
                  }}
                />
              </div>
              <div className="dm-wide of-rest">
                <span className="of-label">Contact</span>
                <Bar w="100%" h={34} r={8} tone={1} />
                <span className="of-label">Payment</span>
                <Bar w="100%" h={34} r={8} tone={1} />
              </div>
              <div className="dm-compact of-due-compact">
                <span>Due today</span>
                <Count value={s.rows >= 3 ? TOTAL : 0} format={(n) => `$${Math.round(n)}`} duration={900} />
              </div>
            </div>
            <aside className="of-sum dm-wide">
              <span className="of-sum__title">Order summary</span>
              {ROWS.map((r, i) => (
                <Collapse key={r.k} open={s.rows > i} reveal="drop">
                  <div className="of-row">
                    <span>{r.k}</span>
                    <span>{r.v}</span>
                  </div>
                </Collapse>
              ))}
              <div className="of-row of-row--total">
                <span>Due today</span>
                <Count value={s.rows >= 3 ? TOTAL : 0} format={(n) => `$${Math.round(n)}`} duration={900} />
              </div>
              <span className="of-pay">Place order</span>
            </aside>
          </div>
        </Window>
      )}
    </Stage>
  )
}
