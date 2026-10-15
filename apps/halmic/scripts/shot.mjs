// Headless Chrome screenshot via CDP (uses the `ws` package from the portfolio repo, or any ws on the path).
// pre=<js> runs after the wait and before resize=.
// resize=<WxH[xDPR][zZOOM]@ms,...>: after the wait, apply each size (device metrics; zoom shrinks the css size and grows the device ratio, like the browser's zoom), ms after the previous one; rshots saves a shot after each as <out>-r<i> once it has settled (rwait=ms, default 2500)
// usage: node halmic/scripts/shot.mjs <url> <out.png> <width> <height> [full] [mobile] [wait-ms] [scrollY] [sel=css] [click=css] [clip=x,y,w,h]
//   hover=<css>: scroll that element into view and move the mouse onto it (real mouse events) before the screenshot, after eval
//   extra flags: nojs (scripts disabled), wheel=<dy> (real wheel input, prints scrollY before and after), tap=x,y and strip=ms,ms,... (simulate a touch and save timed shots), console (print console output and exceptions), gl (software WebGL via SwiftShader), rm (emulate prefers-reduced-motion), eval=<js> (run after the wait, then 900 ms), netlog (print requests, sizes and the load time), jpg (write JPEG), nogl (getContext('webgl') returns null)
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
  if (flags.includes('console')) { await send('Runtime.enable'); ws.on('message', (m) => { const d = JSON.parse(m); if (d.method === 'Runtime.consoleAPICalled') console.log('console.' + d.params.type, d.params.args.map((a) => a.value ?? a.description).join(' ')); if (d.method === 'Runtime.exceptionThrown') console.log('exception', d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text); }); }
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
  if (flags.includes('nojs')) await send('Emulation.setScriptExecutionDisabled', { value: true });
  await send('Page.navigate', { url });
  await sleep(waitMs);
  const pre = flags.find((f) => f.startsWith('pre='))?.slice(4);   // pre=<js>: run after the wait, before resize=
  if (pre) await send('Runtime.evaluate', { expression: pre, awaitPromise: true });
  const rs = flags.find((f) => f.startsWith('resize='))?.slice(7);
  if (rs) {
    const settle = +(flags.find((f) => f.startsWith('rwait='))?.slice(6) ?? 2500);
    let i = 0;
    for (const spec of rs.split(',')) {
      const m = spec.match(/^(\d+)x(\d+)(?:x([\d.]+))?(?:z([\d.]+))?(?:@(\d+))?$/);
      if (!m) { console.log('bad resize spec', spec); continue; }
      const z = +(m[4] ?? 1);
      await sleep(+(m[5] ?? 0));
      await send('Emulation.setDeviceMetricsOverride', { width: Math.round(+m[1] / z), height: Math.round(+m[2] / z), deviceScaleFactor: +(m[3] ?? dpr) * z, mobile: mobile && +m[1] < 900 });
      i++;
      if (flags.includes('rshots')) { await sleep(settle); const sh = await send('Page.captureScreenshot', { format: flags.includes('jpg') ? 'jpeg' : 'png', ...(flags.includes('jpg') ? { quality: 82 } : {}) }); fs.writeFileSync(out.replace(/(\.\w+)$/, `-r${i}$1`), Buffer.from(sh.result.data, 'base64')); }
    }
    await sleep(settle);
  }
  const ev = flags.find((f) => f.startsWith('eval='))?.slice(5);
  if (ev) { const er = await send('Runtime.evaluate', { expression: ev, awaitPromise: true, returnByValue: true }); console.log('eval:', JSON.stringify(er.result.result.value ?? er.result.exceptionDetails ?? null)); await sleep(900); }
  // wheel=dy: a real mouse-wheel event (browser input, not a script) at the middle of the page, then print where the page ended up
  const wheel = flags.find((f) => f.startsWith('wheel='))?.slice(6);
  if (wheel) {
    const before = (await send('Runtime.evaluate', { expression: 'scrollY', returnByValue: true })).result.result.value;
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: +W / 2, y: +H / 2, deltaX: 0, deltaY: +wheel });
    await sleep(1200);
    console.log('wheel:', JSON.stringify({ before, dy: +wheel, after: (await send('Runtime.evaluate', { expression: 'scrollY', returnByValue: true })).result.result.value }));
  }
  const hov = flags.find((f) => f.startsWith('hover='))?.slice(6);
  const hev = flags.find((f) => f.startsWith('hoverEval='))?.slice(10);
  if (hov) {
    const r = (await send('Runtime.evaluate', { expression: `(() => { const e = document.querySelector(${JSON.stringify(hov)}); e.scrollIntoView({ block: 'center', behavior: 'instant' }); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`, returnByValue: true })).result.result.value;
    await sleep(700);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r[0] - 3, y: r[1] - 3 }); await sleep(50);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r[0], y: r[1] });
    await sleep(+(flags.find((f) => f.startsWith('hoverMs='))?.slice(8) ?? 1500));
    if (hev) { const er = await send('Runtime.evaluate', { expression: hev, awaitPromise: true, returnByValue: true }); console.log('hover eval:', JSON.stringify(er.result.result.value ?? er.result.exceptionDetails ?? null)); }
  }
  const sel = flags.find((f) => f.startsWith('sel='))?.slice(4);
  if (sel) { await send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ behavior: 'instant' })` }); await sleep(1200); }
  const click = flags.find((f) => f.startsWith('click='))?.slice(6);
  if (click) { await send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(click)}).click()` }); await sleep(600); }
  if (scrollY) { await send('Runtime.evaluate', { expression: `window.scrollTo({ top: ${scrollY}, behavior: 'instant' })` }); await sleep(900); }
  // tap=x,y: a touch pointerdown+up on the hero at that point (css px); strip=0,150,500: also save a shot that many ms after the tap, as <out>-t<ms>
  const tap = flags.find((f) => f.startsWith('tap='))?.slice(4).split(',').map(Number);
  if (tap) {
    const t0 = Date.now();
    await send('Runtime.evaluate', { expression: `(() => { const h = document.querySelector('.hero'); const o = { clientX: ${tap[0]}, clientY: ${tap[1]}, pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true }; h.dispatchEvent(new PointerEvent('pointerdown', o)); h.dispatchEvent(new PointerEvent('pointerup', o)); })()` });
    const strip = flags.find((f) => f.startsWith('strip='))?.slice(6).split(',').map(Number) ?? [];
    const c0 = (await send('Runtime.evaluate', { expression: 'window.__reelClock ?? -1', returnByValue: true })).result.result.value;
    for (const ms of strip) {
      if (c0 >= 0) {   // ?reelclock=frame: wait for that many ms of frame time, then freeze the loop while the shot is taken
        for (let i = 0; i < 400; i++) { const c = (await send('Runtime.evaluate', { expression: 'window.__reelClock', returnByValue: true })).result.result.value; if (c >= c0 + ms) break; await sleep(100); }
        await send('Runtime.evaluate', { expression: 'window.__reelHold = true' });
      } else await sleep(Math.max(0, ms - (Date.now() - t0)));
      const sh = await send('Page.captureScreenshot', { format: flags.includes('jpg') ? 'jpeg' : 'png', ...(flags.includes('jpg') ? { quality: 82 } : {}) });
      fs.writeFileSync(out.replace(/(\.\w+)$/, `-t${ms}$1`), Buffer.from(sh.result.data, 'base64'));
      if (c0 >= 0) await send('Runtime.evaluate', { expression: 'window.__reelHold = false' });
    }
  }
  let clip;
  if (full || clipArg) {
    // walk down the page so lazy images load, then return to the top
    const hh = (await send('Runtime.evaluate', { expression: 'document.documentElement.scrollHeight', returnByValue: true })).result.result.value;
    for (let y = 0; y < hh; y += +H * 0.8) { await send('Runtime.evaluate', { expression: `window.scrollTo({ top: ${y}, behavior: 'instant' })` }); await sleep(250); }
    await send('Runtime.evaluate', { expression: "window.scrollTo({ top: 0, behavior: 'instant' })" }); await sleep(600);
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
