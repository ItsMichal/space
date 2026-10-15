// Prints /resume to PDF with headless Google Chrome: public/resume.pdf (US Letter) and public/resume-a4.pdf (A4).
// The page's own print stylesheet (components/about/resume.css) hides the site chrome and sets the type for paper.
// Needs a running site (default http://localhost:3100: `npm run dev:michal`, or `npm run build:michal` then `npm run start -w @space/michal-ai`).
// Usage: node scripts/build-resume-pdf.mjs [baseUrl] [outDir]
// The old public/BodzianowskiResume.pdf is left untouched until the owner approves the new one.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const WS = require('ws')
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const base = process.argv[2] ?? process.env.BASE ?? 'http://localhost:3100'
const outDir = path.resolve(process.argv[3] ?? path.join(root, 'public'))
fs.mkdirSync(outDir, { recursive: true })
const chromeBin = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const port = 9300 + Math.floor(Math.random() * 300)
const dir = path.join(process.env.TMPDIR ?? '/tmp', `chrome-resume-${port}`)
const chrome = spawn(chromeBin, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
try {
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
    new Promise((res, rej) => {
      const i = ++id
      pending.set(i, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)))
      ws.send(JSON.stringify({ id: i, method, params }))
    })
  await send('Page.enable')
  await send('Page.navigate', { url: `${base}/resume` })
  await sleep(2500)
  await send('Emulation.setEmulatedMedia', { media: 'print' })
  await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true })
  const sizes = [
    ['resume.pdf', 8.5, 11],
    ['resume-a4.pdf', 8.27, 11.69],
  ]
  for (const [name, w, h] of sizes) {
    const { data } = await send('Page.printToPDF', {
      paperWidth: w,
      paperHeight: h,
      marginTop: 0.5,
      marginBottom: 0.5,
      marginLeft: 0.55,
      marginRight: 0.55,
      printBackground: false,
      preferCSSPageSize: false,
      displayHeaderFooter: false,
    })
    fs.writeFileSync(path.join(outDir, name), Buffer.from(data, 'base64'))
    console.log('wrote', path.join(outDir, name))
  }
  ws.close()
} finally {
  chrome.kill()
}
