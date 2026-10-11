// Share images (1200x630) with the halmic logotype: home, one per game, one per video, one for the design entry.
// Needs `sharp` (resolved from the working tree or WS_PATH-like env SHARP_PATH). Output: halmic/public/og/*.png
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let sharp;
for (const p of [process.env.SHARP_PATH, 'sharp'].filter(Boolean)) { try { sharp = require(p); break; } catch { /* next */ } }
if (!sharp) { console.warn('sharp not found; set SHARP_PATH. Skipping OG images (existing files kept).'); process.exit(0); }

const out = path.join(root, 'public/og');
fs.mkdirSync(out, { recursive: true });
const W = 1200, H = 630;
const wordmark = fs.readFileSync(path.join(root, 'brand/svg/wordmark-c-paper.svg'));
const wmBuf = (w) => sharp(wordmark, { density: 300 }).resize({ width: w }).png().toBuffer();
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const wrap = (s, n) => { const w = s.split(' '), l = []; let c = ''; for (const x of w) { if ((c + ' ' + x).trim().length > n) { l.push(c); c = x; } else c = (c + ' ' + x).trim(); } if (c) l.push(c); return l.slice(0, 3); };
// the field of leaning bars (static frame of the live meter)
const bars = Array.from({ length: 16 }, (_, i) => { const h = 120 + 200 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)); return `<rect x="${i * 84 - 20}" y="${H - h}" width="50" height="${h + 40}" rx="25" fill="#3d7bff" fill-opacity=".16" transform="skewX(-13) translate(${(H) * 0.2309} 0)"/>`; }).join('');
const base = () => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#0f0e13"/>${bars}</svg>`));

async function card(name, { title, image, imageFit = 'cover', pixel = false }) {
  const layers = [];
  if (image) {
    const img = await sharp(image).resize({ width: 520, height: 412, fit: imageFit, kernel: pixel ? 'nearest' : 'lanczos3' }).png().toBuffer();
    const mask = Buffer.from(`<svg width="520" height="412"><rect width="520" height="412" rx="28"/></svg>`);
    layers.push({ input: await sharp(img).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer(), left: 620, top: 90 });
    layers.push({ input: await wmBuf(360), left: 64, top: 70 });
    const lines = wrap(title, 22).map((l, i) => `<text x="64" y="${300 + i * 62}" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="52" fill="#f1ece1">${esc(l)}</text>`).join('');
    layers.push({ input: Buffer.from(`<svg width="${W}" height="${H}">${lines}<text x="64" y="${H - 56}" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#a29eae">halmic.com</text></svg>`), left: 0, top: 0 });
  } else {
    layers.push({ input: await wmBuf(960), left: 120, top: 150 });
    layers.push({ input: Buffer.from(`<svg width="${W}" height="${H}"><text x="124" y="${H - 96}" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="44" fill="#f1ece1">${esc(title)}</text></svg>`), left: 0, top: 0 });
  }
  await base().composite(layers).png({ compressionLevel: 9 }).toFile(path.join(out, `${name}.png`));
}

const games = JSON.parse(fs.readFileSync(path.join(root, 'content/games.json'), 'utf8')).games;
const videos = JSON.parse(fs.readFileSync(path.join(root, 'content/videos.json'), 'utf8')).videos;
await card('home', { title: 'productions' });
for (const g of games) if (g.coverLocal) await card(`game-${g.slug}`, { title: g.title.replace(/ \(.*\)$/, ''), image: path.join(root, 'public', g.coverLocal), pixel: true });
const cur = JSON.parse(fs.readFileSync(path.join(root, 'content/curation.json'), 'utf8')).videos;
const pageIds = new Set([...cur.series.episodes, ...cur.other.map((o) => o.id)]);
for (const f of fs.readdirSync(out)) if (f.startsWith('video-')) fs.rmSync(path.join(out, f));
for (const v of videos) { const f = path.join(root, 'public', v.thumb); if (pageIds.has(v.id) && fs.existsSync(f)) await card(`video-${v.id}`, { title: v.title, image: f }); }
await card('design-sedd', { title: 'Logo for Southeast Denver Dental', image: path.join(root, 'public/work/southeast-denver-dental-header.png'), imageFit: 'contain' });
console.log('og images:', fs.readdirSync(out).length);
