// Headless Chrome screenshot via CDP (uses the `ws` package from the portfolio repo, or any ws on the path).
// usage: node halmic/scripts/shot.mjs <url> <out.png> <width> <height> [full] [mobile] [wait-ms] [scrollY] [sel=css] [click=css] [clip=x,y,w,h]
//   extra flags: gl (software WebGL via SwiftShader), rm (emulate prefers-reduced-motion), eval=<js> (run after the wait, then 900 ms), netlog (print requests, sizes and the load time), jpg (write JPEG), nogl (getContext('webgl') returns null)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let WebSocket;
for (const p of ['ws', process.env.WS_PATH ?? 'ws']) { try { WebSocket = require(p); break; } catch { /* next */ } }
const [url, out, W = '1280', H = '800', ...flags] = process.argv.slice(2);
const full = flags.includes('full'), mobile = flags.includes('mobile');
const waitMs = +(flags.find((f) => /^\d+$/.test(f)) ?? 1500);
const dpr = flags.includes('dpr2') ? 2 : (mobile ? 2 : 1);
const clipArg = flags.find((f) => f.startsWith('clip='))?.slice(5).split(',').map(Number);
const scrollY = +(flags.find((f) => /^y\d+$/.test(f))?.slice(1) ?? 0);
const port = 9300 + Math.floor(Math.random() * 400);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shot-'));
const chromePath = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));
if (!chromePath) { console.error('No Chrome found: set CHROME_PATH'); process.exit(1); }
const gl = flags.includes('gl'), netlog = flags.includes('netlog');
const chrome = spawn(chromePath, [...(process.platform === 'linux' ? ['--no-sandbox'] : []), '--headless=new', ...(gl ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] : ['--disable-gpu']), '--hide-scrollbars', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
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
  const reqs = new Map(); let loadAt = 0; const t0 = Date.now();
  if (netlog) {
    await send('Network.enable');
    ws.on('message', (m) => { const d = JSON.parse(m); const q = d.params;
      if (d.method === 'Network.requestWillBeSent') reqs.set(q.requestId, { url: q.request.url, at: Date.now() - t0, bytes: 0 });
      if (d.method === 'Network.dataReceived' && reqs.has(q.requestId)) reqs.get(q.requestId).bytes += q.encodedDataLength || q.dataLength;
      if (d.method === 'Network.loadingFinished' && reqs.has(q.requestId)) reqs.get(q.requestId).bytes = q.encodedDataLength;
      if (d.method === 'Page.loadEventFired') loadAt = Date.now() - t0; });
  }
  if (flags.includes('nogl')) await send('Page.addScriptToEvaluateOnNewDocument', { source: "const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); };" });
  if (flags.includes('rm')) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: dpr, mobile });
  await send('Page.navigate', { url });
  await sleep(waitMs);
  const ev = flags.find((f) => f.startsWith('eval='))?.slice(5);
  if (ev) { await send('Runtime.evaluate', { expression: ev, awaitPromise: true }); await sleep(900); }
  const sel = flags.find((f) => f.startsWith('sel='))?.slice(4);
  if (sel) { await send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(sel)}).scrollIntoView()` }); await sleep(1200); }
  const click = flags.find((f) => f.startsWith('click='))?.slice(6);
  if (click) { await send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(click)}).click()` }); await sleep(600); }
  if (scrollY) { await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${scrollY})` }); await sleep(900); }
  let clip;
  if (full || clipArg) {
    // walk down the page so lazy images load, then return to the top
    const hh = (await send('Runtime.evaluate', { expression: 'document.documentElement.scrollHeight', returnByValue: true })).result.result.value;
    for (let y = 0; y < hh; y += +H * 0.8) { await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${y})` }); await sleep(250); }
    await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)' }); await sleep(600);
    const m = await send('Page.getLayoutMetrics');
    const h = Math.ceil(m.result.cssContentSize.height);
    if (full) clip = { x: 0, y: 0, width: +W, height: Math.min(h, 12000), scale: 1 };
  }
  if (clipArg) clip = { x: clipArg[0], y: clipArg[1], width: clipArg[2], height: clipArg[3], scale: 1 };
  const shot = await send('Page.captureScreenshot', { format: flags.includes('jpg') ? 'jpeg' : 'png', ...(flags.includes('jpg') ? { quality: 82 } : {}), captureBeyondViewport: !!(full || clipArg), ...(clip ? { clip } : {}) });
  fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  ws.close();
  console.log('saved', out);
  if (netlog) { console.log('load event at', loadAt, 'ms'); for (const r of reqs.values()) if (!r.url.startsWith('data:')) console.log(`${String(r.at).padStart(6)} ms ${String(r.bytes).padStart(9)} B ${r.url.replace(/^https?:\/\/[^/]+/, '')}`); }
} finally { chrome.kill(); await sleep(400); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp dir, harmless */ } process.exit(0); }
