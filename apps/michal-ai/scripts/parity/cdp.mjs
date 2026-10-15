// Tiny Chrome DevTools Protocol client (no dependencies beyond `ws`), same approach as scripts/shoot-cards.mjs.
// Needs Google Chrome and permission to bind/connect to localhost.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const WS = require('ws')
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

export async function launch() {
  const port = 9300 + Math.floor(Math.random() * 600)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-chrome-'))
  const proc = spawn(
    CHROME,
    ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
     '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb', 'about:blank'],
    { stdio: 'ignore' },
  )
  let targets
  for (let i = 0; i < 60; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      if (targets.length) break
    } catch {}
    await sleep(250)
  }
  if (!targets) throw new Error('Chrome did not start')
  const close = () => {
    try { proc.kill('SIGKILL') } catch {}
    fs.rmSync(dir, { recursive: true, force: true })
  }
  return { port, newPage: () => openPage(port, close), close }
}

async function openPage(port, close) {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WS(t.webSocketDebuggerUrl, { maxPayload: 256 * 1024 * 1024 })
  await new Promise((r) => ws.on('open', r))
  let id = 0
  const pending = new Map()
  const listeners = []
  ws.on('message', (d) => {
    const m = JSON.parse(String(d))
    if (m.id && pending.has(m.id)) pending.get(m.id)(m)
    else if (m.method) for (const l of listeners) l(m)
  })
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id
      pending.set(i, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)))
      ws.send(JSON.stringify({ id: i, method, params }))
    })
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')
  const page = {
    send, ev,
    on: (fn) => listeners.push(fn),
    async metrics({ width, height, mobile }) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: !!mobile })
      if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true })
    },
    async reducedMotion(on = true) {
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: on ? 'reduce' : 'no-preference' }] })
    },
    /** Navigate and wait for load, fonts, and a quiet network. */
    async goto(url, { settle = 800 } = {}) {
      let loaded
      const p = new Promise((r) => (loaded = r))
      const l = (m) => m.method === 'Page.loadEventFired' && loaded()
      listeners.push(l)
      await send('Page.navigate', { url })
      await Promise.race([p, sleep(30000)])
      listeners.splice(listeners.indexOf(l), 1)
      await ev('document.fonts.ready.then(() => true)')
      await sleep(settle)
    },
    async screenshot(file, { full = true, maxHeight = 14000 } = {}) {
      const h = full ? await ev('Math.min(document.documentElement.scrollHeight,' + maxHeight + ')') : undefined
      const vw = await ev('document.documentElement.clientWidth')
      const r = await send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: full,
        ...(full ? { clip: { x: 0, y: 0, width: vw, height: h, scale: 1 } } : {}),
      })
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'))
    },
    close: async () => {
      try { await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`) } catch {}
      ws.close()
    },
  }
  page.shutdown = close
  return page
}

/** CSS injected for screenshots: no motion, canvases (WebGL globe, backdrop, shader frames) hidden so GPU noise cannot differ. */
export const FREEZE_CSS = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
canvas{visibility:hidden!important}`
