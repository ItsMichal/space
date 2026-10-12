// Headless-Chrome screenshots and a keyboard walk-through for the logo switcher on both sites, over CDP (uses `ws`).
//
//   node scripts/switcher-shots.mjs [michalUrl=http://localhost:3111] [halmicUrl=http://localhost:4310] [outDir=docs/switcher-shots]
//
// Needs both sites running and Google Chrome. Writes PNGs to outDir and prints the keyboard walk-through result as JSON lines;
// exits 1 if a walk-through assertion fails.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import WebSocket from 'ws'

const [M = 'http://localhost:3111', H = 'http://localhost:4310', OUT = 'docs/switcher-shots'] = process.argv.slice(2)
const out = path.resolve(OUT)
fs.mkdirSync(out, { recursive: true })
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9333 + Math.floor(Math.random() * 300)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, '--headless=new', '--hide-scrollbars', '--no-first-run', `--user-data-dir=${fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'sw-chrome-'))}`, 'about:blank'], { stdio: 'ignore' })
process.on('exit', () => chrome.kill())

let ws, id = 0
const pending = new Map()
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const t = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === 'page')
      if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break }
    } catch {}
    await sleep(200)
  }
  await new Promise((r) => ws.on('open', r))
  ws.on('message', (m) => { const d = JSON.parse(m); if (d.id && pending.has(d.id)) { const { res, rej } = pending.get(d.id); pending.delete(d.id); d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result) } })
}
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value

async function open(url, { w, h, dark = false, touch = false, wait = 1800 }) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: touch ? 2 : 1, mobile: touch })
  await send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: 5 })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }, { name: 'hover', value: touch ? 'none' : 'hover' }, { name: 'pointer', value: touch ? 'coarse' : 'fine' }] })
  await send('Page.navigate', { url })
  await sleep(wait)
}
const rect = (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()`)
async function shot(name, clip) {
  // clip is given in viewport coordinates; captureScreenshot wants page coordinates
  const sy = clip ? await ev('window.scrollY') : 0
  const { data } = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, y: clip.y + sy, scale: 1 } } : {}) })
  fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(data, 'base64'))
  console.log('shot', name)
}
const move = (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
const key = async (k, code, vk) => { await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }) }
const tab = () => key('Tab', 'Tab', 9)
const esc = () => key('Escape', 'Escape', 27)
const active = () => ev(`(()=>{const a=document.activeElement;return a?(a.getAttribute('aria-label')||a.textContent.trim().slice(0,30)||a.tagName):null})()`)
const menuOpacity = (sel) => ev(`getComputedStyle(document.querySelector(${JSON.stringify(sel)})).opacity`)

await connect()
await send('Page.enable')
let fail = 0
const check = (name, ok, got) => { console.log(JSON.stringify({ name, ok, got })); if (!ok) fail = 1 }

// ---------------- michal.ai ----------------
const mClip = (r) => ({ x: Math.max(0, r.x - 40), y: 0, width: Math.min(1440, r.w + 80), height: 200 })
for (const [tag, url, dark] of [['light', `${M}/`, false], ['dark-reading', `${M}/projects/project-mountaintop/week-3-4-integration`, true]]) {
  await open(url, { w: 1440, h: 900, dark })
  await shot(`michal-nav-${tag}-closed`, { x: 360, y: 0, width: 720, height: 120 })
  const lr = await rect('.xsw__logo')
  await move(lr.x + lr.w / 2, lr.y + lr.h / 2)
  await sleep(500)
  await shot(`michal-nav-${tag}-open`, { x: 360, y: 0, width: 720, height: 200 })
  check(`michal ${tag}: hover opens`, (await menuOpacity('.xsw__menu')) === '1')
  await move(10, 600)
  await sleep(500)
  check(`michal ${tag}: leaving closes`, (await menuOpacity('.xsw__menu')) === '0')
}

// phone menu
await open(`${M}/`, { w: 375, h: 812, touch: true, wait: 3500 })
await shot('michal-phone-closed', { x: 0, y: 0, width: 375, height: 120 })
await ev(`document.querySelector('button[aria-controls="nav-sheet"]').click()`)
await sleep(1200)
check('michal phone: menu button reports expanded', (await ev(`document.querySelector('button[aria-controls="nav-sheet"]').getAttribute('aria-expanded')`)) === 'true')
await shot('michal-phone-menu-open', { x: 0, y: 0, width: 375, height: 812 })
check('michal phone: sheet has the row', await ev(`!!document.querySelector('#nav-sheet a[href="https://halmic.com"][rel="me"]')`))

// keyboard walk-through (desktop)
await open(`${M}/`, { w: 1440, h: 900, wait: 3000 })
for (let i = 0; i < 40 && !(await ev(`(()=>{const e=document.querySelector('.xsw');return !!e&&Object.keys(e).some(k=>k.startsWith('__reactProps')&&e[k].onKeyDown)})()`)); i++) await sleep(250) // wait for hydration
await move(5, 5)
await tab() // skip link
let a1 = await active()
for (let i = 0; i < 3 && !/michal\.ai, home/.test(a1 ?? ''); i++) { await tab(); a1 = await active() }
check('michal: Tab reaches the logo link', /michal\.ai, home/.test(a1 ?? ''), a1)
await sleep(300)
check('michal: focus opens the dropdown', (await menuOpacity('.xsw__menu')) === '1')
await tab()
const a2 = await active()
check('michal: next Tab reaches the crosslink', /halmic\.com/.test(a2 ?? ''), a2)
await shot('michal-nav-keyboard-focus-on-row', { x: 360, y: 0, width: 720, height: 200 })
await esc()
await sleep(400)
check('michal: Escape closes and returns focus to the logo', (await menuOpacity('.xsw__menu')) === '0' && /michal\.ai, home/.test((await active()) ?? ''), await active())

// paired content on michal.ai
await open(`${M}/projects/project-mountaintop`, { w: 1440, h: 900 })
await ev(`document.querySelector('.fr')?.scrollIntoView({block:'center'})`)
await sleep(700)
const fr = await rect('.fr')
await shot('michal-mountaintop-project-links', { x: Math.max(0, fr.x - 20), y: Math.max(0, fr.y - 20), width: Math.min(1440, fr.w + 40), height: fr.h + 40 })
await open(`${M}/projects/project-mountaintop/week-3-4-integration`, { w: 1440, h: 900, wait: 2500 })
await ev(`document.querySelector('a[rel="me"][href*="halmic.com/work"]')?.scrollIntoView({block:'center'})`)
await sleep(900)
await shot('michal-mountaintop-log-end', { x: 240, y: 200, width: 960, height: 500 })

// ---------------- halmic ----------------
await open(`${H}/`, { w: 1440, h: 900 })
await shot('halmic-header-closed', { x: 0, y: 0, width: 1440, height: 160 })
const hl = await rect('.xs-logo')
await move(hl.x + hl.w / 2, hl.y + hl.h / 2)
await sleep(500)
await shot('halmic-header-open', { x: 0, y: 0, width: 1440, height: 160 })
check('halmic: hover opens', (await menuOpacity('.xs-menu')) === '1')
await move(700, 600)
await sleep(500)
check('halmic: leaving closes', (await menuOpacity('.xs-menu')) === '0')

await open(`${H}/`, { w: 1440, h: 900 })
await move(5, 5)
let b1 = null
for (let i = 0; i < 4 && !/halmic, home/.test(b1 ?? ''); i++) { await tab(); b1 = await active() }
check('halmic: Tab reaches the logo link', /halmic, home/.test(b1 ?? ''), b1)
await sleep(300)
check('halmic: focus opens the dropdown', (await menuOpacity('.xs-menu')) === '1')
await tab()
const b2 = await active()
check('halmic: next Tab reaches the crosslink', /michal\.ai/.test(b2 ?? ''), b2)
await esc()
await sleep(400)
check('halmic: Escape closes and returns focus to the logo', (await menuOpacity('.xs-menu')) === '0' && /halmic, home/.test((await active()) ?? ''), await active())

await open(`${H}/`, { w: 375, h: 812, touch: true })
await ev(`document.querySelector('.foot')?.scrollIntoView({block:'end'})`)
await sleep(600)
await shot('halmic-phone-footer', { x: 0, y: 0, width: 375, height: 812 })
const td = [await ev(`getComputedStyle(document.querySelector('.xs-foot')).display`), await ev(`getComputedStyle(document.querySelector('.xs-menu')).display`)]
check('halmic touch: footer row visible, hover menu not', td[0] !== 'none' && td[1] === 'none', td)

await open(`${H}/work/project-mountaintop/`, { w: 1440, h: 900 })
const xl = await rect('p.xl')
await shot('halmic-mountaintop-project-link', { x: 0, y: Math.max(0, xl.y - 200), width: 1440, height: 400 })
await open(`${H}/work/project-mountaintop/week-3-4-integration/`, { w: 1440, h: 900 })
await shot('halmic-mountaintop-log-link', { x: 0, y: 0, width: 1440, height: 560 })

chrome.kill()
process.exit(fail)
