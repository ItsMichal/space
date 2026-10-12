// Checks the built public/ tree: every internal href/src/og:image resolves to a file, no placeholders or draft markers remain,
// sitemap entries exist, the 404 is noindex, and the card layout holds (one link per card, no inline styles, local images only, the removed copy stays removed). Run after `npm run build`. Exits 1 on any problem.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const SITE = 'https://halmic.com';
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const htmls = walk(pub).filter((f) => f.endsWith('.html'));
const bad = [];
const resolve = (u) => {
  const p = decodeURIComponent(u.split('#')[0].split('?')[0]);
  const f = path.join(pub, p.endsWith('/') ? p + 'index.html' : p);
  return fs.existsSync(f) && fs.statSync(f).isFile();
};
const check = (from, u) => {
  if (!u || u.startsWith('#') || /^(mailto:|tel:|data:)/.test(u)) return;
  if (u.startsWith(SITE)) u = u.slice(SITE.length) || '/';
  if (/^(https?:)?\/\//.test(u)) return;
  if (!u.startsWith('/')) return bad.push(`${from}: relative URL ${u}`);
  if (!resolve(u)) bad.push(`${from}: ${u} does not resolve`);
};
for (const f of htmls) {
  const rel = path.relative(pub, f), h = fs.readFileSync(f, 'utf8');
  for (const m of h.matchAll(/\b(?:href|src)="([^"]*)"/g)) check(rel, m[1]);
  for (const m of h.matchAll(/<meta property="og:image" content="([^"]*)"|<meta name="twitter:image" content="([^"]*)"|<link rel="canonical" href="([^"]*)"/g)) check(rel, m[1] ?? m[2] ?? m[3]);
  for (const m of h.matchAll(/<img\b[^>]*>/g)) if (!/\balt="/.test(m[0]) || !/\bwidth="/.test(m[0]) || !/\bheight="/.test(m[0])) bad.push(`${rel}: img without alt/width/height: ${m[0].slice(0, 80)}`);
  if (/MISSING:|class="(ph|draft)\b|\[(owner|draft|date|category|link)[^\]]*\]/.test(h)) bad.push(`${rel}: placeholder or draft marker`);
  if ((h.match(/<h1[\s>]/g) ?? []).length !== 1) bad.push(`${rel}: expected exactly one h1`);
  if (/\sstyle="/.test(h)) bad.push(`${rel}: inline style attribute (CSP: style-src 'self')`);
  if (/<a\b(?:(?!<\/a>)[\s\S])*?<a\b/.test(h)) bad.push(`${rel}: nested anchors`);
  for (const m of h.matchAll(/<img\b[^>]*\bsrc="(https?:)?\/\/[^"]*"/g)) bad.push(`${rel}: third-party image ${m[0].slice(0, 80)}`);
  for (const m of h.matchAll(/<a class="card[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) if (!/<h3 class="ct">/.test(m[1])) bad.push(`${rel}: card without an h3 title`);
  if (/The logo only|This logotype|construction-c|hmark-3-blue/.test(h)) bad.push(`${rel}: removed copy or asset is back`);
  if (/data-dock|calm\.(html|css)/.test(h)) bad.push(`${rel}: prototype leftovers`);
}
const home = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
for (const id of ['stream', 'videos', 'games', 'design', 'hi', 'clips-all']) if (!home.includes(`id="${id}"`)) bad.push(`index.html: missing #${id}`);
if (/id="clips"|id="when"|class="plays"|On the stream/.test(home)) bad.push('index.html: the old stream section is back');
if ((home.match(/<h2>/g) ?? []).length < 5) bad.push('index.html: expected the group headers as h2');
if ((home.match(/<a class="card/g) ?? []).length < 20) bad.push('index.html: fewer cards than expected');
if (!home.includes('href="/#stream">clips<')) bad.push('index.html: nav item should be "clips"');
const px = fs.readFileSync(path.join(pub, 'work/pokemon-phoenix-rising/index.html'), 'utf8');
if (!/Videos by <a href="https:\/\/www\.youtube\.com\/@PhoenixRisingGame"/.test(px) || (px.match(/data-vid="/g) ?? []).length < 2) bad.push('work/pokemon-phoenix-rising: channel credit or videos missing');
const mtDir = path.join(pub, 'work/project-mountaintop');
const mtHome = fs.readFileSync(path.join(mtDir, 'index.html'), 'utf8');
if (!/data-vid="Gv-xMeMM8m4"/.test(mtHome) || !mtHome.includes('youtube-nocookie.com/embed/Gv-xMeMM8m4')) bad.push('work/project-mountaintop: main video missing');
const mtLogLinks = [...mtHome.matchAll(/<a class="card[^"]*" href="(\/work\/project-mountaintop\/[^"]+)"/g)].map((m) => m[1]);
if (mtLogLinks.length < 6) bad.push(`work/project-mountaintop: expected 6 dev-log cards, found ${mtLogLinks.length}`);
for (const l of mtLogLinks) { const h = fs.readFileSync(path.join(pub, l, 'index.html'), 'utf8'); if (!/<article class="log">/.test(h) || !/"@type":"BlogPosting"/.test(h)) bad.push(`${l}: not a dev-log article with BlogPosting JSON-LD`); }
for (const f of walk(mtDir).filter((x) => x.endsWith('.html'))) { const h = fs.readFileSync(f, 'utf8'); if (/linkedin\.com|medium\.com|<iframe/.test(h)) bad.push(`${path.relative(pub, f)}: linkedin/medium link or a pre-loaded iframe (embeds must be click-to-load)`); }
if (!/<a class="card[^"]*" href="\/work\/project-mountaintop\/"/.test(home)) bad.push('index.html: Project Mountaintop card missing from Work');
const games = fs.readFileSync(path.join(pub, 'games/index.html'), 'utf8');
const gOrder = [...games.matchAll(/<a class="card[^"]*" href="\/games\/([^/"]+)\//g)].map((m) => m[1]);
if (gOrder[0] !== 'glass-gunslinger-dod' || gOrder[1] !== 'lvasion-du-criminel-de-sa-prison') bad.push(`games/index.html: featured games should come first (got ${gOrder.slice(0, 2)})`);
if ((games.match(/class="card px w2 gf big"/g) ?? []).length !== 2) bad.push('games/index.html: expected exactly two featured (gf) cards');
const sm = fs.readFileSync(path.join(pub, 'sitemap.xml'), 'utf8');
for (const m of sm.matchAll(/<loc>([^<]+)<\/loc>/g)) { check('sitemap.xml', m[1]); if (/calm|404/.test(m[1])) bad.push(`sitemap.xml: ${m[1]}`); }
if (!/name="robots" content="noindex"/.test(fs.readFileSync(path.join(pub, '404.html'), 'utf8'))) bad.push('404.html: not noindex');
for (const f of ['robots.txt', 'llms.txt', 'rss.xml']) for (const m of fs.readFileSync(path.join(pub, f), 'utf8').matchAll(/https:\/\/halmic\.com(\/[^\s<)"]*)/g)) check(f, m[1]);
if (/calm/.test(fs.readFileSync(path.join(pub, 'llms.txt'), 'utf8'))) bad.push('llms.txt mentions calm');
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`links ok: ${htmls.length} pages`);
