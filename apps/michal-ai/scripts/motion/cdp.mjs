// Minimal CDP client + headless Chrome launcher for the motion harness. No browser dependency is added: it drives the
// installed Google Chrome (or $CHROME) over the DevTools protocol using the `ws` package that is already in the tree.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const WS = require('ws')
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const CANDIDATES = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

export async function launch({
  port = 9400 + Math.floor(Math.random() * 400),
  headless = true,
} = {}) {
  const bin = CANDIDATES.find((p) => fs.existsSync(p))
  if (!bin) throw new Error('No Chrome found. Set CHROME=/path/to/chrome')
  const dir = fs.mkdtempSync(
    path.join(process.env.TMPDIR ?? os.tmpdir(), 'motion-chrome-')
  )
  const proc = spawn(
    bin,
    [
      headless ? '--headless=new' : '',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${dir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
      // GPU: MOTION_GPU=swiftshader forces software GL (deterministic but slow with the WebGL hero); default is the machine's GPU.
      ...(process.env.MOTION_GPU === 'swiftshader'
        ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
        : ['--use-angle=metal']),
      '--ignore-gpu-blocklist',
      '--enable-gpu-rasterization',
      'about:blank',
    ].filter(Boolean),
    { stdio: 'ignore' }
  )
  let targets
  for (let i = 0; i < 80; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      if (targets.some((t) => t.type === 'page')) break
    } catch {}
    await sleep(250)
  }
  if (!targets) throw new Error('Chrome did not start')
  const page = targets.find((t) => t.type === 'page')
  const ws = new WS(page.webSocketDebuggerUrl, {
    perMessageDeflate: false,
    maxPayload: 256 * 1024 * 1024,
  })
  await new Promise((r, j) => (ws.on('open', r), ws.on('error', j)))
  let id = 0
  const pending = new Map()
  const listeners = new Map()
  ws.on('message', (raw) => {
    const m = JSON.parse(raw)
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id)
      pending.delete(m.id)
      m.error ? rej(new Error(`${m.error.message}`)) : res(m.result)
    } else if (m.method)
      for (const f of listeners.get(m.method) ?? []) f(m.params)
  })
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id
      pending.set(i, { res, rej })
      ws.send(JSON.stringify({ id: i, method, params }))
    })
  const on = (method, f) => {
    listeners.set(method, [...(listeners.get(method) ?? []), f])
    return () =>
      listeners.set(
        method,
        (listeners.get(method) ?? []).filter((x) => x !== f)
      )
  }
  const evaluate = async (expression, awaitPromise = true) => {
    const r = await send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
    })
    if (r.exceptionDetails)
      throw new Error(
        r.exceptionDetails.exception?.description ?? r.exceptionDetails.text
      )
    return r.result.value
  }
  const close = async () => {
    try {
      ws.close()
    } catch {}
    proc.kill('SIGKILL')
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {}
  }
  return { send, on, evaluate, close }
}
