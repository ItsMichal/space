// Glyph art for the Project Mountaintop dev log headers: each log's hero photo, its subject lifted out and drawn as 0s and 1s
// (@space/glyph-art). Writes content/glyph-heroes.json, keyed by log slug; a log whose hero has no clean subject is left out and
// its page keeps no header art. macOS only (Vision, swiftc) and needs sharp (root node_modules, or SHARP_PATH); run by hand after
// a content pull that changes a hero, and commit the output. The build only reads it.
//   usage: node halmic/scripts/build-glyph-heroes.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { glyphGrid } from '@space/glyph-art/generate';

const app = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { logs } = JSON.parse(fs.readFileSync(path.join(app, 'content/mountaintop/index.json'), 'utf8'));
const out = {};
for (const l of logs) {
  const g = await glyphGrid(path.join(app, 'public/work/mountaintop', l.hero));
  console.log(`${l.slug}: ${g ? `${g.w}x${g.h}` : 'no clean subject, skipped'}`);
  if (g) out[l.slug] = g;
}
fs.writeFileSync(path.join(app, 'content/glyph-heroes.json'), JSON.stringify(out) + '\n');
