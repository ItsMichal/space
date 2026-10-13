// Frame sequences with a deterministic clock (dev server only). The page is loaded with ?t=0 (see HeroGlobe.tsx: window.__globe.devT drives the
// portrait clock, the materialise sweep and the ping clock); for each value the clock is set, the page gets a moment to draw, and a clipped
// screenshot is written. Usage:
//   node scripts/capture-motion.mjs <outprefix> --url http://localhost:3188/ --q "?pingdemo=1&spin=0" --clock 0,0.1,0.2 --clip x,y,w,h [--dpr 2] [--w 1440 --h 900]
//   node scripts/capture-motion.mjs <outprefix> ... --mouse "x0,y0,x1,y1" --frames 10 --release 10    (pointer path, real time)
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
const url = opt('url', 'http://localhost:3188/') + opt('q', '?t=0')
const port = 9300 + Math.floor(Math.random() * 300)
const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(process.env.TMPDIR ?? '/tmp', `chrome-motion-${port}`)}`, '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', 'about:blank'],
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
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: dpr, mobile: W < 500 })
await send('Page.navigate', { url })
await sleep(3000)
const ready = 'window.__globe&&window.__globe.sat&&window.__globe.portrait&&window.__globe.links'
for (let i = 0; i < 200 && !(await ev(ready)); i++) await sleep(1000)
await sleep(1500)
const shot = async (n) => {
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3], scale: 1 } })
  const f = `${prefix}-${String(n).padStart(2, '0')}.png`
  fs.mkdirSync(path.dirname(path.resolve(f)), { recursive: true })
  fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
  console.log('wrote', f)
}
if (args.includes('--follow-ping')) {
  // crop tightly around the demo ping's two ends (window.__globe.demoPos, set by ?pingdemo=1)
  await ev('window.__globe.devT = 0.5')
  await sleep(800)
  const pos = await ev('JSON.stringify(window.__globe.demoPos)')
  if (pos) {
    const [a, b] = JSON.parse(pos)
    const x0 = Math.max(0, Math.min(a[0], b[0]) - 70)
    const y0 = Math.max(0, Math.min(a[1], b[1]) - 70)
    clip[0] = x0
    clip[1] = y0
    clip[2] = Math.min(W - x0, Math.abs(a[0] - b[0]) + 140)
    clip[3] = Math.min(H - y0, Math.abs(a[1] - b[1]) + 140)
    console.log('ping ends', pos, 'clip', clip.join(','))
  }
}
if (args.includes('--clock')) {
  const list = opt('clock', '0').split(',').map(Number)
  for (let k = 0; k < list.length; k++) {
    await ev(`window.__globe.devT = ${list[k]}`)
    await sleep(500)
    await shot(k + 1)
  }
} else if (args.includes('--mouse')) {
  const [x0, y0, x1, y1] = opt('mouse').split(',').map(Number)
  const N = Number(opt('frames', 10))
  const R = Number(opt('release', 10))
  const gap = Number(opt('gap', 90))
  for (let k = 0; k < N; k++) {
    const t = N === 1 ? 1 : k / (N - 1)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, pointerType: 'mouse' })
    await sleep(gap)
    await shot(k + 1)
  }
  // released: the pointer stops (no more events); the field relaxes
  for (let k = 0; k < R; k++) {
    await sleep(gap)
    await shot(N + k + 1)
  }
}
try { process.kill(chrome.pid, 'SIGKILL') } catch {}
process.exit(0)
