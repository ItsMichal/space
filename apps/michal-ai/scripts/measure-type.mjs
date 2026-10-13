// Reports the distinct computed font sizes of all visible text nodes, per route and viewport, in headless Chrome (device
// metrics emulation through CDP). Used to audit the type scale (docs/design-system/type-scale.md).
// Needs a running site (default http://localhost:3100) and Google Chrome.
// Usage: node scripts/measure-type.mjs [--json out.json] [--check]
//   --check  exit 1 when a route shows a size outside the scale (tokens + display exceptions); mono text is exempt.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const WS = require('ws')
const base = process.env.BASE ?? 'http://localhost:3100'
const args = process.argv.slice(2)
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null
const check = args.includes('--check')

const ROUTES = [
  ['home', '/'],
  ['projects', '/projects'],
  ['writing', '/writing'],
  ['about', '/about'],
  ['resume', '/resume'],
  ['project', '/projects/project-mountaintop'],
  ['child', '/projects/project-mountaintop/week-5-6-space'],
  ['post', '/writing/creating-my-first-pcb-object'],
  ['404', '/does-not-exist'],
]
const VIEWPORTS = [
  ['1440', 1440, 900, 1, false],
  ['375', 375, 812, 2, true],
]

const port = 9700 + Math.floor(Math.random() * 200)
const dir = path.join(process.env.TMPDIR ?? '/tmp', `chrome-type-${port}`)
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
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id
    pending.set(i, res)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.result?.value
await send('Page.enable')

// Collect {size -> {n, mono, where[]}} for visible text. `where` holds up to 4 "tag.class: text" samples per size.
const COLLECT = `(() => {
  const out = {}
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n
  while ((n = w.nextNode())) {
    const t = n.textContent.replace(/\\s+/g, ' ').trim()
    if (!t) continue
    const el = n.parentElement
    if (!el || el.closest('script,style,noscript,template')) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    // sr-only / clipped text is not visible type
    if (cs.clip && cs.clip !== 'auto' && r.width <= 1) continue
    if (r.width <= 1 || r.height <= 1) continue
    if (r.bottom + scrollY < 0 || r.right + scrollX < 0) continue // skip links parked off-screen
    const size = cs.fontSize
    const mono = /mono|ui-monospace|menlo/i.test(cs.fontFamily) && !/newsreader|michelangelus/i.test(cs.fontFamily.split(',')[0])
    const key = size + (mono ? ' mono' : '')
    const o = (out[key] ??= { n: 0, where: [] })
    o.n += t.length
    if (o.where.length < 4) {
      const cls = (el.className && typeof el.className === 'string' ? el.className.trim().split(/\\s+/)[0] : '')
      const sample = el.tagName.toLowerCase() + (cls ? '.' + cls : '') + ': ' + t.slice(0, 28)
      if (!o.where.includes(sample)) o.where.push(sample)
    }
  }
  return out
})()`

const results = {}
for (const [vname, w, h, dpr, mobile] of VIEWPORTS) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile })
  for (const [rname, route] of ROUTES) {
    await send('Page.navigate', { url: base + route })
    await sleep(2500)
    // scroll through so reveal-on-scroll content shows
    const total = (await ev('document.documentElement.scrollHeight')) ?? 0
    for (let y = 0; y < total; y += h * 0.7) {
      await ev(`window.scrollTo(0, ${y})`)
      await sleep(120)
    }
    await sleep(900)
    const set = await ev(COLLECT)
    results[`${rname}@${vname}`] = set
    if (mobile && rname === 'home') {
      // phone menu: open it and measure what it shows
      await ev(`window.scrollTo(0,0)`)
      const opened = await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /menu/i.test(x.getAttribute('aria-label') || x.textContent)); if (!b) return false; b.click(); return true })()`)
      if (opened) {
        await sleep(1200)
        results[`menu@${vname}`] = await ev(COLLECT)
      }
    }
  }
}
chrome.kill()
ws.close()

const rows = Object.entries(results)
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(results, null, 2))
for (const [k, set] of rows) {
  const sizes = Object.keys(set).sort((a, b) => parseFloat(a) - parseFloat(b))
  console.log(`\n${k}  (${sizes.filter((s) => !s.includes('mono')).length} sizes)`)
  for (const s of sizes) console.log(`  ${s.padEnd(12)} ${String(set[s].n).padStart(6)} chars  ${set[s].where.join(' | ')}`)
}
const union = new Map()
for (const [, set] of rows) for (const s of Object.keys(set)) union.set(s, (union.get(s) ?? 0) + 1)
console.log('\ndistinct sizes across all routes:', [...union.keys()].sort((a, b) => parseFloat(a) - parseFloat(b)).join(', '))

if (check) {
  const allowed = JSON.parse(process.env.ALLOWED_SIZES ?? '[]')
  let bad = 0
  for (const [k, set] of rows) for (const s of Object.keys(set)) if (!s.includes('mono') && !allowed.includes(s)) (bad++, console.error(`${k}: ${s} not in scale`))
  process.exit(bad ? 1 : 0)
}
