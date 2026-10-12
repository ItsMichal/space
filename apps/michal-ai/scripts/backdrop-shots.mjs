// Headless-Chrome screenshots of the page backdrop (software GL). Needs `next dev` (or a static server) and Google Chrome.
// Usage: node scripts/backdrop-shots.mjs [baseUrl=http://localhost:3411] [outDir=docs/backdrop-shots] [only=substring]
// Each shot: { name, path, w, h, dark, scroll, clip?, scale?, js? }. Dark shots emulate prefers-color-scheme: dark (the dark
// theme only applies on reading pages, which set data-reading).
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const WS = require('ws')
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const base = process.argv[2] ?? 'http://localhost:3411'
const out = path.resolve(root, process.argv[3] ?? 'docs/backdrop-shots')
const only = process.argv[4]
fs.mkdirSync(out, { recursive: true })

const POST = process.env.POST ?? '/writing'
const D = { w: 1440, h: 900 }
const M = { w: 375, h: 812 }
const shots = []
for (const dark of [false, true]) {
  for (const v of [D, M]) {
    const s = `${v.w}-${dark ? 'dark' : 'light'}`
    shots.push({ name: `home-hero-${s}`, path: '/', ...v, dark, scroll: 0 })
    shots.push({ name: `home-cards-${s}`, path: '/', ...v, dark, scroll: Math.round(v.h * 1.1) })
    shots.push({ name: `home-about-${s}`, path: '/', ...v, dark, scroll: 'about' })
    shots.push({ name: `writing-${s}`, path: '/writing', ...v, dark, scroll: 0 })
    shots.push({ name: `post-${s}`, path: process.env.POST ?? '/writing', ...v, dark, scroll: 0, post: true })
    shots.push({ name: `projects-${s}`, path: '/projects', ...v, dark, scroll: 0 })
  }
}

const port = 9700 + Math.floor(Math.random() * 200)
const dir = path.join(process.env.TMPDIR ?? '/tmp', `chrome-bd-${port}`)
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
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) console.log('  [console]', m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300))
  if (m.method === 'Runtime.exceptionThrown') console.log('  [exception]', JSON.stringify(m.params.exceptionDetails).slice(0, 300))
})
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable')
await send('Runtime.enable')
for (const s of shots) {
  if (only && !s.name.includes(only)) continue
  await send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: s.scale ?? 1, mobile: s.w < 500 })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: s.dark ? 'dark' : 'light' }] })
  let p = s.path
  if (s.post) {
    await send('Page.navigate', { url: base + '/writing' })
    await sleep(2500)
    p = (await evalJs(`(document.querySelector('a[href^="/writing/"]')||{}).getAttribute?.('href') || '/writing'`)) ?? '/writing'
  }
  await send('Page.navigate', { url: base + p })
  for (let i = 0; i < 240; i++) { await sleep(500); if (await evalJs(`!!document.querySelector('.paper-grid__gl[data-ready]') || document.querySelector('.paper-grid')?.hasAttribute('data-fallback')`)) break }
  await sleep(1800)
  if (s.scroll === 'about') {
    await evalJs(`(()=>{const e=[...document.querySelectorAll('h2,h3')].find(x=>/about/i.test(x.textContent)); if(e) window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 120)})()`)
  } else if (s.scroll) await evalJs(`window.scrollTo(0, ${s.scroll})`)
  await sleep(2600)
  const info = await evalJs(`JSON.stringify({gl: !!document.querySelector('.paper-grid__gl[data-ready]'), fb: document.querySelector('.paper-grid')?.hasAttribute('data-fallback'), lens: document.documentElement.dataset.backdropLens, reading: document.documentElement.hasAttribute('data-reading'), cw: document.querySelector('.paper-grid__gl')?.width, ctx: !!document.createElement('canvas').getContext('webgl2'), op: getComputedStyle(document.querySelector('.paper-grid__gl')).opacity})`)
  const shot = await send('Page.captureScreenshot', { format: 'png', ...(s.clip ? { clip: { ...s.clip, scale: 1 } } : {}) })
  fs.writeFileSync(path.join(out, `${s.name}.png`), Buffer.from(shot.result.data, 'base64'))
  console.log(s.name, p, info)
}
chrome.kill()
ws.close()
process.exit(0)
