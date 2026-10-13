// Share images (1200x630 JPEG, <= 300 KB) for every page: node scripts/build-og.mjs   (output: public/og/*.jpg)
// Each card is an HTML template (the site's own display face, ink background, paper wordmark, cobalt accent) screenshotted
// with headless Chrome through scripts/shot.mjs, then re-encoded with sharp. Fonts, wordmark and pictures are inlined as
// data URIs, so nothing depends on a server. Needs Chrome (CHROME_PATH), `ws` and `sharp` (both from the root node_modules).
// Keys: home, games, videos, design, game-<slug>, video-<id>, design-sedd, work-phoenix-rising,
// work-project-mountaintop, mountaintop-<slug>. build.mjs refers to them as /og/<key>.jpg.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let sharp;
for (const p of [process.env.SHARP_PATH, 'sharp'].filter(Boolean)) { try { sharp = require(p); break; } catch { /* next */ } }
if (!sharp) { console.warn('sharp not found; set SHARP_PATH. Skipping OG images (existing files kept).'); process.exit(0); }

const out = path.join(root, 'public/og');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'og-'));
const pub = (p) => path.join(root, 'public', p);
const b64 = (file) => fs.readFileSync(file).toString('base64');
const mime = (f) => ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' })[path.extname(f).slice(1)];
const uri = (file) => `data:${mime(file)};base64,${b64(file)}`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const fontsDir = pub('fonts');
const displayFont = fs.readdirSync(fontsDir).find((f) => /^halmic-display\..*\.woff2$/.test(f));   // content-hashed name
if (!displayFont) throw new Error('display font not found in public/fonts');
const FONTS = `@font-face{font-family:D;src:url(data:font/woff2;base64,${b64(path.join(fontsDir, displayFont))}) format("woff2");font-weight:900}
@font-face{font-family:T;src:url(data:font/woff2;base64,${b64(path.join(fontsDir, 'halmic-text-latin.woff2'))}) format("woff2");font-weight:400 800}`;
const wordmarkSvg = (fill) => fs.readFileSync(path.join(root, 'brand/svg/wordmark-c-paper.svg'), 'utf8').replace(/#f1ece1/g, fill);
const WM = (h) => `<div style="height:${h}px;aspect-ratio:859.81/235.02">${wordmarkSvg('#f1ece1').replace('<svg ', '<svg style="height:100%;width:100%" ')}</div>`;

// the leaning pills of the site's meter, a static frame; the dot is the "!" of the mark
const pills = (n, base, amp, opacity = 1) => Array.from({ length: n }, (_, i) => {
  const h = base + amp * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6));
  return `<i style="left:${i * 86 - 30}px;height:${h}px"></i>`;
}).join('');

const CSS = `${FONTS}
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden;background:#0f0e13;color:#f1ece1;font-family:T,Arial,sans-serif}
.card{position:relative;width:1200px;height:630px;overflow:hidden;background:radial-gradient(900px 500px at 85% 0%,#1b2340 0%,#0f0e13 70%)}
.bars{position:absolute;left:0;right:0;bottom:0;height:300px;transform:skewX(-13deg);transform-origin:bottom left;margin-left:40px}
.bars i{position:absolute;bottom:-40px;width:52px;border-radius:26px;background:#3d7bff;opacity:.14}
.dot{position:absolute;border-radius:50%;background:#3d7bff}
.chip{display:inline-flex;align-items:center;gap:10px;font:700 24px/1 T;letter-spacing:.14em;text-transform:uppercase;color:#7fa6ff;border:2px solid #3d7bff;border-radius:999px;padding:11px 20px}
.chip:before{content:"";width:12px;height:12px;border-radius:50%;background:#3d7bff}
.title{font-family:D;font-weight:900;color:#f1ece1;letter-spacing:0}
.url{font:600 26px/1 T;color:#a29eae}
.url b{color:#7fa6ff;font-weight:600}
.panel{position:absolute;border-radius:30px;overflow:hidden;background:#181621;box-shadow:0 0 0 2px #2c2938}
.panel img{width:100%;height:100%;display:block;object-fit:cover}
.px img{image-rendering:pixelated}
.contain img{object-fit:contain}`;

const page = (inner) => `<!doctype html><meta charset="utf-8"><style>${CSS}</style><div class="card">${inner}</div>`;

// font size by length so a title always fits its column
const tsize = (t, w) => { const n = t.length; const s = w > 520 ? 78 : 66; return n > 70 ? s - 28 : n > 52 ? s - 20 : n > 36 ? s - 12 : n > 22 ? s - 4 : s + 6; };
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, '') + '…');

// kind: chip text. img: file (absolute). shape: 'wide' (16:9-ish photos) | 'game' (pixel covers) | 'logo'
const cardPage = ({ kind, title, img, shape = 'wide', pixel = false }) => {
  const panel = shape === 'game' ? { w: 500, h: 400 } : { w: 500, h: 300 };
  const left = 64, colW = 520;
  return page(`<div class="bars">${pills(15, 90, 150)}</div>
<div style="position:absolute;left:${left}px;top:64px">${WM(44)}</div>
<div style="position:absolute;left:${left}px;top:160px;width:${colW}px"><span class="chip">${esc(kind)}</span></div>
<div class="title" style="position:absolute;left:${left}px;top:236px;width:${colW}px;font-size:${tsize(title, colW)}px;line-height:1.04;max-height:300px;overflow:hidden">${esc(title)}</div>
<div class="url" style="position:absolute;left:${left}px;bottom:64px">halmic<b>.com</b></div>
<div class="panel ${pixel ? 'px' : ''} ${shape === 'logo' ? 'contain' : ''}" style="left:636px;top:${Math.round((630 - panel.h) / 2)}px;width:${panel.w}px;height:${panel.h}px${shape === 'logo' ? ';background:#f1ece1' : ''}"><img src="${uri(img)}"></div>`);
};

// section cards: a 2x2 (or single) mosaic of the section's pictures
const indexPage = ({ kind, title, imgs, pixel = false }) => {
  const tiles = imgs.slice(0, 4);
  const w = 236, h = 150, gap = 20, x0 = 640;
  const grid = tiles.map((f, i) => `<div class="panel ${pixel ? 'px' : ''}" style="left:${x0 + (i % 2) * (w + gap)}px;top:${150 + Math.floor(i / 2) * (h + gap) + (i % 2 ? 40 : 0)}px;width:${w}px;height:${h}px;border-radius:22px"><img src="${uri(f)}"></div>`).join('');
  return page(`<div class="bars">${pills(15, 90, 150)}</div>
<div style="position:absolute;left:64px;top:64px">${WM(44)}</div>
<div style="position:absolute;left:64px;top:160px"><span class="chip">${esc(kind)}</span></div>
<div class="title" style="position:absolute;left:64px;top:236px;width:520px;font-size:${tsize(title, 520) + 10}px;line-height:1.04">${esc(title)}</div>
<div class="url" style="position:absolute;left:64px;bottom:64px">halmic<b>.com</b></div>${grid}`);
};

const homePage = () => page(`<div class="bars" style="height:260px">${pills(16, 80, 130)}</div>
<div class="dot" style="left:1000px;top:76px;width:44px;height:44px"></div>
<div style="position:absolute;left:84px;top:110px">${WM(250)}</div>
<div class="title" style="position:absolute;left:92px;top:410px;font-size:68px;line-height:1">halmic productions</div>
<div class="url" style="position:absolute;left:94px;bottom:64px">streams, videos, games and design · halmic<b>.com</b></div>`);

// ---- render ----
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) fs.rmSync(path.join(out, f));   // replace, never accumulate
const shot = path.join(root, 'scripts/shot.mjs');
async function render(key, html) {
  const htmlFile = path.join(tmp, `${key}.html`), png = path.join(tmp, `${key}.png`);
  fs.writeFileSync(htmlFile, html);
  let r;
  for (let attempt = 0; attempt < 3 && !fs.existsSync(png); attempt++) {   // Chrome occasionally hangs on start: time out and retry
    r = spawnSync(process.execPath, [shot, `file://${htmlFile}`, png, '1200', '630', '700'], { stdio: 'pipe', encoding: 'utf8', timeout: 40000 });
  }
  if (!fs.existsSync(png)) throw new Error(`${key}: screenshot failed\n${r?.stdout}${r?.stderr}`);
  let q = 90, buf;
  do { buf = await sharp(png).jpeg({ quality: q, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer(); q -= 4; } while (buf.length > 290 * 1024 && q > 50);
  fs.writeFileSync(path.join(out, `${key}.jpg`), buf);
  console.log(key.padEnd(52), Math.round(buf.length / 1024) + ' KB');
}

const games = JSON.parse(fs.readFileSync(pub('../content/games.json'), 'utf8')).games.filter((g) => g.coverLocal);
const videos = JSON.parse(fs.readFileSync(pub('../content/videos.json'), 'utf8')).videos;
const cur = JSON.parse(fs.readFileSync(pub('../content/curation.json'), 'utf8')).videos;
const pageIds = new Set([...cur.series.episodes, ...cur.other.map((o) => o.id)]);
const pageVideos = videos.filter((v) => pageIds.has(v.id) && fs.existsSync(pub(v.thumb)));
const pr = JSON.parse(fs.readFileSync(pub('../content/phoenix-rising.json'), 'utf8'));
const mtc = JSON.parse(fs.readFileSync(pub('../content/mountaintop/index.json'), 'utf8'));
const mtTitle = (slug) => fs.readFileSync(pub(`../content/mountaintop/${slug}.md`), 'utf8').match(/^title: (.*)$/m)[1].replace(/^["']|["']$/g, '');
const mtImg = (f) => pub(`work/mountaintop/${f}`);

await render('home', homePage());
await render('games', indexPage({ kind: 'Play', title: 'Little games', imgs: games.map((g) => pub(g.coverLocal)), pixel: true }));
await render('videos', indexPage({ kind: 'Watch', title: 'Videos', imgs: pageVideos.slice(0, 4).map((v) => pub(v.thumb)) }));
await render('design', cardPage({ kind: 'Design', title: 'Things I’ve designed', img: pub('work/southeast-denver-dental-header.png'), shape: 'logo' }));
for (const g of games) await render(`game-${g.slug}`, cardPage({ kind: 'Game', title: g.title.replace(/ \(.*\)$/, ''), img: pub(g.coverLocal), shape: 'game', pixel: true }));
for (const v of pageVideos) await render(`video-${v.id}`, cardPage({ kind: 'Video', title: clip(v.title.replace(/\s*-\s*Funny.*$/i, ''), 64), img: pub(v.thumb) }));
await render('design-sedd', cardPage({ kind: 'Design', title: 'Logo for Southeast Denver Dental', img: pub('work/southeast-denver-dental-header.png'), shape: 'logo' }));
await render('work-phoenix-rising', cardPage({ kind: 'Work · QA', title: `${pr.role} on ${pr.title}`, img: pub(`videos/${pr.thumb}.jpg`) }));
await render('work-project-mountaintop', cardPage({ kind: 'Work · Game', title: mtc.title, img: mtImg(mtc.cover) }));
for (const l of mtc.logs) await render(`mountaintop-${l.slug}`, cardPage({ kind: 'Dev log', title: mtTitle(l.slug), img: mtImg(l.hero) }));
fs.rmSync(tmp, { recursive: true, force: true });
console.log('og images:', fs.readdirSync(out).length);
