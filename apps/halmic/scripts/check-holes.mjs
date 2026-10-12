// Layout check (needs Chrome and a running server: PORT=4563 node serve.mjs): the Watch bento must be hole-free at 4 / 3 / 2 columns with 0..6 clips.
// usage: node scripts/check-holes.mjs [base-url]   (uses scripts/shot.mjs for the headless Chrome session)
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] ?? 'http://localhost:4563';
// occupancy grid from the tiles' rectangles: unit = column width + gap; holes = cells in the rows used that no tile covers; ok = no two tiles overlap
const probe = `(() => { const b = document.querySelector('.b-watch'); const cols = parseInt(getComputedStyle(b).getPropertyValue('--cols'), 10); const bb = b.getBoundingClientRect(); const gap = parseFloat(getComputedStyle(b).gap); const cw = (bb.width - gap * (cols - 1)) / cols; const occ = new Set(); let rows = 0, ok = true;
for (const t of b.children) { const r = t.getBoundingClientRect(); const c0 = Math.round((r.left - bb.left) / (cw + gap)), r0 = Math.round((r.top - bb.top) / (cw + gap)), cs = Math.round((r.width + gap) / (cw + gap)), rs = Math.round((r.height + gap) / (cw + gap)); for (let y = r0; y < r0 + rs; y++) for (let x = c0; x < c0 + cs; x++) { if (occ.has(y * 10 + x)) ok = false; occ.add(y * 10 + x); } rows = Math.max(rows, r0 + rs); }
return JSON.stringify({ cols, rows, holes: rows * cols - occ.size, ok }); })()`.replace(/\s+/g, ' ');
let fail = 0;
for (const n of [0, 1, 2, 3, 4, 5, 6]) for (const [w, cols] of [[1440, 4], [800, 3], [390, 2]]) {
  const url = `${base}/?clips=${n ? 'demo&n=' + n : 'none'}`;
  const r = spawnSync('node', [path.join(here, 'shot.mjs'), url, path.join(os.tmpdir(), 'holes.jpg'), String(w), '900', 'jpg', '700', `eval=${probe}`], { encoding: 'utf8' });
  const m = r.stdout.match(/eval: (".*")/);
  const res = m ? JSON.parse(JSON.parse(m[1])) : null;
  const good = res && res.cols === cols && res.holes === 0 && res.ok;
  if (!good) fail++;
  console.log(`${good ? 'ok  ' : 'FAIL'} clips=${n} width=${w}`, res ? JSON.stringify(res) : r.stderr.slice(0, 200));
}
process.exit(fail ? 1 : 0);
