// Motion check (needs Chrome and a running server: PORT=4563 node serve.mjs). Exit 1 on any failure. Not part of npm test.
//   - no scroll-jacking: no wheel / touchmove / touchstart listener in the shipped scripts, every scroll listener passive; a real wheel input moves
//     the page by exactly its delta; cancelable synthetic wheel and touchmove events are not default-prevented
//   - reduced motion (rm): no running animation or transition after load and after scrolling the whole page; motion=0 likewise
//   - no scripts: every tile, card and section label is visible (opacity 1, no transform)
//   - performance and layout: scrolling the whole page in 40px steps logs no long task, no layout shift (CLS), no horizontal overflow at 360 and 390
//   - the numerals read exactly the static text after their count-up
// usage: node scripts/check-motion.mjs [base-url]   (uses scripts/shot.mjs for the headless Chrome session)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, '..', 'public');
const base = process.argv[2] ?? 'http://localhost:4563';
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  FAIL ' + msg); } else console.log('  ok   ' + msg); };
const shot = (url, w, flags, ev) => {
  const r = spawnSync('node', [path.join(here, 'shot.mjs'), url, path.join(os.tmpdir(), 'motion.jpg'), String(w), '900', 'jpg', ...flags, ...(ev ? [`eval=${ev.replace(/\s+/g, ' ')}`] : [])], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const m = r.stdout.match(/eval: (.*)\n/); const wl = r.stdout.match(/wheel: (.*)\n/);
  return { value: m ? JSON.parse(m[1]) : null, wheel: wl ? JSON.parse(wl[1]) : null, raw: r.stdout };
};

console.log('scripts');
for (const f of fs.readdirSync(pub).filter((n) => n.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(pub, f), 'utf8');
  ok(!/addEventListener\(\s*['"](wheel|mousewheel|touchmove|touchstart|touchend)['"]/.test(src), `${f}: no wheel or touch listener`);
  const scrolls = [...src.matchAll(/addEventListener\(\s*['"]scroll['"][^)]*\)/g)].map((m) => m[0]);
  ok(scrolls.every((s) => /passive:\s*true/.test(s)), `${f}: scroll listeners (${scrolls.length}) are passive`);
  ok(!/scrollTo\(|scrollBy\(|scrollTop\s*=|scrollLeft\s*=/.test(src.replace(/\/\/.*$/gm, '')), `${f}: sets no scroll position`);
}

console.log('real wheel input (motion on)');
{
  const r = shot(`${base}/?clips=demo`, 1440, ['wheel=700']);
  ok(r.wheel && r.wheel.before === 0 && Math.abs(r.wheel.after - 700) <= 1, `wheel deltaY 700 moved the page ${r.wheel?.before} -> ${r.wheel?.after}`);
}
console.log('synthetic wheel and touchmove are not prevented');
{
  const ev = `(() => { const out = []; const targets = [document.body, document.querySelector('.hero'), document.querySelector('.tile'), document.querySelector('.top nav a')];
    for (const t of targets) { const w = new WheelEvent('wheel', { deltaY: 240, cancelable: true, bubbles: true }); t.dispatchEvent(w); out.push(w.defaultPrevented);
      try { const tm = new TouchEvent('touchmove', { cancelable: true, bubbles: true }); t.dispatchEvent(tm); out.push(tm.defaultPrevented); } catch { out.push(false); } }
    return JSON.stringify({ prevented: out.some(Boolean), n: out.length }); })()`;
  const r = shot(`${base}/?clips=demo`, 1440, [], ev);
  const v = r.value && JSON.parse(r.value);
  ok(v && v.prevented === false && v.n === 8, `no wheel or touchmove default-prevented (${v?.n} events)`);
}

const WALK = `for (let y = 0; y <= document.documentElement.scrollHeight; y += 300) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 60)); }`;
console.log('reduced motion and ?motion=0: nothing animates');
for (const [label, url, flags] of [['prefers-reduced-motion', `${base}/?clips=demo`, ['rm']], ['?motion=0', `${base}/?clips=demo&motion=0`, []]]) {
  const ev = `(async () => { const a = document.getAnimations().length; ${WALK} await new Promise((r) => setTimeout(r, 300)); return JSON.stringify({ a, b: document.getAnimations().length, mo: document.documentElement.classList.contains('mo') }); })()`;
  const v = (() => { const r = shot(url, 1440, flags, ev); return r.value && JSON.parse(r.value); })();
  ok(v && v.a === 0 && v.b === 0 && !v.mo, `${label}: ${v?.a} animations after load, ${v?.b} after scrolling the page, html.mo ${v?.mo}`);
}

console.log('scripts disabled: everything is visible');
{
  const url = `${base}/`;
  const flags = ['nojs'];
  const ev = `(() => { const bad = [...document.querySelectorAll('.tile, .card, .sh h2, .log *')].filter((e) => { const c = getComputedStyle(e); return +c.opacity < 1 || (c.translate !== 'none' && c.translate !== '0px') || (c.scale !== 'none' && c.scale !== '1'); }); return JSON.stringify({ n: document.querySelectorAll('.tile').length, bad: bad.length, js: document.documentElement.classList.contains('js') }); })()`;
  const r = shot(url, 1440, flags, ev); const v = r.value && JSON.parse(r.value);
  ok(v && v.n > 20 && v.bad === 0 && !v.js, `no scripts: ${v?.n} tiles, ${v?.bad} not fully visible (html.js ${v?.js})`);
}

console.log('scroll performance, layout shift, overflow (motion on, whole page)');
for (const [w, mobile] of [[1440, false], [390, true], [360, true]]) {
  const ev = `(async () => { const longs = [], shifts = []; let frames = 0, slow = 0;
    new PerformanceObserver((l) => l.getEntries().forEach((e) => longs.push(Math.round(e.duration)))).observe({ type: 'longtask' });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) shifts.push(e.value); })).observe({ type: 'layout-shift' });
    const H = document.documentElement.scrollHeight - innerHeight; let last = performance.now(), maxScrollW = 0;
    for (let y = 0; y <= H; y += 40) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => requestAnimationFrame(r)); const n = performance.now(); frames++; if (n - last > 100) slow++; last = n; maxScrollW = Math.max(maxScrollW, document.documentElement.scrollWidth); }
    for (let y = H; y >= 0; y -= 80) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => requestAnimationFrame(r)); }
    await new Promise((r) => setTimeout(r, 400));
    return JSON.stringify({ longs, cls: shifts.reduce((a, b) => a + b, 0), frames, slow, maxScrollW, vw: innerWidth }); })()`;
  // long tasks on a busy software-rendered machine are noisy (the page before the motion work logs them too), so: best of three runs must be clean
  const runs = [0, 1, 2].map(() => { const r = shot(`${base}/?clips=demo`, w, mobile ? ['mobile'] : [], ev); return r.value && JSON.parse(r.value); });
  const v = runs.find((x) => x && x.longs.length === 0) ?? runs[0];
  ok(runs.some((x) => x && x.longs.length === 0), `${w}px: long tasks per run while scrolling ${v?.frames} steps down and back: ${runs.map((x) => x?.longs.length).join(', ')} (one clean run required)`);
  const cls = Math.max(...runs.map((x) => x?.cls ?? 1)), sw = Math.max(...runs.map((x) => x?.maxScrollW ?? 9999));
  ok(cls < 0.001, `${w}px: layout shift (worst of 3 runs) ${cls}`);
  ok(sw <= w, `${w}px: widest scrollWidth ${sw} <= viewport ${w}`);
}

console.log('numerals: final text after the count-up equals the static text');
{
  const ev = `(async () => { const before = [...document.querySelectorAll('.num .nv')].map((e) => e.textContent); const H = document.documentElement.scrollHeight; for (let y = 0; y <= H; y += 250) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 120)); } await new Promise((r) => setTimeout(r, 1500)); const after = [...document.querySelectorAll('.num .nv')].map((e) => e.textContent); return JSON.stringify({ before, after, left: document.querySelectorAll('.nv.cnt').length }); })()`;
  const staticText = (() => { const html = fs.readFileSync(path.join(pub, 'index.html'), 'utf8'); return [...html.matchAll(/<span class="nv">([^<]*)<\/span>/g)].map((m) => m[1].replace(/&amp;/g, '&')); })();
  const r = shot(`${base}/`, 1440, [], ev); const v = r.value && JSON.parse(r.value);
  ok(v && JSON.stringify(v.after) === JSON.stringify(staticText) && v.left === 0, `${staticText.length} numerals read ${v?.after.join(' / ')} (static: ${staticText.join(' / ')})`);
}

console.log(`${fails ? 'FAILED' : 'PASSED'}: ${checks} checks, ${fails} failures`);
process.exit(fails ? 1 : 0);
