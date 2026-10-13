#!/usr/bin/env node
// Social preview audit (Open Graph / Twitter cards) for every page in the sitemap.
//   node scripts/check-social.mjs --dir public                 local build: reads sitemap.xml and the HTML/image files from a folder
//   node scripts/check-social.mjs https://halmic.com           live: fetches the sitemap, every page and every card image over HTTP
//   options: --ua=Twitterbot/1.0   user agent for live fetches (default: a normal browser UA)
//            --twitter-site=@halmicc   expected twitter:site (default @halmicc, "" to skip)
//            --quiet   only print failures/warnings
// Exits 1 if anything fails (warnings do not fail). Zero dependencies.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split('=').slice(1).join('=');
const dirArg = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : null;
const base = args.find((a) => /^https?:\/\//.test(a));
const UA = opt('ua', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36');
const TW_SITE = opt('twitter-site', '@halmicc');
const quiet = args.includes('--quiet');
if (!dirArg && !base) { console.error('usage: check-social.mjs --dir <build dir> | <https://base-url>'); process.exit(2); }
const root = dirArg ? path.resolve(dirArg) : null;

const fails = [], warns = [];
const add = (list, page, msg) => list.push(`${page}: ${msg}`);

// ---- fetching ----
async function get(url, { binary = false, head = false } = {}) {
  if (root) {
    const u = new URL(url);
    let f = path.join(root, decodeURIComponent(u.pathname));
    if (u.pathname.endsWith('/')) f = path.join(f, 'index.html');
    if (!fs.existsSync(f) || !fs.statSync(f).isFile()) return { status: 404, headers: {}, buf: Buffer.alloc(0), url };
    const ext = path.extname(f).slice(1).toLowerCase();
    const ct = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', html: 'text/html', xml: 'application/xml', txt: 'text/plain', svg: 'image/svg+xml' }[ext] ?? 'application/octet-stream';
    return { status: 200, headers: { 'content-type': ct }, buf: fs.readFileSync(f), url };
  }
  const res = await fetch(url, { redirect: 'manual', method: head ? 'HEAD' : 'GET', headers: { 'user-agent': UA, accept: binary ? 'image/*,*/*' : 'text/html,*/*' } });
  const headers = Object.fromEntries(res.headers);
  const buf = head ? Buffer.alloc(0) : Buffer.from(await res.arrayBuffer());
  return { status: res.status, headers, buf, url };
}

// ---- parsing ----
const attrs = (tag) => { const o = {}; for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) o[m[1].toLowerCase()] = (m[2] ?? m[3]).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); return o; };
function extract(html) {
  const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? html;
  const m = {};
  for (const t of head.match(/<meta\b[^>]*>/gi) ?? []) { const a = attrs(t); const k = a.property ?? a.name; if (k && a.content !== undefined && !(k in m)) m[k] = a.content; }
  const title = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
  const canon = (head.match(/<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/i) ?? [])[0];
  return { title, canonical: canon ? attrs(canon).href : undefined, m };
}
function dims(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { type: 'image/png', w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) { let i = 2; while (i < b.length) { if (b[i] !== 0xff) { i++; continue; } const mk = b[i + 1]; if (mk >= 0xc0 && mk <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(mk)) return { type: 'image/jpeg', h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }; i += 2 + b.readUInt16BE(i + 2); } return { type: 'image/jpeg' }; }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') { const f = b.toString('ascii', 12, 16); if (f === 'VP8X') return { type: 'image/webp', w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) }; return { type: 'image/webp' }; }
  if (b.toString('ascii', 0, 3) === 'GIF') return { type: 'image/gif', w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
  if (b.toString('utf8', 0, 200).includes('<svg')) return { type: 'image/svg+xml' };
  return { type: 'unknown' };
}

// ---- robots.txt (live): is the image path disallowed for any crawler? ----
async function robotsBlocks(origin) {
  try {
    const r = await get(`${origin}/robots.txt`);
    if (r.status !== 200) return () => false;
    const groups = []; let cur = null;
    for (const line of r.buf.toString().split(/\r?\n/)) {
      const [k, ...v] = line.replace(/#.*/, '').split(':'); const key = k.trim().toLowerCase(), val = v.join(':').trim();
      if (key === 'user-agent') { if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(val.toLowerCase()); }
      else if (cur && (key === 'disallow' || key === 'allow')) cur.rules.push([key, val]);
    }
    return (p, ua = '*') => { const g = groups.find((x) => x.agents.some((a) => a !== '*' && ua.toLowerCase().includes(a))) ?? groups.find((x) => x.agents.includes('*')); if (!g) return false; let best = null; for (const [k, v] of g.rules) if (v && p.startsWith(v) && (!best || v.length >= best[1].length)) best = [k, v]; return best?.[0] === 'disallow'; };
  } catch { return () => false; }
}

// ---- run ----
const sitemapUrl = root ? 'https://local.invalid/sitemap.xml' : `${base.replace(/\/$/, '')}/sitemap.xml`;
const sm = await get(sitemapUrl);
if (sm.status !== 200) { console.error(`sitemap.xml not readable (${sm.status})`); process.exit(1); }
const pages = [...sm.buf.toString().matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
const siteOrigin = new URL(pages[0]).origin;
const blocked = root ? () => false : await robotsBlocks(new URL(base).origin);
const seen = { title: new Map(), desc: new Map(), image: new Map() };
const rows = [];
const imgCache = new Map();

for (const url of pages) {
  const pth = new URL(url).pathname;
  const fetchUrl = root ? url : `${new URL(base).origin}${pth}`;
  const res = await get(fetchUrl);
  const P = pth;
  if (res.status !== 200) { add(fails, P, `page returned ${res.status}${res.headers.location ? ` -> ${res.headers.location}` : ''}`); rows.push([P, 'PAGE ' + res.status]); continue; }
  const { title, canonical, m } = extract(res.buf.toString());
  const f = [], w = [];
  const need = ['og:title', 'og:description', 'og:url', 'og:type', 'og:site_name', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt', 'og:image:type', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt'];
  if (!title) f.push('no <title>');
  if (!m.description) f.push('no meta description');
  if (!canonical) f.push('no canonical');
  for (const k of need) if (!m[k]) f.push(`missing ${k}`);
  if (TW_SITE && m['twitter:site'] !== TW_SITE) f.push(`twitter:site is ${m['twitter:site'] ?? 'missing'}, want ${TW_SITE}`);
  if (title && title.length > 70) w.push(`title ${title.length} chars`);
  if (m.description && (m.description.length < 70 || m.description.length > 160)) (m.description.length < 40 || m.description.length > 200 ? f : w).push(`description ${m.description.length} chars`);
  for (const [k, v] of Object.entries(m)) if (/undefined|\[object|\$\{|NaN|null/.test(v) && k.match(/^(og|twitter|description)/)) f.push(`${k} has template leftover: ${v.slice(0, 40)}`);
  if (canonical && canonical !== url) f.push(`canonical ${canonical} != sitemap url ${url}`);
  if (m['og:url'] && canonical && m['og:url'] !== canonical) f.push(`og:url ${m['og:url']} != canonical`);
  if (m['og:title'] && title && m['og:title'] !== title) w.push('og:title differs from <title>');
  if (m['twitter:title'] && m['og:title'] && m['twitter:title'] !== m['og:title']) w.push('twitter:title differs from og:title');
  if (m['twitter:card'] && m['twitter:card'] !== 'summary_large_image') w.push(`twitter:card ${m['twitter:card']}`);
  if (m['og:type'] === 'article' && !m['article:published_time']) w.push('article without article:published_time');
  if (title) seen.title.set(title, [...(seen.title.get(title) ?? []), P]);
  if (m.description) seen.desc.set(m.description, [...(seen.desc.get(m.description) ?? []), P]);

  let imgInfo = '-';
  for (const key of ['og:image', 'twitter:image']) {
    const iu = m[key]; if (!iu) continue;
    if (!/^https:\/\//.test(iu)) { f.push(`${key} not absolute https: ${iu}`); continue; }
    const iurl = new URL(iu);
    if (iurl.origin !== siteOrigin) f.push(`${key} host ${iurl.origin} != ${siteOrigin}`);
    if (key === 'twitter:image' && iu !== m['og:image']) w.push('twitter:image differs from og:image');
    if (blocked(iurl.pathname) || blocked(iurl.pathname, 'Twitterbot') || blocked(iurl.pathname, 'facebookexternalhit')) f.push(`${key} blocked by robots.txt`);
    if (key === 'twitter:image' && iu === m['og:image']) continue;
    let info = imgCache.get(iu);
    if (!info) {
      const r = await get(root ? iu : `${new URL(base).origin}${iurl.pathname}${iurl.search}`, { binary: true });
      const d = r.buf.length ? dims(r.buf) : {};
      info = { r, d, size: r.buf.length };
      imgCache.set(iu, info);
    }
    const { r, d, size } = info;
    if (r.status !== 200) { f.push(`${key} returns ${r.status}${r.headers.location ? ` -> ${r.headers.location}` : ''}`); continue; }
    const ct = (r.headers['content-type'] ?? '').split(';')[0];
    if (!/^image\/(png|jpeg)$/.test(ct)) f.push(`${key} content-type ${ct}`);
    if (d.type && ct && d.type !== ct && d.type !== 'unknown') f.push(`${key} content-type ${ct} but file is ${d.type}`);
    if (!/^image\/(png|jpeg)$/.test(d.type)) f.push(`${key} file is ${d.type} (use PNG or JPEG)`);
    if (m['og:image:type'] && m['og:image:type'] !== d.type) f.push(`og:image:type ${m['og:image:type']} != real ${d.type}`);
    if (d.w) {
      if (+m['og:image:width'] !== d.w || +m['og:image:height'] !== d.h) f.push(`declared ${m['og:image:width']}x${m['og:image:height']} != real ${d.w}x${d.h}`);
      if (m['twitter:card'] === 'summary_large_image' && (d.w < 1200 || d.h < 600 || d.h > 675 || d.w / d.h < 1.9)) f.push(`${d.w}x${d.h} is not a 1200x600..675 large card`);
      imgInfo = `${d.w}x${d.h} ${d.type.slice(6)} ${(size / 1024).toFixed(0)}K`;
    }
    if (size > 5 * 1024 * 1024) f.push(`${key} ${(size / 1048576).toFixed(1)} MB (> 5 MB breaks some platforms)`);
    else if (size > 1024 * 1024) w.push(`${key} ${(size / 1048576).toFixed(1)} MB (> 1 MB)`);
    if (!root && !iu.includes('?') ) { const cc = r.headers['cache-control']; if (!cc) w.push('image has no cache-control'); if (/x-robots-tag/i.test(Object.keys(r.headers).join())) w.push('image has X-Robots-Tag'); if (r.headers['cross-origin-resource-policy'] === 'same-origin') f.push('image CORP same-origin'); if (/cf-mitigated|challenge/i.test(JSON.stringify(r.headers))) f.push('image served a Cloudflare challenge'); }
    seen.image.set(iu, [...(seen.image.get(iu) ?? []), P]);
  }
  if (!root && /cf-mitigated|Just a moment|challenge-platform/i.test(res.headers['cf-mitigated'] ?? '' + res.buf.toString().slice(0, 2000))) f.push('page served a Cloudflare challenge');
  f.forEach((x) => add(fails, P, x)); w.forEach((x) => add(warns, P, x));
  rows.push([P, imgInfo, (m['og:type'] ?? '-'), m['twitter:card'] ?? '-', (title ?? '').slice(0, 44), f.length ? `FAIL(${f.length})` : w.length ? `warn(${w.length})` : 'ok']);
}
for (const [what, map] of [['title', seen.title], ['description', seen.desc]]) for (const [v, ps] of map) if (ps.length > 1) add(fails, ps.join(', '), `duplicate ${what}: ${v.slice(0, 50)}`);
for (const [v, ps] of seen.image) if (ps.length > 1) add(warns, ps.slice(0, 4).join(', ') + (ps.length > 4 ? ` +${ps.length - 4}` : ''), `share the image ${v.replace(siteOrigin, '')}`);

if (!quiet) {
  const head = ['path', 'image', 'og:type', 'twitter:card', 'title', 'status'];
  const wd = head.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length)));
  const line = (r) => r.map((c, i) => String(c ?? '').padEnd(wd[i])).join('  ');
  console.log(line(head)); console.log(wd.map((n) => '-'.repeat(n)).join('  ')); for (const r of rows) console.log(line(r));
}
if (warns.length) console.log(`\nwarnings (${warns.length}):\n  ` + warns.join('\n  '));
if (fails.length) console.log(`\nFAILURES (${fails.length}):\n  ` + fails.join('\n  '));
console.log(`\n${pages.length} pages, ${imgCache.size} distinct images, ${fails.length} failures, ${warns.length} warnings (${root ? 'local ' + dirArg : 'live ' + base}, UA ${root ? '-' : UA.slice(0, 24)})`);
process.exit(fails.length ? 1 : 0);
