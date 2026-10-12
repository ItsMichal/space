// Rasterises the favicon PNGs with headless Chrome (CDP, transparent background, true pixel size, device scale 1):
//   public/favicon-16.png, favicon-32.png, favicon-48.png  from svg/hmark-3-small.svg (the simplified small-size variant)
//   public/apple-touch-icon.png (180)  from svg/hmark-3-blue.svg (the full mark, full-bleed square: iOS rounds it itself)
// usage: node apps/halmic/brand/render-favicons.mjs   (CHROME_PATH, else the macOS / /opt/pw-browsers/chromium defaults used by scripts/shot.mjs)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, '../public');
const chromePath = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));
if (!chromePath) { console.error('No Chrome found: set CHROME_PATH'); process.exit(1); }
const jobs = [
  ['svg/hmark-3-small.svg', 'favicon-16.png', 16, false], ['svg/hmark-3-small.svg', 'favicon-32.png', 32, false],
  ['svg/hmark-3-small.svg', 'favicon-48.png', 48, false],
  ['svg/hmark-3-blue.svg', 'apple-touch-icon.png', 180, true],
];
const port = 9700 + Math.floor(Math.random() * 200), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fav-'));
const chrome = spawn(chromePath, [...(process.platform === 'linux' ? ['--no-sandbox'] : []), '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch { /* wait */ } await sleep(200); }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));
  let id = 0; const pending = new Map();
  ws.on('message', (m) => { const d = JSON.parse(m); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable');
  const render = async (svg, size) => {
    await send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
    await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    const html = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`;
    await send('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(html).toString('base64') });
    await sleep(400);
    return Buffer.from((await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } })).result.data, 'base64');
  };
  for (const [src, out, size, opaque] of jobs) {
    let svg = fs.readFileSync(path.join(here, src), 'utf8');
    if (opaque) svg = svg.replace(/ rx="[^"]+"/, '');
    fs.writeFileSync(path.join(pub, out), await render(svg, size));
    console.log('wrote', out);
  }
  // zoomed comparison of the old mark 3 against the small variant at 16 and 32px, native size plus nearest-neighbour zoom (shots/favicon-16-compare.png)
  const oldSvg = fs.readFileSync(path.join(here, 'svg/hmark-3-blue.svg'), 'utf8'), newSvg = fs.readFileSync(path.join(here, 'svg/hmark-3-small.svg'), 'utf8');
  const uri = (b) => 'data:image/png;base64,' + b.toString('base64');
  const imgs = { o16: uri(await render(oldSvg, 16)), n16: uri(await render(newSvg, 16)), o32: uri(await render(oldSvg, 32)), n32: uri(await render(newSvg, 32)) };
  const cell = (k, size, z, label) => `<div class="c"><div class="z" style="width:${size * z}px;height:${size * z}px;background-image:url(${imgs[k]});background-size:${size * z}px"></div><p><img src="${imgs[k]}" width="${size}" height="${size}"> ${label}</p></div>`;
  const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#1b1a22;color:#f1ece1;font:15px/1.3 system-ui;padding:24px;width:1100px}h2{font:600 18px system-ui;margin:0 0 12px}.row{display:flex;gap:40px;align-items:flex-end;margin-bottom:28px}.z{image-rendering:pixelated;background-repeat:no-repeat;background-color:#fff}.c p{margin:8px 0 0;display:flex;gap:10px;align-items:center}</style>
<h2>16px (zoom 14x, native beside the label)</h2><div class="row">${cell('o16', 16, 14, 'before: mark 3 (plus joint)')}${cell('n16', 16, 14, 'after: small variant')}</div>
<h2>32px (zoom 7x)</h2><div class="row">${cell('o32', 32, 7, 'before: mark 3')}${cell('n32', 32, 7, 'after: small variant')}</div>`;
  await send('Emulation.setDeviceMetricsOverride', { width: 1150, height: 640, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 27, g: 26, b: 34, a: 1 } });
  await send('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(page).toString('base64') });
  await sleep(600);
  fs.mkdirSync(path.join(here, '../shots'), { recursive: true });
  fs.writeFileSync(path.join(here, '../shots/favicon-16-compare.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
  console.log('wrote shots/favicon-16-compare.png');
  ws.close();
} finally { chrome.kill(); await sleep(300); fs.rmSync(dir, { recursive: true, force: true }); process.exit(0); }
