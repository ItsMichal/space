// Bakes the backdrop shader's static frame (blobs and rays, no glyphs, no grain) into the CSS fallback images
// public/backdrop/blobs-light.webp and blobs-dark.webp, and with --report measures the darkest/brightest pixel of the shader
// over many times and scroll offsets (for the contrast numbers in docs/backdrop.md).
// Needs `next dev` on :3411 (or pass a base URL) and Google Chrome. Usage: node scripts/bake-backdrop.mjs [baseUrl] [--report]
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const WS = require('ws')
const sharp = require('sharp')
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const base = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:3411'
const report = process.argv.includes('--report')

const port = 9400 + Math.floor(Math.random() * 300)
const dir = path.join(process.env.TMPDIR ?? '/tmp', `chrome-bake-${port}`)
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
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, res); setTimeout(() => rej(new Error('timeout ' + method)), 120000); ws.send(JSON.stringify({ id: i, method, params })) })
const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Page.enable')

let loaded = false
async function frame({ scheme, t, scroll, glyphs = 0, w = 640, h = 640 }) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
  if (!loaded) {
    await send('Page.navigate', { url: `${base}/?backdrop=bake` })
    for (let i = 0; i < 300; i++) {
      await sleep(500)
      if (await evalJs(`typeof window.__bake === 'function'`)) break
    }
    loaded = true
  }
  await sleep(300) // let the resize settle
  const url = await evalJs(`window.__bake(${t}, ${scroll}, ${scheme === 'dark' ? 1 : 0}, ${!!glyphs})`)
  return Buffer.from(url.split(',')[1], 'base64')
}

const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b // encoded (gamma) luma
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const contrast = (a, b) => { const [x, y] = [lum(...a), lum(...b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
if (report) {
  const T = {
    light: { paper: hex('#f4f1e8'), ink: hex('#18211b'), muted: hex('#525c4f'), glyph: [0.13 * 255, 0.13 * 255, 0.11 * 255] },
    dark: { paper: hex('#121612'), ink: hex('#ebe7da'), muted: hex('#a4ab99'), glyph: [0.92 * 255, 0.91 * 255, 0.85 * 255] },
  }
  const GLYPH_ALPHA = 0.22
  const GRAIN = 0.012 * 255 / 2 // grain adds up to +-0.006 of full scale
  for (const scheme of ['light', 'dark']) {
    const t = T[scheme]
    let min = Infinity, max = -Infinity, minPx, maxPx, minLuma = Infinity, maxLuma = -Infinity
    for (const scroll of [0, 700, 1500, 2600, 4000, 6500]) {
      for (const time of [37, 120, 260, 400]) {
        const png = await frame({ scheme, t: time, scroll, w: 960, h: 600 })
        const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true })
        for (let i = 0; i < data.length; i += info.channels) {
          const Y = lum(data[i], data[i + 1], data[i + 2])
          const L = luma(data[i], data[i + 1], data[i + 2])
          if (Y < min) { min = Y; minPx = [data[i], data[i + 1], data[i + 2]] }
          if (Y > max) { max = Y; maxPx = [data[i], data[i + 1], data[i + 2]] }
          minLuma = Math.min(minLuma, L); maxLuma = Math.max(maxLuma, L)
        }
      }
    }
    const Yp = lum(...t.paper), Lp = luma(...t.paper)
    // Worst case for text: the extreme backdrop pixel, a glyph at the alpha cap on top of it, and grain pushing the wrong way.
    const worst = (px) => px.map((c, k) => c * (1 - GLYPH_ALPHA) + t.glyph[k] * GLYPH_ALPHA + (scheme === 'light' ? -GRAIN : GRAIN))
    const bad = scheme === 'light' ? minPx : maxPx
    const bg = worst(bad)
    console.log(JSON.stringify({
      scheme, paperY: +Yp.toFixed(4), backdropMinY: +min.toFixed(4), minYRatioToPaper: +(min / Yp).toFixed(4), lumaFloorRatio: +(minLuma / Lp).toFixed(4), lumaMaxRatio: +(maxLuma / Lp).toFixed(4),
      backdropMaxY: +max.toFixed(4), minPx, maxPx,
      contrast: {
        ink_on_extreme_backdrop: +contrast(t.ink, bad).toFixed(2), muted_on_extreme_backdrop: +contrast(t.muted, bad).toFixed(2),
        ink_on_extreme_plus_glyph: +contrast(t.ink, bg).toFixed(2), muted_on_extreme_plus_glyph: +contrast(t.muted, bg).toFixed(2),
        ink_on_paper: +contrast(t.ink, t.paper).toFixed(2), muted_on_paper: +contrast(t.muted, t.paper).toFixed(2),
      },
    }))
  }
} else if (process.env.PNG) {
  for (const sc of (process.env.SCROLLS ?? '0').split(',')) {
    const png = await frame({ scheme: process.env.SCHEME ?? 'light', t: +(process.env.T ?? 37), scroll: +sc, glyphs: +(process.env.GLYPHS ?? 0), w: +(process.env.W ?? 960), h: +(process.env.H ?? 600) })
    fs.writeFileSync(`${process.env.PNG}-${sc}.png`, png)
  }
} else {
  fs.mkdirSync(path.join(root, 'public/backdrop'), { recursive: true })
  for (const scheme of ['light', 'dark']) {
    const png = await frame({ scheme, t: 37, scroll: 0 })
    const out = path.join(root, `public/backdrop/blobs-${scheme}.webp`)
    await sharp(png).resize(480, 480).webp({ quality: 82 }).toFile(out)
    fs.writeFileSync(path.join(process.env.TMPDIR ?? '/tmp', `blobs-${scheme}.png`), png)
    console.log('wrote', out, fs.statSync(out).size, 'bytes')
  }
}
chrome.kill()
ws.close()
process.exit(0)
