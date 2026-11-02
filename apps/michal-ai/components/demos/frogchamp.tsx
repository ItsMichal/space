import { Badge, Bar, Chart, Count, Stage, Stream, Window, type Act } from '@/components/stageshow/kit'
import './frogchamp.css'

// The Frogchamp dashboard. Beats: chat scrolls in on the left; messages per
// minute climb and the sentiment line grows; a one-sentence summary of chat
// streams in under it. Plays once.
//
// Real strings: the product's name and the kind of insight it was for.

const SENTIMENT = [0.42, 0.48, 0.45, 0.55, 0.62, 0.58, 0.7, 0.76, 0.82]
const SUMMARY = 'Chat loves the new boss fight. A few people are asking which build you are running.'
const CHAT = [
  ['moss_mage', 'that dodge was insane'],
  ['pixelpete', 'what build is this??'],
  ['ribbit_rae', 'LETS GOOO'],
  ['nightowl', 'boss music is so good'],
  ['tadpole', 'build in the description?'],
]

type S = { lines: number; points: number; rate: number; words: number }
const initial: S = { lines: 1, points: 3, rate: 48, words: 0 }
const poster: S = { lines: CHAT.length, points: SENTIMENT.length, rate: 212, words: 99 }

async function script(a: Act<S>) {
  await a.wait(500)
  a.mark('chat')
  for (let i = 2; i <= CHAT.length; i++) {
    a.put({ lines: i, points: Math.min(SENTIMENT.length, 3 + i + 1), rate: 48 + i * 33 })
    await a.wait(380)
  }
  a.put({ points: SENTIMENT.length, rate: 212 })
  await a.wait(500)
  a.mark('summary')
  const n = SUMMARY.split(' ').length
  for (let w = 1; w <= n; w++) {
    a.put({ words: w })
    await a.wait(70)
  }
  await a.wait(2400)
}

export default function Frogchamp() {
  return (
    <Stage<S> width={800} height={500} compact={{ below: 600, width: 400, height: 250 }} initial={initial} poster={poster} script={script} play="once" theme="dark" className="fc">
      {(s) => (
        <Window url="frogchamp.co" className="dm-win fc-win">
          <div className="fc-page">
            <div className="fc-chat dm-wide">
              <span className="fc-head">Chat</span>
              {CHAT.slice(0, s.lines).map(([who, text]) => (
                <div key={who} className="fc-line">
                  <span className="fc-who">{who}</span> {text}
                </div>
              ))}
              {Array.from({ length: CHAT.length - s.lines }, (_, i) => (
                <Bar key={i} w="70%" h={9} tone={2} />
              ))}
            </div>
            <div className="fc-main">
              <div className="fc-stats">
                <div className="fc-stat">
                  <span className="fc-label">Messages per minute</span>
                  <Count value={s.rate} className="fc-big" />
                </div>
                <div className="fc-stat">
                  <span className="fc-label">Sentiment</span>
                  <Badge tone="success" dot>
                    Positive
                  </Badge>
                </div>
              </div>
              <div className="fc-card">
                <Chart data={SENTIMENT.slice(0, s.points)} width={360} height={110} max={1} className="dm-wide" />
                <Chart data={SENTIMENT.slice(0, s.points)} width={250} height={56} max={1} className="dm-compact" />
              </div>
              <div className="fc-card fc-sum">
                <span className="fc-label">Summary</span>
                <Stream text={SUMMARY} count={s.words} className="fc-sumtext" />
              </div>
            </div>
          </div>
        </Window>
      )}
    </Stage>
  )
}
