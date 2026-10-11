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
    feature: 'The mark\'s M: a diagonal bar crosses a vertical stem and keeps going, so two bars meet in an X-shaped joint at the shoulder.',
    shapes: () => [stem(x0, 0, B), capsule([x0 - 46, archTop - 20], [x1, archTop + 78]), rightLeg(x1, archTop + 78 - R)],
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
      const cx = (x0 + x1) / 2, cy = B / 2, d = 205;
      return [stem(x0, 0, B), roundArch(x0, x1), rightLeg(x1, archTop + P / 2 - R),
        capsule([cx, cy - d + 30], [cx, cy - d - 0]), capsule([cx, cy + d - 0], [cx, cy + d - 30]),
        capsule([cx - d - 40, cy], [cx - d - 10, cy]), capsule([cx + d + 10, cy], [cx + d + 40, cy])];
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
