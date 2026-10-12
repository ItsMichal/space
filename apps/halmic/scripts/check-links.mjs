// Checks the built public/ tree: every internal href/src/og:image resolves to a file, no placeholders or draft markers remain,
// sitemap entries exist, the 404 is noindex. Run after `npm run build`. Exits 1 on any problem.
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
  if (/data-dock|calm\.(html|css)/.test(h)) bad.push(`${rel}: prototype leftovers`);
}
const sm = fs.readFileSync(path.join(pub, 'sitemap.xml'), 'utf8');
for (const m of sm.matchAll(/<loc>([^<]+)<\/loc>/g)) { check('sitemap.xml', m[1]); if (/calm|404/.test(m[1])) bad.push(`sitemap.xml: ${m[1]}`); }
if (!/name="robots" content="noindex"/.test(fs.readFileSync(path.join(pub, '404.html'), 'utf8'))) bad.push('404.html: not noindex');
for (const f of ['robots.txt', 'llms.txt', 'rss.xml']) for (const m of fs.readFileSync(path.join(pub, f), 'utf8').matchAll(/https:\/\/halmic\.com(\/[^\s<)"]*)/g)) check(f, m[1]);
if (/calm/.test(fs.readFileSync(path.join(pub, 'llms.txt'), 'utf8'))) bad.push('llms.txt mentions calm');
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`links ok: ${htmls.length} pages`);
