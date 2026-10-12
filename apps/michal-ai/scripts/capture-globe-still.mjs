// Regenerates public/globe/fallback.png: the globe shader's own output at the start view (reduced-motion emulation draws one
// static frame). Needs `next dev` on :3000 and Google Chrome. Usage: node scripts/capture-globe-still.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const WS = require('ws')
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const port = 9600 + Math.floor(Math.random() * 300)
const dir = path.join(process.env.TMPDIR ?? '/tmp', `chrome-still-${port}`)
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
})
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false })
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
await send('Page.enable')
await send('Page.navigate', { url: 'http://localhost:3000/presence?mock=1&full=1' })
await sleep(3000)
const ev = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
await ev(`document.querySelector('.hero-globe').style.cssText='width:400px;right:0;top:0;transform:none;opacity:1'`)
for (let i = 0; i < 60; i++) {
  const r = await ev(`document.querySelector('.hero-globe').dataset.mode`)
  if (r.result.result.value === 'gl') break
  await sleep(500)
}
await sleep(1500)
const r = await ev(`document.querySelector('.hero-globe canvas').toDataURL('image/png')`)
const { default: sharp } = await import('sharp')
await sharp(Buffer.from(r.result.result.value.split(',')[1], 'base64')).png({ palette: true, colours: 24 }).toFile(path.join(root, 'public', 'globe', 'fallback.png'))
chrome.kill()
console.log('wrote public/globe/fallback.png')
process.exit(0)
