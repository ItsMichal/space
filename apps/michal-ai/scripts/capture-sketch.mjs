// Sketch-in frames from a PRODUCTION build with a controlled clock. The page's performance.now is wrapped (added before any page script runs) so
// that window.__freeze pins it; once the portrait has loaded (window.__hero().sketchFrom) the offset is set so the sketch-in clock reads
// each requested time, then a frame is captured. Usage:
//   node scripts/capture-sketch.mjs <outprefix> --url http://localhost:3100/ --times 0.2,0.6,1,1.6,2.2,2.8,3.4,4 --clip x,y,w,h [--dpr 2] [--w 1440 --h 900]
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const WS = require('ws')
const args = process.argv.slice(2)
const prefix = args[0]
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d)
const W = Number(opt('w', 1440))
const H = Number(opt('h', 900))
const dpr = Number(opt('dpr', 2))
const clip = opt('clip', `0,0,${W},${H}`).split(',').map(Number)
const times = opt('times', '0.3,1,2,3,4').split(',').map(Number)
const url = opt('url', 'http://localhost:3100/')
const port = 9500 + Math.floor(Math.random() * 300)
const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(process.env.TMPDIR ?? '/tmp', `chrome-sketch-${port}`)}`, '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', 'about:blank'],
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
})
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value
await send('Page.enable')
await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__freeze = null; const __n = performance.now.bind(performance); performance.now = () => window.__freeze !== null ? window.__freeze : __n();' })
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: dpr, mobile: W < 500 })
await send('Page.navigate', { url })
for (let i = 0; i < 300; i++) {
  await sleep(1000)
  if (await ev('window.__hero && window.__hero().sketchFrom > 0 && window.__hero().satsDrawn > 0')) break
}
await sleep(1500)
let k = 0
for (const t of times) {
  k++
  // the sketch clock reads t: now = from + t * 1000
  await ev(`window.__freeze = window.__hero().sketchFrom + ${t * 1000}`)
  await sleep(5000)
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale: 1 } })
  const f = `${prefix}-${String(k).padStart(2, '0')}.png`
  fs.mkdirSync(path.dirname(path.resolve(f)), { recursive: true })
  fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
  console.log('wrote', f)
}
try { process.kill(chrome.pid, 'SIGKILL') } catch {}
process.exit(0)
