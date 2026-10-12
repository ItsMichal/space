// Screenshots the card pages at 1440x900 and 375x812, light and dark, into docs/cards-shots/, and asserts that titles in a row of
// cards share one top. Needs a running site (default http://localhost:3100) and Google Chrome.
// Usage: node scripts/shoot-cards.mjs [outSubdir] [only-substring]
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const WS = require('ws')
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const base = process.env.BASE ?? 'http://localhost:3100'
const out = path.join(root, 'docs', 'cards-shots', process.argv[2] ?? '')
const only = process.argv[3]
fs.mkdirSync(out, { recursive: true })
const port = 9700 + Math.floor(Math.random() * 200)
const dir = path.join(process.env.TMPDIR ?? '/tmp', `chrome-cards-${port}`)
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', 'about:blank'], { stdio: 'ignore' })
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
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.result.value
await send('Page.enable')

const pages = [
  ['home', '/', '#about'],
  ['home-work', '/', '#work'],
  ['projects', '/projects'],
  ['writing', '/writing'],
  ['mountaintop', '/projects/project-mountaintop'],
  ['jia', '/projects/jia-webapp'],
  ['post', '/writing/hello-paper'],
  ['404', '/does-not-exist'],
]
const sizes = [['1440', 1440, 900, 1], ['375', 375, 812, 2]]
const schemes = ['light', 'dark']
// every row of cards: group titles by their offsetTop-of-card row and report spread of title tops
const ASSERT = `(() => {
  const out = []
  for (const list of document.querySelectorAll('.tiles, .card-grid, .wfeat')) {
    const cards = [...list.querySelectorAll('[data-card-title]')]
    const rows = new Map()
    for (const t of cards) {
      const card = t.closest('li') ?? t
      const y = Math.round(card.getBoundingClientRect().top + scrollY)
      const key = [...rows.keys()].find((k) => Math.abs(k - y) < 4) ?? y
      rows.set(key, [...(rows.get(key) ?? []), t])
    }
    for (const [k, ts] of rows) {
      if (ts.length < 2) continue
      const tops = ts.map((t) => Math.round(t.getBoundingClientRect().top + scrollY))
      out.push({ row: k, n: ts.length, spread: Math.max(...tops) - Math.min(...tops) })
    }
  }
  return out
})()`
let fails = 0
for (const scheme of schemes) {
  await send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: 'reduce' }] })
  for (const [sname, w, h, dpr] of sizes) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: w < 600 })
    for (const [name, url, anchor] of pages) {
      if (only && !`${name}-${sname}-${scheme}`.includes(only)) continue
      await send('Page.navigate', { url: base + url })
      await sleep(2500)
      await ev(`document.querySelectorAll('img').forEach(i => { i.loading = 'eager' })`)
      // scroll through so lazy content loads, then back
      const total = await ev('document.documentElement.scrollHeight')
      for (let y = 0; y < total; y += 600) { await ev(`scrollTo(0, ${y})`); await sleep(120) }
      await sleep(600)
      const res = await ev(ASSERT)
      for (const r of res ?? []) { if (r.spread > 1) { fails++; console.log('TITLE MISALIGNED', scheme, sname, name, JSON.stringify(r)) } }
      if (res?.length) console.log('rows ok/checked', scheme, sname, name, JSON.stringify(res))
      // overflow check
      const ov = await ev('document.documentElement.scrollWidth - document.documentElement.clientWidth')
      if (ov > 0) console.log('HORIZONTAL OVERFLOW', ov, scheme, sname, name)
      let clip
      if (anchor) {
        const r = await ev(`(() => { const e = document.querySelector('${anchor}'); const b = e.getBoundingClientRect(); return { x: 0, y: b.top + scrollY - 16, width: innerWidth, height: b.height + 32 } })()`)
        clip = { ...r, scale: 1 }
      } else {
        const hgt = await ev('document.documentElement.scrollHeight')
        clip = { x: 0, y: 0, width: w, height: Math.min(hgt, 5000), scale: 1 }
      }
      await ev('scrollTo(0,0)')
      const shot = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true })
      fs.writeFileSync(path.join(out, `${name}-${sname}-${scheme}.png`), Buffer.from(shot.result.data, 'base64'))
      console.log('wrote', `${name}-${sname}-${scheme}.png`)
    }
  }
}
console.log(fails ? `FAIL: ${fails} misaligned rows` : 'title alignment: all rows within 1px')
chrome.kill()
process.exit(fails ? 1 : 0)
