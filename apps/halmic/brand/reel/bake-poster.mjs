// Bakes the fallback posters (public/hero/reel-poster.jpg, reel-poster-m.jpg) from the REAL hero render: the shader's own glyph screen on the poster frame, so the fallback
// looks like the effect frozen, not a dark photo. Headless Chrome with software WebGL, needs a running server and the encoded videos already in public/hero.
//   PORT=4563 node apps/halmic/serve.mjs &
//   node apps/halmic/brand/reel/bake-poster.mjs http://localhost:4563
// The frame comes from edl.json `poster` ([moment, frames in]). Env: POSTER_Q (jpeg quality, default 62), POSTER_W (desktop width, default 1280), BAKE_FRAMES (frames to let the
// auto-exposure settle, default 90).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const WebSocket = require('ws'), sharp = require('sharp');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', '..', 'public', 'hero');
const base = (process.argv[2] ?? 'http://localhost:4563').replace(/\/$/, '');
const edl = JSON.parse(fs.readFileSync(path.join(here, 'edl.json'), 'utf8'));
const { fps, speed, srcSeconds, crossfadeFrames: X } = edl;
const N = Math.round((srcSeconds / speed) * fps);
const frameIdx = (N - X) * edl.poster[0] - X + edl.poster[1];
const T = (frameIdx + 0.5) / fps;   // seconds into the loop
const chromePath = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 400), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bake-'));
const chrome = spawn(chromePath, ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
try {
  let targets; for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch { /* wait */ } await sleep(200); }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => ws.on('open', r));
  let id = 0; const pending = new Map();
  ws.on('message', (m) => { const d = JSON.parse(m); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result.result.value;
  await send('Page.enable');
  const cases = [
    { file: 'reel-poster.jpg', w: 1440, h: 900, dpr: 1, mobile: false, outW: +(process.env.POSTER_W ?? 1280) },
    { file: 'reel-poster-m.jpg', w: 390, h: 844, dpr: 1.5, mobile: true, outW: 540 },
  ];
  for (const c of cases) {
    await send('Emulation.setDeviceMetricsOverride', { width: c.w, height: c.h, deviceScaleFactor: c.dpr, mobile: c.mobile });
    await send('Page.navigate', { url: `${base}/?reeldebug=1&reelq=0&motion=0&reelclock=frame` });
    for (let i = 0; i < 240 && !(await ev('!!(window.__reel && window.__reel.frames > 2)')); i++) await sleep(500);
    // freeze the video on the poster frame (the loop would otherwise run on), then let the eased passes settle on it
    await ev(`(() => { const v = document.querySelector('.reel video'); v.pause(); v.play = () => Promise.resolve(); v.pause = () => {}; v.currentTime = ${T}; })()`);
    await sleep(1500);
    const f0 = await ev('window.__reel.frames'); const n = +(process.env.BAKE_FRAMES ?? 90);
    for (let i = 0; i < 400 && (await ev('window.__reel.frames')) < f0 + n; i++) await sleep(500);
    await ev("window.__reelHold = true; document.querySelectorAll('.hero > *:not(.reel), .top, .toast').forEach((e) => { e.style.visibility = 'hidden'; }); document.querySelector('.reel-cv').style.transition = 'none'");
    await sleep(300);
    const box = await ev("(() => { const r = document.querySelector('.reel').getBoundingClientRect(); return [r.left + scrollX, r.top + scrollY, r.width, r.height]; })()");
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: box[0], y: box[1], width: box[2], height: box[3], scale: 1 } });
    const q = +(process.env.POSTER_Q ?? 62);
    const img = sharp(Buffer.from(shot.result.data, 'base64')).resize({ width: c.outW }).jpeg({ quality: q, mozjpeg: true, chromaSubsampling: '4:2:0' });
    const buf = await img.toBuffer(); fs.writeFileSync(path.join(out, c.file), buf);
    console.log(c.file, `${Math.round(box[2])}x${Math.round(box[3])} css`, `${(buf.length / 1024).toFixed(1)} KB`, `t=${T.toFixed(2)}s`);
  }
  ws.close();
} finally { chrome.kill(); await sleep(300); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } process.exit(0); }
