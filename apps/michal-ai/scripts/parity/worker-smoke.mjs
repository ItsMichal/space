// Exercises the Worker routes against a served build (wrangler dev): page, 308, trailing slash, 404, host redirect, share card,
// reactions GET/POST, views, the Starlink binary. With --kill the server was started with LIVE_KILL=1 and /api/live/* must answer 204.
//   node scripts/parity/worker-smoke.mjs http://127.0.0.1:4002 [--kill]
const base = (process.argv[2] ?? '').replace(/\/$/, '')
const kill = process.argv.includes('--kill')
const ID = 'making-a-kinetic-typography'
const origin = new URL(base).origin
let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(ok ? 'pass' : 'FAIL', name, detail)
}
const get = (p, init = {}) => fetch(base + p, { redirect: 'manual', ...init })
const json = { 'Content-Type': 'application/json', Origin: origin, 'Sec-Fetch-Site': 'same-origin' }
const post = (p, body) => get(p, { method: 'POST', headers: json, body: JSON.stringify(body) })

if (kill) {
  check('reactions GET answers 204', (await get(`/api/live/reactions?id=${ID}`)).status === 204)
  check('views POST answers 204', (await post('/api/live/views', { id: ID, vid: 'parityvisitor0000001' })).status === 204)
  check('reactions POST answers 204', (await post('/api/live/reactions', { id: ID, target: 'post', emoji: 'clap', sid: 'parityparityparity01', on: true })).status === 204)
  check('site pages are unaffected', (await get('/about')).status === 200)
  check('Starlink binary is not under the kill switch', (await get('/globe/starlink-live.bin')).status === 200)
} else {
  const page = await get('/about')
  check('page 200 html', page.status === 200 && /text\/html/.test(page.headers.get('content-type') ?? ''))
  const red = await get('/projects/frogchamp-ai-chat-stream?utm=1')
  check('legacy redirect is 308 with query kept', red.status === 308 && red.headers.get('location') === '/projects/frogchamp?utm=1', red.headers.get('location'))
  const slash = await get('/about/')
  check('trailing slash 308 to slash-less', slash.status === 308 && slash.headers.get('location') === '/about')
  const nf = await get('/does/not/exist')
  const nfBody = await nf.text()
  check('404 status with the prerendered not-found page', nf.status === 404 && nfBody.includes('Page not found'))
  const card = await get('/writing/kinetic-typography/opengraph-image')
  check('share card is image/png', card.status === 200 && card.headers.get('content-type') === 'image/png')
  const feed = await get('/feed.xml')
  check('feed content type', /application\/rss\+xml/.test(feed.headers.get('content-type') ?? ''))
  const dataReq = await get('/writing.data')
  check('loader data content type', /text\/x-script/.test(dataReq.headers.get('content-type') ?? ''))
  const g = await get(`/api/live/reactions?id=${ID}`)
  check('reactions GET 200 json', g.status === 200 && (await g.json()).id === ID)
  const on = await post('/api/live/reactions', { id: ID, target: 'post', emoji: 'clap', sid: 'parityparityparity01', on: true })
  const onBody = await on.json().catch(() => null)
  check('reactions POST toggles on', on.status === 200, JSON.stringify(onBody))
  const off = await post('/api/live/reactions', { id: ID, target: 'post', emoji: 'clap', sid: 'parityparityparity01', on: false })
  check('reactions POST toggles off', off.status === 200)
  check('views POST 204', (await post('/api/live/views', { id: ID, vid: 'parityvisitor0000001' })).status === 204)
  const bin = await get('/globe/starlink-live.bin')
  check('Starlink binary 200', bin.status === 200 && Number(bin.headers.get('content-length') ?? (await bin.arrayBuffer()).byteLength) > 1000)
}
process.exitCode = failed ? 1 : 0
