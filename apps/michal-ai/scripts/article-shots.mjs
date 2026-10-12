// Headless-Chrome screenshots and layout assertions for the reading view (dev tool, not part of the build).
//
//   node scripts/article-shots.mjs [baseUrl] [outDir] [--only=substring]
//
// Needs a running site (npm run dev -w @space/michal-ai) and Google Chrome. For each route x viewport x colour scheme it
// saves a PNG and prints assertions: the text column is horizontally centred (left and right gaps equal within 1px),
// `ul > li` markers are rendered, nothing overflows the page horizontally.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const args = process.argv.slice(2)
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1]
const pos = args.filter((a) => !a.startsWith('--'))
const BASE = pos[0] ?? 'http://localhost:3000'
const OUT = path.resolve(pos[1] ?? 'docs/article-shots')
const ONLY = flag('only')
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const VIEWPORTS = [
  { id: '1440', w: 1440, h: 900, mobile: false },
  { id: '1920', w: 1920, h: 1080, mobile: false },
  { id: '375', w: 375, h: 812, mobile: true },
]
const SCHEMES = ['light', 'dark']

/** name, path, what to capture: 'top' | 'end' | selector of a region to scroll to (viewport-sized). */
const SHOTS = [
  { name: 'starlink-list', path: '/projects/spacex-starlink-general-projects', at: '.prose ul' },
  { name: 'starlink-timeline', path: '/projects/spacex-starlink-general-projects', at: '.tl' },
  { name: 'writing-top', path: '/writing/creating-my-first-pcb-object', at: 'top' },
  { name: 'writing-end', path: '/writing/creating-my-first-pcb-object', at: 'end' },
  { name: 'mountaintop-log', path: '/projects/project-mountaintop/mountaintop-first-steps-week-1-2-recap', at: 'top' },
  { name: 'kitchen-sink', path: '/kitchen-sink', at: 'top', full: true },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function launch() {
  const port = 9300 + Math.floor(Math.random() * 500)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shots-'))
  const p = spawn(CHROME, [`--remote-debugging-port=${port}`, '--headless=new', '--hide-scrollbars', '--no-first-run', `--user-data-dir=${dir}`, 'about:blank'], {
    stdio: 'ignore',
  })
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (r.ok) return { p, port }
    } catch {}
    await sleep(250)
  }
  throw new Error('Chrome did not start')
}

function cdp(url) {
  const ws = new WebSocket(url)
  let id = 0
  const pending = new Map()
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pending.has(d.id)) {
      const { res, rej } = pending.get(d.id)
      pending.delete(d.id)
      d.error ? rej(new Error(d.error.message)) : res(d.result)
    }
  }
  const ready = new Promise((r) => (ws.onopen = r))
  return {
    ready,
    send: (method, params = {}) =>
      new Promise((res, rej) => {
        const i = ++id
        pending.set(i, { res, rej })
        ws.send(JSON.stringify({ id: i, method, params }))
      }),
    close: () => ws.close(),
  }
}

const ASSERT = `(() => {
  const out = {}
  const vw = document.documentElement.clientWidth
  out.vw = vw
  out.hOverflow = document.documentElement.scrollWidth - vw
  const col = document.querySelector('.prose') || document.querySelector('[data-column]')
  if (col) {
    const r = col.getBoundingClientRect()
    out.col = { left: Math.round(r.left * 10) / 10, right: Math.round((vw - r.right) * 10) / 10, width: Math.round(r.width) }
    out.centered = Math.abs(r.left - (vw - r.right)) <= 1
  }
  const lis = [...document.querySelectorAll('.prose ul > li')].filter((l) => !l.classList.contains('task-list-item'))
  out.ul = { items: lis.length, markers: lis.filter((l) => getComputedStyle(l).display === 'list-item' && getComputedStyle(l.parentElement).listStyleType !== 'none').length }
  const ps = [...document.querySelectorAll('.prose > p')]
  if (ps.length) {
    const p = ps.sort((a, b) => b.textContent.length - a.textContent.length)[0]
    // Characters on the first full line of the longest paragraph (the measure, as readers count it).
    const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); let node, count = 0, top = null, done = false
    while (!done && (node = w.nextNode())) {
      for (let i = 0; i < node.length; i++) {
        const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 1)
        const b = r.getClientRects()[0]; if (!b) continue
        if (top === null) top = b.top
        if (Math.abs(b.top - top) > 4) { done = true; break }
        count++
      }
    }
    out.measureCh = count
  }
  const tl = document.querySelector('.tl')
  if (tl) { const r = tl.getBoundingClientRect(); out.tl = { left: Math.round(r.left), right: Math.round(vw - r.right) } }
  return out
})()`

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const { p, port } = await launch()
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  const c = cdp(tab.webSocketDebuggerUrl)
  await c.ready
  await c.send('Page.enable')
  const results = []
  let failed = 0
  try {
    for (const shot of SHOTS) {
      if (ONLY && !shot.name.includes(ONLY)) continue
      for (const vp of VIEWPORTS) {
        for (const scheme of SCHEMES) {
          await c.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.mobile })
          await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] })
          await c.send('Page.navigate', { url: BASE + shot.path })
          for (let i = 0; i < 80; i++) {
            const ok = (await c.send('Runtime.evaluate', { expression: `document.readyState === 'complete' && !!document.querySelector('.prose')`, returnByValue: true })).result.value
            if (ok) break
            await sleep(500)
          }
          await sleep(1200)
          const a = JSON.parse((await c.send('Runtime.evaluate', { expression: `JSON.stringify(${ASSERT})`, returnByValue: true })).result.value)
          const scroll =
            shot.at === 'top'
              ? 'window.scrollTo(0,0)'
              : shot.at === 'end'
                ? 'window.scrollTo(0, document.body.scrollHeight)'
                : `(()=>{const e=document.querySelector(${JSON.stringify(shot.at)}); if(e){const y=e.getBoundingClientRect().top+scrollY-120; window.scrollTo(0,Math.max(0,y))}})()`
          await c.send('Runtime.evaluate', { expression: scroll })
          await sleep(900)
          let clip
          if (shot.full) {
            const h = (await c.send('Runtime.evaluate', { expression: 'document.documentElement.scrollHeight', returnByValue: true })).result.value
            await c.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: Math.min(h, 9000), deviceScaleFactor: 1, mobile: vp.mobile })
            await sleep(500)
          }
          const png = await c.send('Page.captureScreenshot', { format: 'png' })
          const file = `${shot.name}-${vp.id}-${scheme}.png`
          fs.writeFileSync(path.join(OUT, file), Buffer.from(png.data, 'base64'))
          const bad = []
          if (a.centered === false) bad.push('NOT CENTRED')
          if (a.hOverflow > 1) bad.push(`H-OVERFLOW ${a.hOverflow}`)
          if (a.ul?.items && a.ul.markers !== a.ul.items) bad.push(`MARKERS ${a.ul.markers}/${a.ul.items}`)
          if (bad.length) failed++
          results.push({ file, ...a, bad })
          console.log(`${bad.length ? 'FAIL' : 'ok  '} ${file}  col=${JSON.stringify(a.col)} ch=${a.measureCh} ul=${JSON.stringify(a.ul)} tl=${JSON.stringify(a.tl)} ${bad.join(' ')}`)
        }
      }
    }
  } finally {
    c.close()
    p.kill()
  }
  fs.writeFileSync(path.join(OUT, 'assertions.json'), JSON.stringify(results, null, 2))
  if (failed) process.exitCode = 1
}
main()
