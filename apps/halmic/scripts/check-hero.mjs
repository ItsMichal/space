// Regression check for the hero reel under resizing. Headless Chrome with software WebGL, needs a running server (NOT in `npm test`).
//   PORT=4563 node apps/halmic/serve.mjs &
//   node apps/halmic/scripts/check-hero.mjs http://localhost:4563 [--desktop] [--mobile] [--auto] [--quick] [--verbose]
// Runs a resize sequence (narrower, wider, desktop to phone width, back, a 20-size drag in about a second, DPR changes, browser zoom, a very tall and a very short
// window, orientation flips) plus scroll-away-and-back, a lost and restored GL context and a bfcache pageshow, and after every step asserts:
//   1. the canvas backing size equals its CSS size times the effective scale (within rounding),
//   2. the render loop is advancing (window.__reel.frames, exposed only with ?reeldebug=1),
//   3. the hero is not in the poster fallback (no .reel-still, no .is-still, __reel.state is 'run'),
//   4. no console error or uncaught exception.
// --auto leaves adaptive quality on (default pins ?reelq=3 so slow software GL does not dominate). --quick runs a shorter sequence.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let WebSocket;
for (const p of ['ws', process.env.WS_PATH ?? 'ws']) { try { WebSocket = require(p); break; } catch { /* next */ } }
const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:/.test(a)) ?? 'http://localhost:4563').replace(/\/$/, '');
const has = (f) => args.includes(f);
const auto = has('--auto'), quick = has('--quick'), verbose = has('--verbose');
const profiles = [];
if (has('--desktop') || !has('--mobile')) profiles.push({ name: 'desktop', w: 1440, h: 900, dpr: 1, mobile: false });
if (has('--mobile') || !has('--desktop')) profiles.push({ name: 'mobile', w: 390, h: 844, dpr: 2, mobile: true });
const chromePath = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));
if (!chromePath) { console.error('No Chrome found: set CHROME_PATH'); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function session(profile) {
  const port = 9700 + Math.floor(Math.random() * 300);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chk-hero-'));
  const chrome = spawn(chromePath, [...(process.platform === 'linux' ? ['--no-sandbox'] : []), '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch { /* wait */ } await sleep(200); }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));
  let id = 0; const pending = new Map(); const errors = [];
  ws.on('message', (m) => {
    const d = JSON.parse(m);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
    if (d.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('console.error: ' + d.params.args.map((a) => a.value ?? a.description).join(' '));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/favicon/.test(d.params.entry.url ?? '')) errors.push('log: ' + d.params.entry.text + ' ' + (d.params.entry.url ?? ''));
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'eval failed'); return r.result.result.value; };
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  const metrics = (w, h, dpr = profile.dpr, mobile = profile.mobile) => send('Emulation.setDeviceMetricsOverride', { width: Math.round(w), height: Math.round(h), deviceScaleFactor: dpr, mobile, ...(mobile ? { screenOrientation: w > h ? { type: 'landscapePrimary', angle: 90 } : { type: 'portraitPrimary', angle: 0 } } : {}) });
  return { send, ev, metrics, errors, close: () => { try { ws.close(); } catch { /* closed */ } chrome.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } } };
}

// one read of everything the assertions need
const SNAP = `(() => { const b = document.querySelector('[data-reel]'), c = b.querySelector('canvas'), v = b.querySelector('video'), r = c.getBoundingClientRect(), d = window.__reel || null;
  return { frames: d ? d.frames : -1, state: d ? d.state : null, sc: d ? d.sc : null, W: c.width, H: c.height, cssW: r.width, cssH: r.height, dpr: devicePixelRatio, iw: innerWidth,
    still: !!b.querySelector('.reel-still'), isStill: b.classList.contains('is-still'), isOn: b.classList.contains('is-on'), src: (v.currentSrc || '').replace(/^.*\\/hero\\//, ''), t: v.currentTime, paused: v.paused, rs: v.readyState,
    swaps: d ? d.swaps : 0, fallbacks: d ? d.fallbacks : 0, reason: d ? d.reason : '', qi: d ? d.qi : -1, resizes: d ? d.resizes : 0, lost: d ? d.lost : false, sy: scrollY }; })()`;

async function waitFrames(s, n, ms) {   // wait until the loop has rendered n more frames (or the video clock moved, when there is no debug global)
  const a = await s.ev(SNAP); const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await sleep(250);
    const b = await s.ev(SNAP);
    if (a.frames >= 0 ? b.frames >= a.frames + n : b.t !== a.t) return { a, b, ok: true };
  }
  return { a, b: await s.ev(SNAP), ok: false };
}

let failed = 0; const rows = [];
async function check(s, label, opts = {}) {
  const settle = opts.settle ?? 900;
  await sleep(settle);
  const { a, b, ok } = await waitFrames(s, 2, opts.wait ?? 40000);
  const why = [];
  const exp = b.sc ?? null;
  if (exp !== null) {
    if (Math.abs(b.W - Math.round(b.cssW * exp)) > 1 || Math.abs(b.H - Math.round(b.cssH * exp)) > 1) why.push(`canvas ${b.W}x${b.H} vs css ${b.cssW.toFixed(1)}x${b.cssH.toFixed(1)} * ${exp.toFixed(3)}`);
  } else if (Math.abs(b.W / b.cssW - b.dpr) > 0.01 && b.W / b.cssW > b.dpr + 0.01) why.push(`canvas ${b.W}x${b.H} too big for css ${b.cssW}x${b.cssH} at dpr ${b.dpr}`);
  if (b.frames >= 0 ? !ok : !ok) why.push(b.frames >= 0 ? `loop not advancing (frames ${a.frames} -> ${b.frames})` : 'video clock not advancing');
  if (b.still || b.isStill || (b.state !== null && b.state !== 'run')) why.push(`poster fallback (state ${b.state}, .reel-still ${b.still}, reason ${b.reason || '-'})`);
  if (!b.isOn) why.push('canvas not shown (.is-on missing)');
  const errs = s.errors.splice(0);
  if (errs.length) why.push(...errs.slice(0, 3));
  const row = { label, ok: why.length === 0, canvas: `${b.W}x${b.H}`, css: `${b.cssW.toFixed(0)}x${b.cssH.toFixed(0)}`, sc: exp === null ? '-' : exp.toFixed(2), src: b.src, frames: b.frames, qi: b.qi, swaps: b.swaps, why: why.join('; ') };
  rows.push(row); if (!row.ok) failed++;
  console.log(`${row.ok ? 'PASS' : 'FAIL'}  ${label.padEnd(34)} canvas ${row.canvas.padEnd(10)} css ${row.css.padEnd(8)} sc ${String(row.sc).padEnd(5)} ${b.src.padEnd(14)} frames ${b.frames} q${b.qi} swaps ${b.swaps}${row.why ? '\n      ' + row.why : ''}`);
  return b;
}

for (const p of profiles) {
  console.log(`\n== ${p.name} (${p.w}x${p.h} @${p.dpr}x${p.mobile ? ', mobile emulation' : ''}) ==`);
  const s = await session(p);
  try {
    await s.metrics(p.w, p.h);
    await s.send('Page.navigate', { url: `${base}/?reeldebug=1&motion=0${auto ? '' : '&reelq=3'}` });
    // the reel starts after load and idle
    for (let i = 0; i < 120; i++) { const b = await s.ev("window.__reel ? window.__reel.frames > 3 : document.querySelector('[data-reel]').classList.contains('is-on')"); if (b) break; await sleep(500); }
    await check(s, `initial ${p.w}x${p.h}`, { settle: 200 });
    const seq = p.mobile
      ? [['narrower 360x800', 360, 800], ['wider 430x932', 430, 932], ['mobile to desktop 1440x900', 1440, 900], ['desktop to phone 390x844', 390, 844], ['landscape 844x390', 844, 390], ['portrait again 390x844', 390, 844], ['tablet 820x1180', 820, 1180], ['phone again 390x844', 390, 844]]
      : [['narrower 1100x900', 1100, 900], ['narrower 900x800', 900, 800], ['wider 1920x1080', 1920, 1080], ['desktop to phone 390x844', 390, 844], ['phone to desktop 1440x900', 1440, 900], ['fullscreen-ish 1920x1200', 1920, 1200], ['short window 1440x420', 1440, 420], ['tall window 1000x1400', 1000, 1400], ['back 1440x900', 1440, 900]];
    for (const [name, w, h] of (quick ? seq.slice(0, 4) : seq)) { await s.metrics(w, h, p.dpr); await check(s, name); }
    // a drag: 20 sizes in about a second, ending at a different size, across the 700 px and 900 px thresholds
    const dragEnd = p.mobile ? [390, 844] : [1280, 800];
    for (let i = 0; i < 20; i++) { const k = i / 19; await s.metrics(p.mobile ? 390 + 440 * Math.sin(k * 3) : 1440 - 1000 * k + 300 * Math.sin(k * 9), p.mobile ? 844 - 300 * k : 900 - 100 * k, p.dpr); await sleep(40); }
    await s.metrics(dragEnd[0], dragEnd[1], p.dpr); await check(s, 'drag: 20 sizes in 1 s');
    if (!quick) {
      // DPR change at a fixed size (device-metrics factor) and browser zoom (css size shrinks while the device ratio grows)
      await s.metrics(p.w, p.h, 2); await check(s, 'DPR 1 to 2');
      await s.metrics(p.w, p.h, 1); await check(s, 'DPR back to 1');
      await s.metrics(p.w / 1.5, p.h / 1.5, p.dpr * 1.5); await check(s, 'zoom in 150%');
      await s.metrics(p.w / 0.67, p.h / 0.67, p.dpr * 0.67); await check(s, 'zoom out 67%');
      await s.metrics(p.w, p.h, p.dpr); await check(s, 'zoom reset');
      // away and back, fast (pauses the video while play() may still be pending)
      await s.ev("window.scrollTo({ top: 3000, behavior: 'instant' })"); await sleep(120); await s.ev("window.scrollTo({ top: 0, behavior: 'instant' })"); await check(s, 'scroll away and straight back');
      await s.ev("window.scrollTo({ top: 3000, behavior: 'instant' })"); await sleep(1500); await s.ev("window.scrollTo({ top: 0, behavior: 'instant' })"); await check(s, 'scroll away 1.5 s, back');
      // GL context lost, then restored
      await s.ev("(() => { const g = document.querySelector('[data-reel] canvas').getContext('webgl'); const x = g.getExtension('WEBGL_lose_context'); window.__x = x; x.loseContext(); })()");
      await sleep(600);
      const mid = await s.ev(SNAP); console.log(`      (context lost: state ${mid.state}, still ${mid.still})`);
      await s.ev('window.__x.restoreContext()'); await check(s, 'context lost, then restored', { settle: 1200 });
      // a page restored from the bfcache
      await s.ev("window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))"); await check(s, 'pageshow (bfcache)');
      // a resize while the first frames of a source swap are still pending
      await s.metrics(390, 844, p.dpr); await sleep(250); await s.metrics(1440, 900, p.dpr); await sleep(250); await s.metrics(390, 844, p.dpr); await check(s, 'swap flip-flop, 250 ms apart');
    }
  } catch (e) { failed++; console.log('FAIL  harness error:', e.message); }
  finally { s.close(); }
}
const all = rows.length;
console.log(`\nSummary: ${all - failed}/${all} checks passed${failed ? `, ${failed} FAILED` : ''}`);
if (verbose) console.table(rows);
process.exit(failed ? 1 : 0);
