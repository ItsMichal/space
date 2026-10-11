// INTERNAL brand note (not shipped, not part of the site build): how the existing mark layers three letters.
// M = four positive strokes, J = the hook (bottom bar curling off the long stem), B = the negative space between the strokes.
// Writes mjb-reading.png and prints the measurements. usage: SHARP_PATH=.../sharp node mjb-reading.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_PATH || 'sharp');
const src = fs.readFileSync(path.join(here, '../mark.svg'), 'utf8');
const D = [...src.matchAll(/<path[^>]* d="([^"]+)"/g)].map((m) => m[1]);   // 0 bar1, 1 dot, 2 long bar, 3 "!" bar, 4 "!" dot, 5 bottom bar, 6 diag, 7 diag
const S = 4, W = Math.round(349.92 * S), H = Math.round(235.02 * S);
const svg = (paths, fills, extra = '', bg = '#0f0e13') => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 349.92 235.02"><rect width="349.92" height="235.02" fill="${bg}"/>${extra}${paths.map((i, k) => `<path d="${D[i]}" fill="${fills[k]}"/>`).join('')}</svg>`;
const png = (s) => sharp(Buffer.from(s)).png().toBuffer();

// panel 1: M
const M = await png(svg([0, 6, 7, 2, 5, 3, 4], ['#3d7bff', '#3d7bff', '#3d7bff', '#3d7bff', '#2a2733', '#2a2733', '#2a2733']));
// panel 2: J hook = bottom bar + the long stem's lower end, shown over the M
const clip = `<clipPath id="low"><rect x="0" y="120" width="400" height="200"/></clipPath>`;
const J = await png(svg([0, 6, 7, 2], ['#2a3a66', '#2a3a66', '#2a3a66', '#2a3a66'], clip) .replace('</svg>', `<path d="${D[2]}" fill="#e8b04a" clip-path="url(#low)"/><path d="${D[5]}" fill="#e8b04a"/><path d="${D[3]}" fill="#2a2733"/><path d="${D[4]}" fill="#2a2733"/></svg>`));

// panel 3: B = the voids. Rasterise all strokes, then take the white that sits between them and lean against the long stem.
const maskRaw = await sharp(Buffer.from(svg([0, 1, 2, 3, 4, 5, 6, 7], Array(8).fill('#fff'), '', '#000'))).greyscale().raw().toBuffer();
const inked = (x, y) => maskRaw[y * W + x] > 127;
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const lobe1 = [[540, 548], [764, 356], [716, 548]];            // wedge under the right diagonal, against the long stem
const lobe2 = (x, y) => x >= 300 && x <= 700 && y >= 576 && y <= 727;   // pocket between the V and the bottom bar
const out = Buffer.alloc(W * H * 4);
let a1 = 0, a2 = 0, minX2 = 1e9, maxX2 = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const o = (y * W + x) * 4; let r = 15, g = 14, b = 19;
  if (inked(x, y)) { r = 42; g = 39; b = 51; }
  else if (inPoly(x, y, lobe1)) { r = 255; g = 120; b = 150; a1++; }
  else if (lobe2(x, y)) { r = 255; g = 120; b = 150; a2++; minX2 = Math.min(minX2, x); maxX2 = Math.max(maxX2, x); }
  out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
}
const Bp = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();

const label = (t) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="60"><text x="0" y="40" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#f1ece1">${t}</text></svg>`);
const gap = 40, total = W * 3 + gap * 4;
const canvas = sharp({ create: { width: total, height: H + 200, channels: 3, background: '#0f0e13' } });
const cols = [[M, 'M: four positive strokes (left stem, two diagonals, long stem)'], [J, 'J: the long stem curls into the bottom bar'], [Bp, 'B: the white between strokes, two lobes stacked against the stem']];
const comps = [];
for (let i = 0; i < 3; i++) { const left = gap + i * (W + gap); comps.push({ input: cols[i][0], left, top: 100 }); comps.push({ input: label(cols[i][1].replace(/&/g, '&amp;')), left, top: 30 }); }
comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="60"><text x="${gap}" y="40" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#a29eae">Upper lobe ${(a1 / (S * S)).toFixed(0)} sq units (a wedge), lower lobe ${(a2 / (S * S)).toFixed(0)} sq units (pocket ${((maxX2 - minX2) / S).toFixed(0)} wide, 46 high between the V's tip at y 136 and the bottom bar's top at y 182.02). The stem is the spine both lobes lean on.</text></svg>`), left: 0, top: H + 120 });
await canvas.composite(comps).png().toFile(path.join(here, 'mjb-reading.png'));
console.log({ lobe1_units2: a1 / (S * S), lobe2_units2: a2 / (S * S), lobe2_width_units: (maxX2 - minX2) / S });
