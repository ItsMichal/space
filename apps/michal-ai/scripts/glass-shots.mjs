// Headless-Chrome screenshots + measured contrast of the nav bar glass, over the CDP websocket (no puppeteer needed).
//
//   node scripts/glass-shots.mjs [baseUrl=http://localhost:3123] [outDir=docs/glass-shots]
//
// Needs a running site (next start / next dev) and Google Chrome. For each scenario it emulates the OS colour scheme and a
// viewport, loads the page (or client-navigates from home when `nav` is set), scrolls, optionally opens the phone menu,
// screenshots the nav region, and measures contrast: the bar is rendered with its glyphs hidden, sampled on a grid, and the
// worst sample is compared with the computed colour of the glyphs.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import WebSocket from 'ws'

const base = process.argv[2] ?? 'http://localhost:3123'
const out = path.resolve(process.argv[3] ?? 'docs/glass-shots')
const only = process.env.ONLY // substring filter on the scenario name
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9333 + Math.floor(Math.random() * 300)
fs.mkdirSync(out, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${PORT}`, '--headless=new', '--hide-scrollbars', '--no-first-run', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', `--user-data-dir=${fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'glass-chrome-'))}`, 'about:blank'],
  { stdio: 'ignore' },
)
process.on('exit', () => chrome.kill())

async function wsUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const t = (await r.json()).find((x) => x.type === 'page')
      if (t) return t.webSocketDebuggerUrl
    } catch {}
    await sleep(200)
  }
  throw new Error('chrome did not start')
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url)
    this.id = 0
    this.pending = new Map()
    this.ready = new Promise((r) => this.ws.on('open', r))
    this.ws.on('message', (m) => {
      const d = JSON.parse(m)
      if (d.id && this.pending.has(d.id)) {
        const { res, rej } = this.pending.get(d.id)
        this.pending.delete(d.id)
        d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result)
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((res, rej) => this.pending.set(id, { res, rej }))
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval failed')
    return r.result.value
  }
}

// Measured inside the page. Hides glyphs, screenshots via a callback is not possible in-page, so the sample runs on pixels the
// caller passes back as a data URL.
const SAMPLE = (dataUrl, rect, dpr) =>
  `(async()=>{
    const img = await createImageBitmap(await (await fetch(${JSON.stringify(dataUrl)})).blob());
    const c = new OffscreenCanvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img,0,0);
    const r = ${JSON.stringify(rect)}, dpr = ${dpr};
    const lin = v => { v/=255; return v<=0.04045? v/12.92 : Math.pow((v+0.055)/1.055,2.4) };
    const L = (p) => 0.2126*lin(p[0])+0.7152*lin(p[1])+0.0722*lin(p[2]);
    const out = [];
    const nx = 14, ny = Math.max(2, Math.round(r.h/18));
    for (let j=0;j<ny;j++) for (let i=0;i<nx;i++) {
      const px = Math.round((r.x + r.r_pad + (r.w-2*r.r_pad)*(i+0.5)/nx)*dpr), py = Math.round((r.y + 6 + (r.h-12)*(j+0.5)/ny)*dpr);
      const d = x.getImageData(px,py,1,1).data; out.push([d[0],d[1],d[2]]);
    }
    return out;
  })()`

function contrastRatio(fg, bgs) {
  const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  const L = (p) => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2])
  const lf = L(fg)
  let min = Infinity
  let sum = [0, 0, 0]
  for (const b of bgs) {
    const lb = L(b)
    min = Math.min(min, (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05))
    sum = sum.map((s, i) => s + b[i])
  }
  const mean = sum.map((s) => Math.round(s / bgs.length))
  const lm = L(mean)
  return { worst: min, mean: (Math.max(lf, lm) + 0.05) / (Math.min(lf, lm) + 0.05), meanRgb: mean }
}

const scenarios = []
for (const scheme of ['light', 'dark']) {
  for (const vp of [
    { id: '375', w: 375, h: 812, mobile: true },
    { id: '1440', w: 1440, h: 900, mobile: false },
  ]) {
    const menus = vp.mobile ? [false, true] : [false]
    for (const menu of menus) {
      const m = menu ? '-menu' : ''
      scenarios.push({ name: `home-top-${scheme}-${vp.id}${m}`, scheme, vp, url: '/', scrollY: 0, menu })
      scenarios.push({ name: `home-starlink-${scheme}-${vp.id}${m}`, scheme, vp, url: '/', find: 'starlink', menu })
      scenarios.push({ name: `project-facts-${scheme}-${vp.id}${m}`, scheme, vp, url: '/projects/isat-dashboard', find: '.facts', menu })
      scenarios.push({ name: `project-facts-clientnav-${scheme}-${vp.id}${m}`, scheme, vp, url: '/projects/isat-dashboard', via: '/', find: '.facts', menu })
      scenarios.push({ name: `post-${scheme}-${vp.id}${m}`, scheme, vp, url: process.env.POST ?? '/projects/spacex-starlink-product-launch', scrollY: 900, menu })
    }
  }
}

const target = new Cdp(await wsUrl())
await target.ready
await target.send('Page.enable')
await target.send('Runtime.enable')

const rows = []
for (const s of scenarios) {
  if (only && !s.name.includes(only)) continue
  const dpr = 2
  await target.send('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-color-scheme', value: s.scheme }] })
  await target.send('Emulation.setDeviceMetricsOverride', { width: s.vp.w, height: s.vp.h, deviceScaleFactor: dpr, mobile: s.vp.mobile })
  const go = async (u) => {
    await target.send('Page.navigate', { url: base + u })
    await sleep(2500)
  }
  await go(s.via ?? s.url)
  if (s.via) {
    // client-side navigation: click the link so the nav (and the engine) survive the route change
    await target.eval(`(()=>{const a=document.querySelector('a[href="${s.url}"]'); if(a){a.click(); return true} return false})()`)
    await sleep(2500)
  }
  if (s.find === 'starlink') {
    await target.eval(`(()=>{const a=[...document.querySelectorAll('a,img,[style*=background]')].find(e=>/starlink/i.test((e.getAttribute('href')||'')+(e.getAttribute('src')||'')+(e.getAttribute('style')||'')));
      if(a){a.scrollIntoView({block:'start'}); window.scrollBy(0,-40)} })()`)
  } else if (s.find) {
    await target.eval(`(()=>{const e=document.querySelector(${JSON.stringify(s.find)}); if(e){e.scrollIntoView({block:'center'})}})()`)
  } else if (s.scrollY != null) {
    await target.eval(`window.scrollTo(0, ${s.scrollY})`)
  }
  await sleep(800)
  if (s.menu) {
    await target.eval(`document.querySelector('button[aria-controls="nav-sheet"]')?.click()`)
    await sleep(900)
  }
  const info = await target.eval(`(()=>{
    const nav = document.querySelector('header nav'); if(!nav) return null;
    const r = nav.getBoundingClientRect();
    const word = nav.querySelector('.font-display') || nav;
    return { x:r.x, y:r.y, w:r.width, h:r.height, fg:getComputedStyle(word).color,
      reading: document.documentElement.hasAttribute('data-reading'),
      tone: nav.getAttribute('data-glass-tone'), live: nav.hasAttribute('data-glass-live') || !!document.querySelector('header .glass-surface'),
      engine: document.querySelector('header .glass-fx') ? 'svg' : document.querySelector('header .glass-frost') ? 'frost' : 'flat' }
  })()`)
  if (!info) {
    console.log(s.name, 'NO NAV')
    continue
  }
  // 1) glyphs hidden -> sample the bar
  await target.eval(`document.head.insertAdjacentHTML('beforeend','<style id="mx-hide">header nav a,header nav button,header nav svg,header nav li,header nav .sheet-prow{visibility:hidden!important}</style>')`)
  await sleep(250)
  const bare = await target.send('Page.captureScreenshot', { format: 'png' })
  await target.eval(`document.getElementById('mx-hide')?.remove()`)
  await sleep(250)
  const pad = Math.min(info.h / 2, 24)
  const samples = await target.eval(SAMPLE('data:image/png;base64,' + bare.data, { x: info.x, y: info.y, w: info.w, h: info.h, r_pad: pad }, dpr))
  const fg = info.fg.match(/[\d.]+/g).slice(0, 3).map(Number)
  const c = contrastRatio(fg, samples)
  // 2) the real shot, cropped to the nav region
  const clip = { x: 0, y: 0, width: s.vp.w, height: Math.min(s.vp.h, Math.ceil(info.y + info.h + 56)), scale: 1 }
  const shot = await target.send('Page.captureScreenshot', { format: 'png', clip })
  const file = path.join(out, `${s.name}.png`)
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'))
  rows.push({ name: s.name, engine: info.engine, reading: info.reading, tone: info.tone, fg: info.fg, bar: `rgb(${c.meanRgb.join(',')})`, worst: +c.worst.toFixed(2), mean: +c.mean.toFixed(2) })
  console.log(s.name.padEnd(46), info.engine.padEnd(5), 'reading=' + info.reading, 'tone=' + info.tone, 'fg=' + info.fg, 'bar=rgb(' + c.meanRgb + ')', 'contrast worst', c.worst.toFixed(2), 'mean', c.mean.toFixed(2))
}
fs.writeFileSync(path.join(out, 'contrast.json'), JSON.stringify(rows, null, 2))
chrome.kill()
process.exit(0)
