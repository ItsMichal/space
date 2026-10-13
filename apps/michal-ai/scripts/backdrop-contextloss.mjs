// Checks that the backdrop and the hero globe (two WebGL contexts on the home page) coexist, and that losing and restoring the
// backdrop's context falls back to the CSS layer and recovers, without disturbing the globe. Needs `next dev` and Chrome.
// Usage: node scripts/backdrop-contextloss.mjs [baseUrl=http://localhost:3411]
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import path from 'node:path'

const require = createRequire(import.meta.url)
const WS = require('ws')
const base = process.argv[2] ?? 'http://localhost:3411'
const port = 9500 + Math.floor(Math.random() * 300)
const dir = path.join(process.env.TMPDIR ?? '/tmp', `chrome-cl-${port}`)
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', '--enable-gpu', '--ignore-gpu-blocklist', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets
for (let i = 0; i < 40; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break } catch {}
  await sleep(250)
}
const ws = new WS(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => ws.on('open', r))
let id = 0
const pending = new Map()
ws.on('message', (d) => { const m = JSON.parse(String(d)); if (m.id && pending.has(m.id)) pending.get(m.id)(m) })
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: base + '/' })
for (let i = 0; i < 240; i++) { await sleep(500); if (await js(`!!document.querySelector('.paper-grid__gl[data-ready]')`)) break }
await sleep(3000)
const state = () => js(`JSON.stringify({
  backdropReady: !!document.querySelector('.paper-grid__gl[data-ready]'),
  fallback: document.querySelector('.paper-grid').hasAttribute('data-fallback'),
  lensAttr: document.documentElement.dataset.backdropLens ?? null,
  canvases: [...document.querySelectorAll('canvas')].map((c) => ({ cls: c.className, ctxLost: (c.getContext('webgl2') || c.getContext('webgl'))?.isContextLost?.() ?? 'n/a' })),
})`)
console.log('initial       ', await state())
await js(`(()=>{const c=document.querySelector('.paper-grid__gl'); window.__ext=c.getContext('webgl2').getExtension('WEBGL_lose_context'); window.__ext.loseContext()})()`)
await sleep(800)
console.log('after lose    ', await state())
await js(`window.__ext.restoreContext()`)
await sleep(2500)
console.log('after restore ', await state())
chrome.kill()
ws.close()
process.exit(0)
