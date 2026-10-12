// Small-size favicon variant of mark 3 ("plus joint" h on a cobalt tile). At 16px the plus joint (two bars overlapping,
// 53-unit strokes on a 58% glyph) fills in, so this variant uses: thicker strokes (12/64 of the tile = 3px at 16px),
// a bigger glyph (about 72% of the tile), and an opened joint (the shoulder bar meets the stem in a corner instead of crossing it).
// Same lean (13 degrees), round caps and cobalt tile as the full mark.
// Writes svg/hmark-3-small.svg; render-favicons.mjs rasterises it to favicon-16/32 and the full mark to apple-touch-icon.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const W = 12, LEAN = Math.tan(13 * Math.PI / 180);
// upright centerlines, y = 0 at the baseline centerline, negative up
const top = -34, bar = -16, gap = 26;
const lines = [[0, top, 0, 0], [0, bar, gap, bar], [gap, bar, gap, 0]];
const outer = { x0: -W / 2, x1: gap + W / 2 + LEAN * (-top + W / 2), y0: top - W / 2, y1: W / 2 };
const tx = 32 - (outer.x0 + outer.x1) / 2, ty = 32 - (outer.y0 + outer.y1) / 2;
const d = lines.map(([a, b, c, e]) => `M${a} ${b}L${c} ${e}`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="halmic h"><rect width="64" height="64" rx="14.4" fill="#3d7bff"/><path d="${d}" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) skewX(-13)" fill="none" stroke="#0f0e13" stroke-width="${W}" stroke-linecap="round" stroke-linejoin="round"/></svg>\n`;
fs.writeFileSync(path.join(here, 'svg/hmark-3-small.svg'), svg);
console.log('wrote svg/hmark-3-small.svg');
