// "h" marks, round 3: layered readings in the manner of the existing mark (one obvious letter, one carried by a hook,
// one carried by negative space against a spine stem). Same geometry as everything else (bar 53, round caps, 13 degree lean,
// dot 53, "!" bar 140.54, gap 41.5). Writes svg/hmark-<n>-{bare,ink,paper,blue,roles}.svg, hmark.html and hmark-notes use.
// Run after build-hmark.mjs (which makes candidates 1-5). usage: node build-hmark2.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { T, R, B, XT, BANG, f, capsule, ring, dot, stem, dOf, bbox } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'svg');
const archTop = XT + R, GAP = 41.5, x0 = R;
const arch = (a, b) => ring((a + b) / 2, archTop + (b - a) / 2, (b - a) / 2, Math.PI, 2 * Math.PI);          // semicircle shoulder
const stad = (a, b, rc = 44) => [ring(a + rc, archTop + rc, rc, Math.PI, 1.5 * Math.PI), capsule([a + rc, archTop], [b - rc, archTop]), ring(b - rc, archTop + rc, rc, 1.5 * Math.PI, 2 * Math.PI)];   // flat shoulder with round corners

// roles: h = carries the h, m = carries the m, x = hook / dot / "!" (the J and "!" of the original)
const NEW = [
  { n: 6, name: 'hm ridge', letters: 'h, m', parts: () => { const xa = x0 - 34, x1 = x0 + 93, x2 = x0 + 186, r1 = (x1 - xa) / 2, r2 = (x2 - x1) / 2; return [['h', stem(x0, 0, B)], ['h', arch(xa, x1)], ['h', stem(x1, archTop + r1 - R, B)], ['m', arch(x1, x2)], ['m', stem(x2, archTop + r2 - R, B)]]; },
    feature: 'The arch starts left of the stem, so it crosses it (the original\'s overlapping-bar joint), then a second arch carries on to a third stem: the h\'s shoulder turns into an m.' },
  { n: 7, name: 'peg', letters: 'h, m in the voids', parts: () => { const x1 = x0 + 186, xm = x0 + 93; return [['h', stem(x0, 0, B)], ...stad(x0, x1).map((s) => ['h', s]), ['h', stem(x1, archTop + 44 - R, B)], ['m', stem(xm, XT, B - 64)]]; },
    feature: 'An h with one wide shoulder and a short peg hanging from its middle. The peg is the m\'s middle stem, so the two white slots either side of it are the m\'s counters, read against the stems the way the B is read in the original.' },
  { n: 8, name: 'M stem', letters: 'h, M', parts: () => { const x2 = x0 + 140, mid = x0 + 70, vy = B - R - 22; return [['h', stem(x0, 0, B)], ['m', capsule([x0, XT + R], [mid, vy])], ['m', capsule([mid, vy], [x2, XT + R])], ['m', stem(x2, XT, B)]]; },
    feature: 'The original M (stem, V, stem) at x-height with its left stem pulled up into an ascender: one glyph, read as an M or as an h.' },
  { n: 9, name: 'hook left', letters: 'h, J hook, !', parts: () => { const x1 = x0 + 96; return [['h', stem(x0 + 40, 0, B)], ['x', capsule([x0 + 40, B - R], [x0 - 14, B - R])], ['h', arch(x0 + 40, x1 + 40)], ['h', stem(x1 + 40, archTop + 48 - R, B)], ['x', dot(x1 + 40 + R + GAP + R, B - R)]]; },
    feature: 'The ascender curls into the original\'s J hook (the stem bottom runs into a bar going left, outside the letter), and the "!" dot sits bottom right at the original\'s 41.5 gap. The counter stays open, so it still reads h.' },
  { n: 10, name: 'M ridge', letters: 'h, M diagonals', parts: () => { const x1 = x0 + 100, xm = (x0 + x1) / 2; return [['h', stem(x0, 0, B)], ['m', capsule([x0, archTop + 46], [xm, archTop])], ['m', capsule([xm, archTop], [x1, archTop + 46])], ['h', stem(x1, archTop + 46 - R, B)]]; },
    feature: 'The original\'s two diagonals turned over into a pointed shoulder: stem, ridge, leg. An h whose arch is the M\'s strokes.' },
  { n: 11, name: 'hi', letters: 'h, i', parts: () => { const x1 = x0 + 100; return [['h', stem(x0, 0, B)], ['h', arch(x0, x1)], ['h', stem(x1, archTop + 50 - R, B)], ['x', dot(x1 + R + GAP + R - 8, R)]]; },
    feature: 'A plain h with the "!" dot floating top right at the original\'s distance: the dot gives a hidden i beside the h (h, i, as in hi).' },
  { n: 12, name: 'h, m stacked', letters: 'h, m', parts: () => { const x1 = x0 + 88, x2 = x0 + 176; return [['h', stem(x0, 0, B)], ['h', arch(x0, x1)], ['h', stem(x1, archTop + 44 - R, B - 70)], ['m', arch(x1, x2)], ['m', stem(x2, archTop + 44 - R, B)], ['x', dot(x1, B - R)]]; },
    feature: 'Like 6, but the middle stem stops short and a dot sits under it at the original\'s gap: the middle leg is a "!" hanging inside the m.' },
  { n: 13, name: 'ridge peg', letters: 'h, M diagonals, m in the voids', parts: () => { const x1 = x0 + 170, xm = x0 + 85, drop = 82; return [['h', stem(x0, 0, B)], ['m', capsule([x0, archTop + drop], [xm, archTop])], ['m', capsule([xm, archTop], [x1, archTop + drop])], ['h', stem(x1, archTop + drop - R, B)], ['m', stem(xm, XT, B - 64)]]; },
    feature: 'The M\'s diagonals form the shoulder (as in 10), and a short peg hangs from the ridge: the two white triangles-and-slots either side of it are the m\'s counters against the stem, while the diagonals carry the M.' },
  { n: 14, name: 'double ridge', letters: 'h, M, m', parts: () => { const x1 = x0 + 84, xm1 = x0 + 42, x2 = x0 + 168, xm2 = x0 + 126, drop = 54; return [['h', stem(x0, 0, B)], ['m', capsule([x0, archTop + drop], [xm1, archTop])], ['m', capsule([xm1, archTop], [x1, archTop + drop])], ['h', stem(x1, archTop + drop - R, B)], ['m', capsule([x1, archTop + drop], [xm2, archTop])], ['m', capsule([xm2, archTop], [x2, archTop + drop])], ['m', stem(x2, archTop + drop - R, B)]]; },
    feature: 'Two ridges, three stems: the M\'s diagonals turned over twice, so the h\'s shoulder is also an m made of the original\'s strokes.' },
  { n: 15, name: 'ridge hook', letters: 'h, M diagonals, J hook, dot', parts: () => { const x1 = x0 + 140, xm = x0 + 70, drop = 60; return [['h', stem(x0 + 40, 0, B)], ['x', capsule([x0 + 40, B - R], [x0 - 14, B - R])], ['m', capsule([x0 + 40, archTop + drop], [xm + 40, archTop])], ['m', capsule([xm + 40, archTop], [x1 + 40, archTop + drop])], ['h', stem(x1 + 40, archTop + drop - R, B)], ['x', dot(x1 + 40 + R + GAP + R, B - R)]]; },
    feature: '10 with 9\'s hook and dot: the M diagonals as the shoulder, the J hook off the stem, the "!" dot at the original\'s distance. Three layers, one h.' },
];

const FILL = { ink: ['#0f0e13', '#f1ece1'], paper: ['#f1ece1', '#0f0e13'], blue: ['#0f0e13', '#3d7bff'] };
const ROLE = { h: '#f1ece1', m: '#e8b04a', x: '#7fa6ff' };
const meta = [];
for (const c of NEW) {
  const parts = c.parts();
  const shapes = parts.map((p) => p[1]);
  const bb = bbox(shapes), w = bb.x1 - bb.x0, h = bb.y1 - bb.y0, ds = shapes.map((s) => dOf(s, -bb.x0));
  const g = (cb) => ds.map((d, i) => `<path d="${d}"${cb ? ` fill="${cb(i)}"` : ''}/>`).join('');
  fs.writeFileSync(path.join(out, `hmark-${c.n}-bare.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${f(bb.y0)} ${f(w)} ${f(h)}" role="img" aria-label="halmic h"><g fill="#0f0e13">${g()}</g></svg>\n`);
  fs.writeFileSync(path.join(out, `hmark-${c.n}-roles.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(-10)} ${f(bb.y0 - 10)} ${f(w + 20)} ${f(h + 20)}"><rect x="-10" y="${f(bb.y0 - 10)}" width="${f(w + 20)}" height="${f(h + 20)}" fill="#0f0e13"/>${g((i) => ROLE[parts[i][0]])}</svg>\n`);
  for (const [k, [fg, bg]] of Object.entries(FILL)) {
    const S = 512, s = (S * 0.58) / Math.max(w, h), tw = w * s, th = h * s;
    fs.writeFileSync(path.join(out, `hmark-${c.n}-${k}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" role="img" aria-label="halmic h"><rect width="${S}" height="${S}" rx="${S * 0.225}" fill="${bg}"/><g fill="${fg}" transform="translate(${f((S - tw) / 2)} ${f((S - th) / 2 - bb.y0 * s)}) scale(${(s).toFixed(4)})">${g()}</g></svg>\n`);
  }
  meta.push({ n: c.n, name: c.name, letters: c.letters, feature: c.feature, width: +f(w), height: +f(h) });
}
fs.writeFileSync(path.join(here, 'hmark2.json'), JSON.stringify(meta, null, 2));

// ---------- sheet ----------
const notes = fs.existsSync(path.join(here, 'hmark-notes.json')) ? JSON.parse(fs.readFileSync(path.join(here, 'hmark-notes.json'), 'utf8')) : {};
const old = JSON.parse(fs.readFileSync(path.join(here, 'hmark.json'), 'utf8')).filter((m) => m.n === 2 || m.n === 3).map((m) => ({ ...m, letters: m.n === 2 ? 'h, !' : 'h (plus joint)', roles: false }));
const all = [...old, ...meta.map((m) => ({ ...m, roles: true }))];
const sizes = (src, label) => `<div class="sizes"><span class="lab">${label}</span>${[64, 32, 16].map((s) => `<img src="${src}" width="${s}" height="${s}" alt="">`).join('')}</div>`;
const rows = all.map((m) => { const nt = notes[m.n] ?? {}; return `<section id="m${m.n}"><div class="txt"><h2>${m.n}. ${m.name}${nt.rec ? ` <em>${nt.rec}</em>` : ''}</h2><p class="lt">Letters: ${m.letters}</p><p>${m.feature}</p>${nt.critique ? `<p class="crit"><b>Critique.</b> ${nt.critique}</p>` : ''}</div>
  <div class="tiles"><div><img src="svg/hmark-${m.n}-ink.svg" width="200" alt="halmic h mark ${m.n}, ink on paper"></div><div><img src="svg/hmark-${m.n}-paper.svg" width="200" alt=""></div><div><img src="svg/hmark-${m.n}-blue.svg" width="200" alt=""></div>
  <div class="small">${sizes(`svg/hmark-${m.n}-paper.svg`, 'paper')}${sizes(`svg/hmark-${m.n}-blue.svg`, 'blue')}</div>${m.roles ? `<div class="roles"><img src="svg/hmark-${m.n}-roles.svg" width="120" alt="Which strokes carry which letter"><span class="legend"><i style="background:#f1ece1"></i>h <i style="background:#e8b04a"></i>m or voids <i style="background:#7fa6ff"></i>hook, dot, !</span></div>` : ''}</div></section>`; }).join('\n');
fs.writeFileSync(path.join(here, 'hmark.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>halmic h marks, round 3</title>
<style>:root{--ink:#0f0e13;--paper:#f1ece1;--blue:#3d7bff}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 system-ui,sans-serif}main{max-width:1320px;margin:0 auto;padding:48px 32px 80px}
h1{font-size:15px;margin:0 0 6px}p{margin:0 0 6px;color:#5d5848;max-width:62ch}section{display:grid;grid-template-columns:340px 1fr;gap:32px;padding:28px 0;border-top:1px solid #d9d2c3;align-items:start}h2{font-size:17px;margin:0 0 4px}h2 em{font-style:normal;background:var(--blue);color:#0f0e13;border-radius:99px;padding:1px 10px;font-size:12px;margin-left:6px}
.lt{font-size:13px;color:#7c776d}.crit{color:#0f0e13;font-size:14px}.tiles{display:flex;gap:18px;align-items:center;flex-wrap:wrap}.small{display:flex;flex-direction:column;gap:10px}.sizes{display:flex;gap:10px;align-items:flex-end}.lab{width:40px;font-size:12px;color:#7c776d}
.roles{display:flex;flex-direction:column;gap:6px;font-size:12px;color:#5d5848}.roles img{border-radius:10px}.legend i{display:inline-block;width:10px;height:10px;border-radius:99px;margin:0 4px 0 8px;vertical-align:-1px;box-shadow:0 0 0 1px #0f0e1330}
.ref{background:var(--ink);color:var(--paper);border-radius:20px;padding:20px 24px;display:flex;gap:20px;align-items:center;margin:24px 0;flex-wrap:wrap}.ref p{color:#a29eae}
@media(max-width:900px){section{grid-template-columns:1fr}main{padding:32px 16px}}</style></head><body><main>
<h1>halmic h marks, round 3: layered readings</h1>
<p>The original mark layers three letters: one drawn positively, one as a hook, one as the white between the strokes (see the internal reading note in <code>internal/</code>). These keep the same geometry and apply the same trick to the handle. Options 2 and 3 are the previous round, for comparison. The tiny diagram beside each shows which strokes carry which letter.</p>
<div class="ref"><img src="svg/mark-tile-paper.svg" width="120" alt="existing mark"><img src="svg/mark-tile-ink.svg" width="120" alt=""><img src="svg/mark-tile-paper.svg" width="48" alt=""><img src="svg/mark-tile-paper.svg" width="24" alt=""><p>The existing mark, same tiles and sizes.</p></div>
${rows}</main></body></html>`);
console.log('hmark round 3:', meta.map((m) => `${m.n} ${m.width}x${m.height}`).join(', '));
