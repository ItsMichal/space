// Spacing check (needs Chrome and a running server: PORT=4563 node serve.mjs): every tile of every bento on the home page follows ONE spacing system.
// At each width it measures real boxes (getBoundingClientRect, Range rects, canvas glyph bearings) and asserts the invariants below; exit 1 on any failure.
//   - text left and bottom inset = --pad (+-1px); numeral and brand-mark INK left = --pad (+-2), numeral ink top = --pad (+-2), numeral ink left within 2px of the caption's ink
//   - badge, chip, corner arrow: top and (left | right) inset = --pad (+-1); chips never touch the title
//   - gaps: between tiles = --gap, between clusters = 2 x --gap, between bentos = 5 x --gap (+-1); radius of every tile = --r
//   - one title size and one caption size per tile short side; every title clamps at 3 lines
//   - section labels start on the grid's left edge and end on its right edge; the playing tile's text, buttons and close button use the same inset
// usage: node scripts/check-spacing.mjs [base-url] [width,width,...]     (uses scripts/shot.mjs for the headless Chrome session)
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] ?? 'http://localhost:4563';
const widths = (process.argv[3] ?? '1440,1024,768,390').split(',').map(Number);

// runs in the page; returns JSON. All numbers are CSS px relative to the tile (or bento) unless noted.
const PROBE = `(async () => {
await document.fonts.ready;
const cv = document.createElement('canvas').getContext('2d');
const px = (name, el = document.documentElement) => { const p = document.createElement('span'); p.style.cssText = 'position:absolute;visibility:hidden;width:var(' + name + ')'; el.appendChild(p); const w = p.getBoundingClientRect().width; p.remove(); return w; };
const firstGlyph = (el) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.nodeValue.trim()) break; if (!n) return null; const s = n.nodeValue.search(/\\S/); const r = document.createRange(); r.setStart(n, s); r.setEnd(n, s + 1); return { rect: r.getBoundingClientRect(), ch: n.nodeValue[s], el: n.parentElement }; };
const ink = (el) => { const g = firstGlyph(el); if (!g) return null; const cs = getComputedStyle(g.el); cv.font = cs.font; const m = cv.measureText(g.ch);
  const base = g.rect.top + m.fontBoundingBoxAscent; return { l: g.rect.left - m.actualBoundingBoxLeft, t: base - m.actualBoundingBoxAscent }; };
const spr = await fetch('/icons.svg').then((r) => r.text()); const holder = document.createElement('div'); holder.style.cssText = 'position:absolute;left:-9999px;top:0'; holder.innerHTML = spr; document.body.appendChild(holder);
const bbox = (id) => { const s = holder.querySelector('symbol[id="' + id + '"]'); if (!s) return [0, 0]; const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.innerHTML = s.innerHTML; svg.appendChild(g); holder.appendChild(svg); const b = g.getBBox(); const vb = s.getAttribute('viewBox').split(' ').map(Number); return [b.x / vb[2], b.y / vb[3], (vb[2] - b.x - b.width) / vb[2]]; };
const gap = px('--gap'), r = px('--r'), cgap = px('--cgap'), sgap = px('--sgap');
const rel = (el, T) => { if (!el) return null; const q = el.getBoundingClientRect(); return { l: q.left - T.left, t: q.top - T.top, r: T.right - q.right, b: T.bottom - q.bottom }; };
const tiles = [];
const bentos = [...document.querySelectorAll('.bento')];
for (const bento of bentos) {
  const cols = +getComputedStyle(bento).getPropertyValue('--cols');
  const cls = [...bento.querySelectorAll(':scope > .cl')];
  cls.forEach((cl, ci) => {
    const kids = [...cl.children], rects = kids.map((k) => k.getBoundingClientRect());
    kids.forEach((t, i) => {
      const T = rects[i], pad = px('--pad', t), ctl = px('--ctl', t);
      const o = { bento: bento.className.replace('bento ', ''), cl: ci, cls: t.className.replace(/\\s+/g, ' ').trim(), w: T.width, h: T.height, pad, ctl, radius: parseFloat(getComputedStyle(t).borderTopLeftRadius), playing: t.classList.contains('playing') };
      const tcap = t.querySelector('.tcap'), tx = t.querySelector('.tx'), tt = t.querySelector('.tt'), ts = t.querySelector('.ts'), art = t.querySelector('.gart');
      if (tx) { const first = art ?? tx; o.text = { l: rel(first, T).l, b: rel(tx, T).b, top: rel(tx, T).t }; o.ttInk = ink(tt)?.l - T.left; o.ttFs = parseFloat(getComputedStyle(tt).fontSize); o.ttClamp = getComputedStyle(tt).webkitLineClamp; o.tsFs = ts ? parseFloat(getComputedStyle(ts).fontSize) : null; if (art) o.art = rel(art, T); }
      const num = t.querySelector('.num'); if (num) { const nv = num.querySelector('.nv'), i0 = ink(nv); o.num = { inkL: i0.l - T.left, inkT: i0.t - T.top, bottom: num.getBoundingClientRect().bottom - T.top, right: Math.max(...[...num.children].map((c) => c.getBoundingClientRect().right)) - T.left }; o.numCap = tx ? tx.getBoundingClientRect().top - T.top : null; }
      const lg = t.querySelector('.lg'); if (lg) { const sv = lg.querySelector('svg'), q = sv.getBoundingClientRect(), id = (sv.querySelector('use').getAttribute('href') || '').split('#')[1], bb = bbox(id); o.lg = { inkL: q.left + bb[0] * q.width - T.left, inkT: q.top + bb[1] * q.height - T.top, id }; }
      const bdg = t.querySelector('.bdg'), chip = t.querySelector('.chip'), goi = t.querySelector('.goi');
      if (bdg) o.bdg = rel(bdg, T); if (chip) o.chip = rel(chip, T); if (goi) o.goi = rel(goi, T);
      if (bdg || chip) { const row = [bdg, ...t.querySelectorAll('.chip')].filter(Boolean).map((e) => e.getBoundingClientRect().bottom - T.top); o.rowBottom = Math.max(...row); }
      const play = t.querySelector('.play'); if (play && !t.classList.contains('t-post')) o.play = rel(play, T);
      let nh = null, nv = null; rects.forEach((q, j) => { if (j === i) return; const vo = Math.min(T.bottom, q.bottom) - Math.max(T.top, q.top), ho = Math.min(T.right, q.right) - Math.max(T.left, q.left); if (vo > 1 && q.left >= T.right - .5) nh = Math.min(nh ?? 1e9, q.left - T.right); if (ho > 1 && q.top >= T.bottom - .5) nv = Math.min(nv ?? 1e9, q.top - T.bottom); }); o.ix = [nh != null && ['h', nh], nv != null && ['v', nv]].filter(Boolean);
      tiles.push(o);
    });
  });
  const B = bento.getBoundingClientRect(), sec = bento.closest('.bsec'), h2 = sec.querySelector('.sh h2'), sl = sec.querySelector('.sl:not(.sl-note)');
  const cr = cls.map((c) => c.getBoundingClientRect());
  tiles.push({ bentoInfo: bento.className.replace('bento ', ''), cols, clGaps: cr.slice(1).map((q, i) => q.top - cr[i].bottom), h2L: h2 ? ink(h2).l - B.left : null, slR: sl ? B.right - sl.querySelector('svg').getBoundingClientRect().right - (1 - bbox('arrow-right')[2] - bbox('arrow-right')[0]) * 0 - bbox('arrow-right')[2] * sl.querySelector('svg').getBoundingClientRect().width : null, top: sec.getBoundingClientRect().top, bottom: sec.getBoundingClientRect().bottom, shGap: (() => { const sh = sec.querySelector('.sh'); return sh ? bento.getBoundingClientRect().top - sh.getBoundingClientRect().bottom : null; })() });
}
return JSON.stringify({ gap, r, cgap, sgap, tiles });
})()`.replace(/\s+/g, ' ');

// the playing tile: click the first video tile, then measure the control row
const PLAYING = `(async () => {
await document.fonts.ready;
const a = document.querySelector('.b-watch a.tile[data-vid]'); a.click(); await new Promise((r) => setTimeout(r, 900));
const t = document.querySelector('.tile.playing'); if (!t) return JSON.stringify({ none: true });
const px = (name, el) => { const p = document.createElement('span'); p.style.cssText = 'position:absolute;visibility:hidden;width:var(' + name + ')'; el.appendChild(p); const w = p.getBoundingClientRect().width; p.remove(); return w; };
const T = t.getBoundingClientRect(), pb = t.querySelector('.pb'), tt = t.querySelector('.tt'), crow = t.querySelector('.crow'), x = t.querySelector('.pclose');
const rel = (el) => { const q = el.getBoundingClientRect(); return { l: q.left - T.left, t: q.top - T.top, r: T.right - q.right, b: T.bottom - q.bottom }; };
return JSON.stringify({ w: T.width, h: T.height, pad: px('--pad', t), tt: tt && rel(tt), crow: crow && rel(crow), close: x && rel(x), pb: rel(pb), radius: parseFloat(getComputedStyle(t).borderTopLeftRadius), r: px('--r', document.documentElement) });
})()`.replace(/\s+/g, ' ');

const shot = (url, w, ev) => {
  const r = spawnSync('node', [path.join(here, 'shot.mjs'), url, path.join(os.tmpdir(), 'spacing.jpg'), String(w), '900', 'jpg', '1500', `eval=${ev}`], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const m = r.stdout.match(/eval: (".*")/); return m ? JSON.parse(JSON.parse(m[1])) : null;
};
let fails = 0, checks = 0;
const out = [];
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; out.push('  FAIL ' + msg); } };
const f = (n) => (Math.round(n * 10) / 10);

function checkPage(w, pg, d) {
  const { gap, r, cgap, sgap } = d;
  ok(near(cgap, 2 * gap, .01) && near(sgap, 5 * gap, .01), `${w} ${pg}: scale cgap=${cgap} sgap=${sgap} gap=${gap}`);
  const tiles = d.tiles.filter((t) => t.cls), infos = d.tiles.filter((t) => t.bentoInfo);
  const bySide = new Map();
  for (const t of tiles) {
    if (t.playing) continue;
    const id = `${w} ${pg} ${t.bento}/${t.cl} ${t.cls.slice(0, 34)}`, p = t.pad, T = 1, T2 = 2;
    ok(near(t.radius, r, .6), `${id}: radius ${f(t.radius)} != --r ${f(r)}`);
    if (t.text) {
      ok(near(t.text.l, p, T), `${id}: text left ${f(t.text.l)} != pad ${f(p)}`);
      ok(near(t.text.b, p, T), `${id}: text bottom ${f(t.text.b)} != pad ${f(p)}`);
      ok(t.ttClamp === '3' || t.ttClamp === '5', `${id}: title line clamp ${t.ttClamp}`);
      const key = Math.round(Math.min(t.w, t.h));
      if (!bySide.has(key)) bySide.set(key, { tt: new Set(), ts: new Set() }); bySide.get(key).tt.add(f(t.ttFs)); if (t.tsFs !== null) bySide.get(key).ts.add(f(t.tsFs));
      if (t.rowBottom != null) ok(t.text.top >= t.rowBottom + 3, `${id}: title top ${f(t.text.top)} touches the chip row (${f(t.rowBottom)})`);
    }
    if (t.num) {
      ok(near(t.num.inkL, p, T2), `${id}: numeral ink left ${f(t.num.inkL)} != pad ${f(p)}`);
      ok(near(t.num.inkT, p, T2 + .5), `${id}: numeral ink top ${f(t.num.inkT)} != pad ${f(p)}`);
      if (t.ttInk != null) ok(near(t.num.inkL, t.ttInk, T2), `${id}: numeral ink ${f(t.num.inkL)} vs caption ink ${f(t.ttInk)}`);
      ok(t.num.right <= t.w - p + 1, `${id}: numeral runs past the right inset (${f(t.num.right)} > ${f(t.w - p)})`);
      if (t.numCap != null) ok(t.num.bottom <= t.numCap + 1, `${id}: numeral (${f(t.num.bottom)}) overlaps the caption (${f(t.numCap)})`);
    }
    if (t.lg) { ok(near(t.lg.inkL, p, T2), `${id}: brand mark ink left ${f(t.lg.inkL)} != pad ${f(p)}`); ok(near(t.lg.inkT, p, T2), `${id}: brand mark ink top ${f(t.lg.inkT)} != pad ${f(p)}`); }
    if (t.bdg) { ok(near(t.bdg.l, p, T) && near(t.bdg.t, p, T), `${id}: badge inset ${f(t.bdg.l)},${f(t.bdg.t)} != pad ${f(p)}`); ok(near(t.bdg.l + t.ctl, t.bdg.l + t.ctl, 0), ''); }
    if (t.chip) ok(near(t.chip.r, p, T) && near(t.chip.t, p, T), `${id}: chip inset ${f(t.chip.r)},${f(t.chip.t)} != pad ${f(p)}`);
    if (t.goi) ok(near(t.goi.r, p, T) && near(t.goi.t, p, T), `${id}: corner button inset ${f(t.goi.r)},${f(t.goi.t)} != pad ${f(p)}`);
    if (t.bdg && t.goi) ok(near(t.bdg.l, t.goi.r, T) && near(t.bdg.t, t.goi.t, T), `${id}: badge and corner button insets differ`);
    if (t.play) ok(near(t.play.r, p, T) && near(t.play.b, p, T), `${id}: play disc inset ${f(t.play.r)},${f(t.play.b)} != pad ${f(p)}`);
    if (t.art) ok(near(t.art.l, p, T) && near(t.art.b, p, T), `${id}: box art inset ${f(t.art.l)},${f(t.art.b)} != pad ${f(p)}`);
    for (const [k, v] of t.ix) ok(near(v, gap, .6), `${id}: ${k === 'h' ? 'horizontal' : 'vertical'} gap to neighbour ${f(v)} != --gap ${f(gap)}`);
  }
  for (const [side, s] of bySide) ok(s.tt.size <= 1 && s.ts.size <= 1, `${w} ${pg}: tiles with short side ${side} use several title (${[...s.tt]}) or caption (${[...s.ts]}) sizes`);
  let prev = null;
  for (const b of infos) {
    for (const g of b.clGaps) ok(near(g, cgap, .6), `${w} ${pg} ${b.bentoInfo}: gap between clusters ${f(g)} != 2 x --gap ${f(cgap)}`);
    if (b.h2L != null) ok(near(b.h2L, 0, 2), `${w} ${pg} ${b.bentoInfo}: section label ink is ${f(b.h2L)} from the grid's left edge`);
    if (b.slR != null) ok(near(b.slR, 0, 2.5), `${w} ${pg} ${b.bentoInfo}: section link ink ends ${f(b.slR)} from the grid's right edge`);
    if (b.shGap != null) ok(near(b.shGap, gap, .6), `${w} ${pg} ${b.bentoInfo}: label to grid ${f(b.shGap)} != --gap ${f(gap)}`);
    if (prev) ok(near(b.top - prev.bottom, sgap, 1), `${w} ${pg} ${b.bentoInfo}: gap to the previous bento ${f(b.top - prev.bottom)} != 5 x --gap ${f(sgap)}`);
    prev = b;
  }
  return { tiles: tiles.filter((t) => !t.playing).length, bentos: infos.length, gap, r, pads: tiles.map((t) => t.pad) };
}

for (const w of widths) {
  out.length = 0;
  let nt = 0, nb = 0;
  for (const pg of ['/videos/', '/games/']) {   // the index pages use the same tiles: same checks, no playing probe
    const dd = shot(`${base}${pg}?motion=0`, w, PROBE);
    if (!dd) { fails++; console.log(`FAIL width ${w} ${pg}: probe returned nothing`); continue; }
    const sm = checkPage(w, pg, dd); nt += sm.tiles; nb += sm.bentos;
  }
  const d = shot(`${base}/?motion=0&clips=demo&n=6`, w, PROBE);
  if (!d) { fails++; console.log(`FAIL width ${w}: probe returned nothing`); continue; }
  const home = checkPage(w, '/', d); nt += home.tiles; nb += home.bentos;
  const pl = shot(`${base}/?motion=0&clips=demo&n=6`, w, PLAYING);
  if (pl && !pl.none) {
    const p = pl.pad;
    ok(near(pl.radius, pl.r, .6), `${w} playing: radius`);
    ok(near(pl.tt.l, p, 1) && near(pl.crow.l, p, 1), `${w} playing: title ${f(pl.tt.l)} / buttons ${f(pl.crow.l)} left != pad ${f(p)}`);
    ok(near(pl.close.r, p, 1) && near(pl.close.t, p, 1), `${w} playing: close button inset ${f(pl.close.r)},${f(pl.close.t)} != pad ${f(p)}`);
    ok(pl.crow.b >= p - 1, `${w} playing: buttons come within ${f(pl.crow.b)} of the bottom edge (pad ${f(p)})`);
  } else if (!pl) { fails++; console.log(`FAIL ${w}: playing probe returned nothing`); }
  console.log(`${out.length ? 'FAIL' : 'ok  '} width ${w}: ${nt} tiles, ${nb} bentos on /, /videos/, /games/, --gap ${f(home.gap)} --pad ${[...new Set(home.pads.map(f))].join('/')} --r ${f(home.r)}${pl && !pl.none ? ', playing row checked' : ''}`);
  for (const l of out.slice(0, 40)) console.log(l);
  if (out.length > 40) console.log(`  ... and ${out.length - 40} more`);
}
console.log(`${fails ? 'FAILED' : 'PASSED'}: ${checks} checks, ${fails} failures`);
process.exit(fails ? 1 : 0);
