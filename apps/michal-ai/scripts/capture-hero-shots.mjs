// Screenshots the home hero in headless Chrome with software WebGL (the tab must be visible or the globe pauses).
// Needs `next dev` running and Google Chrome. Usage:
//   node scripts/capture-hero-shots.mjs <out.png> [--w 1440] [--h 900] [--dark] [--url http://localhost:3111/] [--q "?ptr=0.5,0.5"]
//        [--wait 6000] [--then 60000 <out2.png>] [--click-next] [--reduced] [--dpr 1] [--eval "js"]
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const WS = require('ws')
const args = process.argv.slice(2)
const out = args[0]
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d)
const flag = (n) => args.includes(`--${n}`)
const W = Number(opt('w', 1440))
const H = Number(opt('h', 900))
const url = opt('url', 'http://localhost:3111/') + opt('q', '')
const wait = Number(opt('wait', 6000))
const port = 9700 + Math.floor(Math.random() * 200)
const dir = path.join(process.env.TMPDIR ?? '/tmp', `chrome-hero-${port}`)
const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', 'about:blank'],
  { stdio: 'ignore' },
)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets
for (let i = 0; i < 40; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
    if (targets.length) break
  } catch {}
  await sleep(250)
}
const ws = new WS(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => ws.on('open', r))
let id = 0
const pending = new Map()
ws.on('message', (d) => {
  const m = JSON.parse(String(d))
  if (m.id && pending.has(m.id)) pending.get(m.id)(m)
  if (m.method === 'Runtime.exceptionThrown') console.log('page error:', m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) console.log('console.error:', m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300))
})
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value
await send('Page.enable')
await send('Runtime.enable')

await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: Number(opt('dpr', 1)), mobile: W < 500 })
const features = [{ name: 'prefers-color-scheme', value: flag('dark') ? 'dark' : 'light' }]
if (flag('reduced')) features.push({ name: 'prefers-reduced-motion', value: 'reduce' })
await send('Emulation.setEmulatedMedia', { features })
await send('Page.navigate', { url })
await sleep(wait)
// Optionally keep waiting until a page expression is truthy (slow machines): --until "expr" [--until-max 120000]
if (opt('until')) {
  const end = Date.now() + Number(opt('until-max', 120000))
  while (Date.now() < end && !(await ev(opt('until')))) await sleep(1000)
}
const shot = async (file) => {
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: Math.min(H, 900), scale: 1 } })
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true })
  fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'))
  console.log('wrote', file)
}
if (opt('eval')) console.log(JSON.stringify(await ev(opt('eval'))))
if (args.includes('--sweep')) {
  // --sweep N MS x0,y0,x1,y1: the mouse moves from (x0,y0) to (x1,y1) over N frames, a screenshot after each (out-1.png ...)
  const i = args.indexOf('--sweep')
  const N = Number(args[i + 1])
  const [x0, y0, x1, y1] = args[i + 3].split(',').map(Number)
  for (let k = 0; k < N; k++) {
    const t = N === 1 ? 1 : k / (N - 1)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, pointerType: 'mouse' })
    await sleep(Number(args[i + 2]))
    await shot(out.replace(/\.png$/, `-${k + 1}.png`))
  }
} else if (args.includes('--seq')) {
  // --seq N MS: N screenshots MS apart (out-1.png, out-2.png, ...), e.g. a mesh ping travelling
  const i = args.indexOf('--seq')
  for (let k = 1; k <= Number(args[i + 1]); k++) {
    await shot(out.replace(/\.png$/, `-${k}.png`))
    await sleep(Number(args[i + 2]))
  }
} else if (out !== '-') await shot(out)
if (args.includes('--then')) {
  const i = args.indexOf('--then')
  await sleep(Number(args[i + 1]))
  await shot(args[i + 2])
}
try { process.kill(-chrome.pid) } catch { chrome.kill() }
process.exit(0)
