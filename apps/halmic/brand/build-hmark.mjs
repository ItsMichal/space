// "h" monogram candidates, built from the mark's own geometry (see lib.mjs / build-logotype.mjs).
// Five readings of "the crosshair thing in the logo". Writes svg/hmark-<n>-{bare,ink,paper,blue}.svg and hmark.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { T, R, B, XH, XT, BANG, f, capsule, ring, dot, stem, dOf, bbox } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'svg');
fs.mkdirSync(out, { recursive: true });
const archTop = XT + R;
const P = 96, x0 = R, x1 = R + P;

const roundArch = (a, b) => ring((a + b) / 2, archTop + (b - a) / 2, (b - a) / 2, Math.PI, 2 * Math.PI);
const rightLeg = (x, yTop) => stem(x, yTop, B);

const CANDIDATES = [
  {
    n: 1, name: 'Diagonal cross',
    feature: 'Where the mark\'s bars overlap: the arch is its own bar and starts to the left of the stem, so it crosses the ascender and its tip pokes out the other side, an X-shaped joint at the shoulder.',
    shapes: () => { const xa = x0 - 44; return [stem(x0, 0, B), ring((xa + x1) / 2, archTop + (x1 - xa) / 2, (x1 - xa) / 2, Math.PI, 2 * Math.PI), rightLeg(x1, archTop + (x1 - xa) / 2 - R)]; },
  },
  {
    n: 2, name: 'h!',
    feature: 'The mark\'s "!": a bar with a dot below it, same bar height (140.54), same gap (41.5), set after the h so the pair reads like the "M!" lockup.',
    shapes: () => { const xb = x1 + T + 38; return [stem(x0, 0, B), roundArch(x0, x1), rightLeg(x1, archTop + P / 2 - R), stem(xb, 0, BANG), dot(xb, B - R)]; },
  },
  {
    n: 3, name: 'Plus joint',
    feature: 'The mark\'s bottom bar meeting the long stem: here the shoulder is a horizontal bar that crosses the ascender and sticks out the other side, making a plus where the two bars overlap.',
    shapes: () => [stem(x0, 0, B), capsule([x0 - 52, archTop + 22], [x1, archTop + 22]), rightLeg(x1, archTop + 22 - R)],
  },
  {
    n: 4, name: 'Reticle',
    feature: 'A sight: four bar-tips (the mark\'s bars, shortened) at north, east, south and west with the h held in the middle, like a reticle around the dot.',
    shapes: () => {
      const cx = (x0 + x1) / 2, cy = B / 2, d = 215;
      return [stem(x0, 0, B), roundArch(x0, x1), rightLeg(x1, archTop + P / 2 - R),
        capsule([cx, cy - d - 60], [cx, cy - d]), capsule([cx, cy + d], [cx, cy + d + 60]),
        capsule([cx - d - 60, cy], [cx - d, cy]), capsule([cx + d, cy], [cx + d + 60, cy])];
    },
  },
  {
    n: 5, name: 'Sight dot',
    feature: 'The mark\'s dot, placed as a sight inside the h\'s counter, the arch widened so the dot (53) floats with equal air on both sides.',
    shapes: () => { const w = 150, xa = R, xb = R + w; return [stem(xa, 0, B), roundArch(xa, xb), rightLeg(xb, archTop + w / 2 - R), dot((xa + xb) / 2, B - R - 20)]; },
  },
];

const FILLS = { ink: ['#0f0e13', '#f1ece1'], paper: ['#f1ece1', '#0f0e13'], blue: ['#0f0e13', '#3d7bff'] };   // [mark, tile]
const meta = [];
for (const c of CANDIDATES) {
  const shapes = c.shapes();
  const bb = bbox(shapes);
  const w = bb.x1 - bb.x0, h = bb.y1 - bb.y0, ds = shapes.map((s) => dOf(s, -bb.x0));
  const paths = (fill) => ds.map((d) => `<path d="${d}"/>`).join('');
  fs.writeFileSync(path.join(out, `hmark-${c.n}-bare.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${f(bb.y0)} ${f(w)} ${f(h)}" role="img" aria-label="halmic h"><g fill="#0f0e13">${paths()}</g></svg>\n`);
  for (const [k, [fg, bg]] of Object.entries(FILLS)) {
    const S = 512, s = (S * 0.58) / Math.max(w, h * 1.0), tw = w * s, th = h * s;
    fs.writeFileSync(path.join(out, `hmark-${c.n}-${k}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" role="img" aria-label="halmic h"><rect width="${S}" height="${S}" rx="${S * 0.225}" fill="${bg}"/><g fill="${fg}" transform="translate(${f((S - tw) / 2)} ${f((S - th) / 2 - bb.y0 * s)}) scale(${f(s * 1000) / 1000})">${paths()}</g></svg>\n`);
  }
  meta.push({ n: c.n, name: c.name, feature: c.feature, width: +f(w), height: +f(h) });
}
fs.writeFileSync(path.join(here, 'hmark.json'), JSON.stringify(meta, null, 2));
console.log('wrote', CANDIDATES.length, 'h marks');

// ---------- contact sheet ----------
const sizes = (src, label) => `<div class="sizes"><span class="lab">${label}</span>${[64, 32, 16].map((s) => `<img src="${src}" width="${s}" height="${s}" alt="">`).join('')}</div>`;
const rows = meta.map((m) => `<section><div class="txt"><h2>${m.n}. ${m.name}</h2><p>${m.feature}</p></div>
  <div class="tiles">
    <div><img src="svg/hmark-${m.n}-ink.svg" width="220" alt="halmic h, interpretation ${m.n}, ink on paper"></div>
    <div><img src="svg/hmark-${m.n}-paper.svg" width="220" alt=""></div>
    <div><img src="svg/hmark-${m.n}-blue.svg" width="220" alt=""></div>
    <div class="small">${sizes(`svg/hmark-${m.n}-paper.svg`, 'paper')}${sizes(`svg/hmark-${m.n}-blue.svg`, 'blue')}</div>
  </div></section>`).join('\n');
fs.writeFileSync(path.join(here, 'hmark.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>halmic h marks</title>
<style>:root{--ink:#0f0e13;--paper:#f1ece1;--blue:#3d7bff}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 system-ui,sans-serif}main{max-width:1280px;margin:0 auto;padding:48px 32px 80px}
h1{font-size:15px;margin:0 0 6px}p{margin:0;color:#5d5848;max-width:62ch}section{display:grid;grid-template-columns:300px 1fr;gap:32px;padding:28px 0;border-top:1px solid #d9d2c3;align-items:center}h2{font-size:17px;margin:0 0 6px}
.tiles{display:flex;gap:20px;align-items:center;flex-wrap:wrap}.small{display:flex;flex-direction:column;gap:12px}.sizes{display:flex;gap:12px;align-items:flex-end}.lab{width:44px;font-size:12px;color:#7c776d}
.ref{background:var(--ink);color:var(--paper);border-radius:20px;padding:20px 24px;display:flex;gap:24px;align-items:center;margin:28px 0}.ref p{color:#a29eae}
@media(max-width:820px){section{grid-template-columns:1fr}main{padding:32px 16px}}</style></head><body><main>
<h1>halmic h marks: five readings of "the crosshair"</h1>
<p>All built from the mark's geometry (bar 53, round caps, 13 degree lean, dot 53). For comparison, the existing mark on the same tiles at the same sizes.</p>
<div class="ref"><img src="svg/mark-tile-paper.svg" width="140" alt="existing M! mark"><img src="svg/mark-tile-ink.svg" width="140" alt=""><img src="svg/mark-tile-paper.svg" width="48" alt=""><img src="svg/mark-tile-paper.svg" width="24" alt=""><p>The existing mark. Which feature did you mean by the crosshair: the joints where bars overlap, the dot and bar of the "!", or something else?</p></div>
${rows}</main></body></html>`);
