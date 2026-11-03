import { Avatar, Badge, Collapse, Phone, Stage, type Act } from '@/components/stageshow/kit'
import './playsafe.css'

// The PlaySafe! feed. Beats: friends' updates arrive at the top of the feed
// one by one (a safe meeting, a test result, a vaccination check); the
// pending test result is verified. Plays once.
//
// Real strings: the app's name and tagline, the kinds of update, the tabs.

const FEED = [
  { who: 'Sam', text: 'recorded a safe meeting with Ana', tone: 'success' as const, tag: 'Safe meeting' },
  { who: 'Jordan', text: 'shared a test result', tone: 'warning' as const, tag: 'Waiting to verify' },
  { who: 'Alex', text: 'was verified as vaccinated', tone: 'success' as const, tag: 'Vaccinated' },
]
const TABS = ['Feed', 'Friends', 'Add', 'Safe Activities', 'Me']

type S = { shown: number; verified: boolean }
const initial: S = { shown: 0, verified: false }
const poster: S = { shown: 3, verified: true }

async function script(a: Act<S>) {
  await a.wait(500)
  a.mark('feed')
  for (let i = 1; i <= FEED.length; i++) {
    a.put({ shown: i })
    await a.wait(650)
  }
  await a.wait(400)
  a.mark('verify')
  a.put({ verified: true })
  await a.wait(2400)
}

export default function PlaySafe() {
  return (
    <Stage<S> width={800} height={500} compact={{ below: 600, width: 400, height: 250 }} initial={initial} poster={poster} script={script} play="once" className="ps">
      {(s) => (
        <div className="ps-wrap">
          <div className="ps-pitch dm-wide">
            <span className="ps-name">PlaySafe!</span>
            <span className="ps-tag">Socially responsible fun.</span>
          </div>
          <Phone width={270} className="ps-phone">
            <div className="ps-screen">
              <span className="ps-title">Feed</span>
              <div className="ps-feed">
                {/* newest first: each update drops in above the last */}
                {[...FEED].reverse().map((f, r) => {
                  const i = FEED.length - 1 - r
                  const pending = i === 1 && !s.verified
                  return (
                    <Collapse key={f.who} open={i < s.shown} reveal="drop">
                      <div className="ps-card">
                        <Avatar name={f.who} size={30} />
                        <div className="ps-body">
                          <span className="ps-text">
                            <b>{f.who}</b> {f.text}
                          </span>
                          <Badge tone={pending ? 'warning' : 'success'} dot>
                            {i === 1 ? (pending ? f.tag : 'Negative, verified') : f.tag}
                          </Badge>
                        </div>
                      </div>
                    </Collapse>
                  )
                })}
              </div>
              <div className="ps-tabs">
                {TABS.map((t) => (
                  <span key={t} data-on={t === 'Feed' || undefined}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </Phone>
        </div>
      )}
    </Stage>
  )
}
