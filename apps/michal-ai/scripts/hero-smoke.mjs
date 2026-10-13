// Smoke test for the hero canvases against a BUILT site (npm run build:michal && next start, or any deployed URL). Exits non-zero if the
// portrait or the satellite shell did not render. Usage:
//   node scripts/hero-smoke.mjs [url] [--phone] [--dpr 2] [--timeout 120] [--shot out.png]
// It reads window.__hero() (a non-enumerable, read-only snapshot defined by HeroGlobe.tsx in every build: frames drawn, satellites drawn,
// portrait reveal 0..1, both contexts alive, last GL error), listens for console errors, and checks the screenshot for the figure's ink.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const WS = require('ws')
const sharp = require('sharp')
const args = process.argv.slice(2)
const flag = (n) => args.includes(`--${n}`)
const opt = (n, d) => (flag(n) ? args[args.indexOf(`--${n}`) + 1] : d)
const url = args.find((a) => /^https?:/.test(a)) ?? 'http://localhost:3000/'
const phone = flag('phone')
const W = phone ? 375 : 1440
const H = phone ? 812 : 900
const dpr = Number(opt('dpr', phone ? 3 : 2))
const timeout = Number(opt('timeout', 120)) * 1000
const port = 9400 + Math.floor(Math.random() * 300)
const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(process.env.TMPDIR ?? '/tmp', `chrome-smoke-${port}`)}`, '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', 'about:blank'],
  { stdio: 'ignore' },
)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (msg) => {
  console.error('FAIL:', msg)
  try { process.kill(chrome.pid, 'SIGKILL') } catch {}
  process.exit(1)
}
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
const errors = []
ws.on('message', (d) => {
  const m = JSON.parse(String(d))
  if (m.id && pending.has(m.id)) pending.get(m.id)(m)
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300))
})
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value
await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: dpr, mobile: phone })
await send('Page.navigate', { url })
const t0 = Date.now()
let st = null
while (Date.now() - t0 < timeout) {
  await sleep(1000)
  const raw = await ev("typeof window.__hero === 'function' ? JSON.stringify(window.__hero()) : null")
  st = raw ? JSON.parse(raw) : null
  if (st && st.readyMs > 0) break
}
const took = ((Date.now() - t0) / 1000).toFixed(1)
if (!st) fail('window.__hero is missing (HeroGlobe did not mount)')
console.log(`state after ${took}s:`, JSON.stringify(st))
if (st.mode !== 'gl') fail(`globe is in "${st.mode}" mode, expected gl`)
if (!st.hasShell) fail('the satellite shell canvas has no WebGL context')
if (st.globe?.lost || st.shell?.lost) fail('a WebGL context was lost')
if (st.globe?.error || st.shell?.error) fail(`GL error ${st.globe?.error || st.shell?.error}`)
if (!(st.satsDrawn > 0)) fail('no satellites drawn')
if (!(st.portraitReveal >= 1)) fail(`portrait not fully revealed (${st.portraitReveal})`)
await sleep(1500)
// pixels: the figure is ink-coloured dots on the page tint; the right of the hero must hold a substantial amount of dark ink
const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } })
const buf = Buffer.from(shot.result.data, 'base64')
if (opt('shot')) fs.writeFileSync(opt('shot'), buf)
const region = phone ? { left: Math.round(W * dpr * 0.6), top: Math.round(60 * dpr), width: Math.round(W * dpr * 0.4), height: Math.round(150 * dpr) } : { left: Math.round(W * dpr * 0.58), top: Math.round(80 * dpr), width: Math.round(W * dpr * 0.32), height: Math.round(480 * dpr) }
const { data, info } = await sharp(buf).extract(region).greyscale().raw().toBuffer({ resolveWithObject: true })
let dark = 0
for (let i = 0; i < data.length; i++) if (data[i] < 130) dark++
const frac = dark / (info.width * info.height)
console.log(`dark-ink fraction in the figure area: ${(frac * 100).toFixed(2)}%`)
if (frac < (phone ? 0.04 : 0.06)) fail('the portrait area has almost no ink (figure not drawn)')
if (errors.length) fail(`console errors: ${errors.slice(0, 3).join(' | ')}`)
console.log('ok: portrait and satellite shell rendered, both contexts alive, no console errors')
try { process.kill(chrome.pid, 'SIGKILL') } catch {}
process.exit(0)
