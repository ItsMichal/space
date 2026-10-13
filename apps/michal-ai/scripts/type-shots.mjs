// Screenshots for the type-scale review into docs/type-shots/<label>/: home About cards, home work grid, /about, /writing,
// a project page and a writing post at 1440 and 375. Needs a running site (default http://localhost:3100) and Google Chrome.
// Usage: node scripts/type-shots.mjs <label>     (label: before | after)
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const WS = require('ws')
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const base = process.env.BASE ?? 'http://localhost:3100'
const label = process.argv[2] ?? 'after'
const out = path.join(root, 'docs', 'type-shots', label)
fs.mkdirSync(out, { recursive: true })
const port = 9900 + Math.floor(Math.random() * 90)
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(process.env.TMPDIR ?? '/tmp', `chrome-shots-${port}`)}`, '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', 'about:blank'], { stdio: 'ignore' })
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
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.result?.value
await send('Page.enable')

// [name, route, selector to clip to (null: the top of the page)]
const SHOTS = [
  ['home-about', '/', '#about'],
  ['home-work', '/', '#work'],
  ['about', '/about', null],
  ['writing', '/writing', null],
  ['project', '/projects/project-mountaintop', null],
  ['post', '/writing/creating-my-first-pcb-object', null],
]
for (const [vw, w, h, dpr, mobile] of [[1440, 1440, 900, 1, false], [375, 375, 812, 2, true]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile })
  for (const [name, route, sel] of SHOTS) {
    await send('Page.navigate', { url: base + route })
    await sleep(2500)
    const total = (await ev('document.documentElement.scrollHeight')) ?? 0
    for (let y = 0; y < total; y += h * 0.6) { await ev(`window.scrollTo(0, ${y})`); await sleep(150) }
    await sleep(800)
    await ev('window.scrollTo(0, 0)')
    await sleep(300)
    let clip
    if (sel) {
      const r = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: 0, y: b.top + scrollY - 16, width: innerWidth, height: b.height + 32 } })()`)
      if (r) clip = { ...r, scale: 1 }
    } else {
      clip = { x: 0, y: 0, width: w, height: Math.min(total, 3200), scale: 1 }
    }
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip })
    fs.writeFileSync(path.join(out, `${name}-${vw}.png`), Buffer.from(shot.result.data, 'base64'))
    console.log('wrote', `${name}-${vw}.png`)
  }
}
chrome.kill()
ws.close()
