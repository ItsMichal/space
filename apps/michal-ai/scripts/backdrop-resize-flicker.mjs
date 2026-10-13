// Reproduces the iOS Safari URL-bar scroll flicker as far as a desktop browser can: the layout viewport height changes by the
// size of the toolbar while the page scrolls. For each backdrop canvas clear (width/height assignment) it records how long the
// bitmap stayed blank (time to the next draw, rAF ticks that passed in between), and it screencasts the page and reports how many
// presented frames had a blank (dark) backdrop. Needs `next dev` and Chrome.
// Usage: node scripts/backdrop-resize-flicker.mjs [baseUrl=http://localhost:3412] [out.json]
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const WS = require('ws')
const sharp = require('sharp')
const base = process.argv[2] ?? 'http://localhost:3412'
const outJson = process.argv[3]
const query = process.argv[4] ?? '' // e.g. ?bdscroll=live
const ios = process.env.IOS === '1' // emulate an iPhone user agent (selects the iOS WebKit path)
const port = 9800 + Math.floor(Math.random() * 100)
const dir = path.join(process.env.TMPDIR ?? '/tmp', `chrome-rf-${port}`)
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
const frames = []
ws.on('message', (d) => {
  const m = JSON.parse(String(d))
  if (m.id && pending.has(m.id)) pending.get(m.id)(m)
  if (m.method === 'Page.screencastFrame') {
    frames.push({ ts: m.params.metadata.timestamp, data: m.params.data })
    send('Page.screencastFrameAck', { sessionId: m.params.sessionId })
  }
})
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable')
// Instrumentation, installed before any page script: log every width/height assignment on the backdrop canvas and every draw.
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(()=>{
    window.__log = []; window.__ticks = 0;
    const tick = () => { window.__ticks++; requestAnimationFrame(tick) }; requestAnimationFrame(tick)
    for (const k of ['width','height']) {
      const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, k)
      Object.defineProperty(HTMLCanvasElement.prototype, k, { get(){ return d.get.call(this) }, set(v){ if (this.className === 'paper-grid__gl') window.__log.push({ e: 'clear', k, v, t: performance.now(), ticks: window.__ticks }); d.set.call(this, v) } })
    }
    const da = WebGL2RenderingContext.prototype.drawArrays
    WebGL2RenderingContext.prototype.drawArrays = function(...a){ if (this.canvas.className === 'paper-grid__gl' && this.getParameter(this.FRAMEBUFFER_BINDING) === null) window.__log.push({ e: 'draw', t: performance.now(), ticks: window.__ticks }); return da.apply(this, a) }
  })()`,
})
const H0 = 664 // iPhone Safari with the toolbar expanded (visual area), 375 wide
const H1 = 750 // toolbar collapsed
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: H0, deviceScaleFactor: 2, mobile: true })
if (ios) {
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', platform: 'iPhone' })
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
}
await send('Page.navigate', { url: base + '/' + query })
for (let i = 0; i < 240; i++) { await sleep(500); if (await js(`!!document.querySelector('.paper-grid__gl[data-ready]')`)) break }
await sleep(2500)
await js(`window.scrollTo(0, 1150)`)
await sleep(800)
await js(`window.__log.length = 0`)
await send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: 375, everyNthFrame: 1 })
// the toolbar collapsing and expanding six times, with the page scrolling underneath
for (let n = 0; n < 6; n++) {
  for (const h of [H0 + 20, H0 + 45, H1, H1, H0 + 40, H0 + 10]) {
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: h, deviceScaleFactor: 2, mobile: true })
    await js(`window.scrollBy(0, 40)`)
    await sleep(70)
  }
  await js(`window.scrollTo(0, 1150)`)
}
await sleep(600)
await send('Page.stopScreencast')
const resizeLogJson = await js(`JSON.stringify(window.__log)`)
// Phase 2: a 3 s continuous scroll (a swipe) at 60 steps per second; count backdrop draws and clears while the page moves.
await js(`window.scrollTo(0, 0); window.__log.length = 0`)
await sleep(500)
await js(`window.__log.length = 0`)
const tr = []
const t0 = Date.now()
for (let y = 0; Date.now() - t0 < 3000; y += 14) {
  await js(`window.scrollTo(0, ${y})`)
  if (tr.length < 400) tr.push(await js(`getComputedStyle(document.querySelector('.paper-grid__gl')).transform`))
  await sleep(16)
}
const scrollLog = JSON.parse(await js(`JSON.stringify(window.__log)`))
const scrollPhase = { drawsDuringScroll: scrollLog.filter((e) => e.e === 'draw').length, clearsDuringScroll: scrollLog.filter((e) => e.e === 'clear').length, transformsSeen: new Set(tr).size, lastTransform: tr[tr.length - 1] }
const log = resizeLogJson
const events = JSON.parse(log)
const gaps = []
for (let i = 0; i < events.length; i++) {
  if (events[i].e !== 'clear') continue
  const nextDraw = events.slice(i + 1).find((x) => x.e === 'draw')
  if (nextDraw) gaps.push({ ms: +(nextDraw.t - events[i].t).toFixed(1), ticksBetween: nextDraw.ticks - events[i].ticks })
}
const clears = events.filter((e) => e.e === 'clear').length
// presented frames: mean luma of the whole frame; a blank backdrop shows as a dark outlier
const lumas = []
for (const f of frames) {
  const { data, info } = await sharp(Buffer.from(f.data, 'base64')).raw().toBuffer({ resolveWithObject: true })
  let sum = 0, n = 0
  for (let y = 0; y < info.height; y += 4) for (let x = 0; x < info.width; x += 4) { const o = (y * info.width + x) * info.channels; sum += 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]; n++ }
  lumas.push(sum / n)
}
const sorted = [...lumas].sort((a, b) => a - b)
const median = sorted[Math.floor(sorted.length / 2)] ?? 0
const dark = lumas.filter((l) => l < median * 0.6).length
const result = { mode: ios ? 'ios-ua' : 'desktop-ua', query, scrollPhase, clears, blankGaps: gaps, maxBlankMs: Math.max(0, ...gaps.map((g) => g.ms)), framesWithBlankTick: gaps.filter((g) => g.ticksBetween >= 1).length, screencastFrames: frames.length, medianLuma: +median.toFixed(1), minLuma: +(sorted[0] ?? 0).toFixed(1), darkFrames: dark }
console.log(JSON.stringify(result))
if (outJson) fs.writeFileSync(outJson, JSON.stringify({ ...result, lumas }, null, 1))
chrome.kill()
ws.close()
process.exit(0)
