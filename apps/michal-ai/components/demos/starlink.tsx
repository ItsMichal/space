import { Badge, Bar, Count, Spinner, Stage, States, Window, type Act } from '@/components/stageshow/kit'
import './starlink.css'

// Starlink.com: choosing a plan on the order page. Beats: the cursor goes to
// Roam and picks it; the monthly price and the kit price roll to the new plan;
// Order now is pressed, a short spinner, and the order is placed. Plays once;
// the still is the placed order.
//
// Real strings: the wordmark, the page's one line, the address, the plans,
// their prices, the button. Nav and fine print are placeholder.

type S = { plan: 0 | 1; press: boolean; state: 'idle' | 'busy' | 'done' }
const initial: S = { plan: 0, press: false, state: 'idle' }
const poster: S = { plan: 1, press: false, state: 'done' }

const PLANS = [
  { name: 'Residential', price: 120, kit: 349, note: 'Unlimited data at home' },
  { name: 'Roam', price: 50, kit: 499, note: 'Starlink Mini, on the go' },
  { name: 'Residential Lite', price: 80, kit: 349, note: 'Deprioritized data' },
]
const usd = (n: number) => `$${Math.round(n)}`

async function script(a: Act<S>) {
  await a.wait(600)
  a.mark('pick')
  await a.move('plan-1')
  await a.click()
  a.put({ plan: 1 })
  await a.wait(1100)
  a.mark('order')
  await a.move('order')
  await a.click()
  a.put({ state: 'busy' })
  await a.wait(1000)
  a.put({ state: 'done' })
  await a.wait(2400)
}

export default function Starlink() {
  return (
    <Stage<S>
      width={800}
      height={500}
      compact={{ below: 600, width: 400, height: 250 }}
      theme="dark"
      initial={initial}
      poster={poster}
      script={script}
      play="once"
      cursor={{ at: { wide: { x: 700, y: 470 }, compact: { x: 360, y: 236 } } }}
      className="sl"
    >
      {(s) => {
        const plan = PLANS[s.plan]
        return (
          <Window url="starlink.com/residential" className="dm-win sl-win">
            <div className="sl-page">
              <div className="sl-nav dm-wide">
                <span className="sl-mark">STARLINK</span>
                <Bar w={52} h={6} tone={2} />
                <Bar w={44} h={6} tone={2} />
                <Bar w={60} h={6} tone={2} />
              </div>
              <div className="sl-lead dm-wide">Order Starlink</div>
              <div className="sl-addr dm-wide">
                <Bar w={190} h={8} tone={2} />
              </div>
              <div className="sl-plans">
                {PLANS.map((p, i) => (
                  <div key={p.name} className="sl-plan" data-target={`plan-${i}`} data-on={s.plan === i || undefined}>
                    <span className="sl-plan__name">{p.name}</span>
                    <span className="sl-plan__price">
                      {usd(p.price)}
                      <small>/mo</small>
                    </span>
                    <span className="sl-plan__note">{p.note}</span>
                  </div>
                ))}
              </div>
              <div className="sl-sum">
                <div className="sl-sum__col">
                  <span className="sl-sum__k">Monthly</span>
                  <Count className="sl-sum__v" value={plan.price} format={usd} />
                </div>
                <div className="sl-sum__col">
                  <span className="sl-sum__k">Hardware</span>
                  <Count className="sl-sum__v" value={plan.kit} format={usd} />
                </div>
                <span className="sl-order" data-target="order">
                  <States
                    value={s.state}
                    states={{
                      idle: <span>Order now</span>,
                      busy: <Spinner size={14} />,
                      done: <span>Order placed</span>,
                    }}
                  />
                </span>
              </div>
              <div className="sl-fine dm-wide">
                <Badge tone="success" dot className="sl-badge dm-in" data-on={s.state === 'done' || undefined}>
                  Ships in 1 to 2 weeks
                </Badge>
                <Bar w={180} h={5} tone={1} />
              </div>
            </div>
          </Window>
        )
      }}
    </Stage>
  )
}
