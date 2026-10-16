// Crops of the page margin (where nothing but the backdrop shows) at several pixel densities and both themes, to judge the paper
// tooth, optionally against another site (the live one). Needs Chrome; the base URL can be a local preview or https://michal.ai.
// Usage: node scripts/backdrop-tooth-crops.mjs <baseUrl> <outDir> <prefix> [only-regex]
// Light crops come from /writing; dark crops from a post (the dark theme only applies on reading pages, under prefers-color-scheme: dark).
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const WS = require('ws')
const [base, outDir, prefix, only] = process.argv.slice(2)
fs.mkdirSync(outDir, { recursive: true })
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
// clip is in CSS px: a margin strip at the left of the page (x 0..190 is empty at 1440; on a phone the strip is the top gap under the nav)
const runs = []
for (const dark of [false, true]) {
  const k = dark ? 'dark' : 'light'
  runs.push({ name: `1440x1-${k}`, w: 1440, h: 900, dsf: 1, dark, clip: { x: 0, y: 330, width: 190, height: 130 } })
  runs.push({ name: `1440x2-${k}`, w: 1440, h: 900, dsf: 2, dark, clip: { x: 0, y: 330, width: 190, height: 130 } })
  runs.push({ name: `375x3-${k}`, w: 375, h: 812, dsf: 3, dark, mobile: true, clip: { x: 0, y: 330, width: 15, height: 360 } })
  runs.push({ name: `375x3-ios-scrolled-${k}`, w: 375, h: 812, dsf: 3, dark, mobile: true, ios: true, scroll: 700, clip: { x: 0, y: 330, width: 15, height: 360 } })
}
const port = 9300 + Math.floor(Math.random() * 300)
const dir = path.join(process.env.TMPDIR ?? '/tmp', `chrome-tc-${port}`)
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
for (const r of runs) {
  if (only && !new RegExp(only).test(r.name)) continue
  await send('Emulation.setDeviceMetricsOverride', { width: r.w, height: r.h, deviceScaleFactor: r.dsf, mobile: !!r.mobile })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: r.dark ? 'dark' : 'light' }] })
  await send('Emulation.setUserAgentOverride', r.ios ? { userAgent: IOS_UA, platform: 'iPhone' } : { userAgent: '' })
  await send('Emulation.setTouchEmulationEnabled', { enabled: !!r.ios, maxTouchPoints: 5 })
  let p = '/writing'
  if (r.dark) {
    await send('Page.navigate', { url: base + '/writing' })
    await sleep(3500)
    p = (await js(`(document.querySelector('a[href^="/writing/"]')||{}).getAttribute?.('href') || '/writing'`)) ?? '/writing'
  }
  await send('Page.navigate', { url: base + p })
  for (let i = 0; i < 120; i++) { await sleep(500); if (await js(`!!document.querySelector('.paper-grid__gl[data-ready]') || document.querySelector('.paper-grid')?.hasAttribute('data-fallback')`)) break }
  if (r.scroll) { await js(`window.scrollTo(0, ${r.scroll})`); await sleep(800) }
  await sleep(2500)
  const info = await js(`JSON.stringify({gl: !!document.querySelector('.paper-grid__gl[data-ready]'), still: document.querySelector('.paper-grid__gl')?.hasAttribute('data-still'), dpr: devicePixelRatio, reading: document.documentElement.hasAttribute('data-reading')})`)
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { ...r.clip, y: r.clip.y + (r.scroll ?? 0), scale: 1 } }) // clip is in document coordinates
  fs.writeFileSync(path.join(outDir, `${prefix}-${r.name}.png`), Buffer.from(shot.result.data, 'base64'))
  console.log(r.name, p, info)
}
chrome.kill()
ws.close()
process.exit(0)
