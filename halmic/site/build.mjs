// Tiny static build: src/*.html + ../brand + ../content  ->  public/*.html (no dependencies).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, p), 'utf8');
const parts = JSON.parse(read('../brand/wordmark-parts.json'));
const videos = JSON.parse(read('../content/videos.json'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// inline wordmark, one <g> per letter so the page can animate the dot of the i
function wordmark(dir = 'c') {
  const w = parts[dir];
  const g = w.groups.map((l) => `<g class="ch ch-${l.ch}">${l.ds.map((d, i) => `<path${l.ch === 'i' && i === 1 ? ' class="idot"' : ''} d="${d}"/>`).join('')}</g>`).join('');
  return `<svg class="wordmark" viewBox="0 0 ${w.w} ${w.h}" role="img" aria-label="halmic" focusable="false"><title>halmic</title>${g}</svg>`;
}
const markPaths = [...read('../brand/mark.svg').matchAll(/<path[^>]* d="([^"]+)"/g)].map((m) => `<path d="${m[1]}"/>`).join('');
const mark = `<svg class="mark" viewBox="0 0 349.92 235.02" aria-hidden="true" focusable="false">${markPaths}</svg>`;

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'short' });
// featured video is a curated pick (placeholder choice: the robotics highlight reel, the most-watched original piece in the feed)
const FEATURED = 'Et47QCJ3-3g';
const all = videos.videos.filter((v) => v.title !== 'Halmic Productions Live Stream');
const featured = all.find((v) => v.id === FEATURED) ?? all[0];
const rest = all.filter((v) => v !== featured).slice(0, 8);

const card = (v, cls = '') => `<a class="vid ${cls}" href="${v.url}" data-vid="${v.id}" data-title="${esc(v.title)}">
  <span class="thumb"><img src="${v.thumb}" width="640" height="360" loading="lazy" decoding="async" alt=""><span class="play" aria-hidden="true"><i></i><i></i><i></i></span></span>
  <span class="vt">${esc(v.title)}</span><span class="vm">${fmtDate(v.published)}</span></a>`;

const ld = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Person', '@id': 'https://halmic.com/#halmic', name: 'halmic', alternateName: ['halmicTV', 'Halmic'], url: 'https://halmic.com/',
      description: 'Streams games and code stupid things. Design and creative development.',
      sameAs: ['https://www.twitch.tv/halmictv', 'https://www.youtube.com/@halmic', 'https://x.com/halmicc'] },
    { '@type': 'WebSite', '@id': 'https://halmic.com/#site', url: 'https://halmic.com/', name: 'halmic', publisher: { '@id': 'https://halmic.com/#halmic' } },
    ...[featured, ...rest].map((v) => ({ '@type': 'VideoObject', name: v.title, description: v.excerpt || v.title, thumbnailUrl: `https://halmic.com${v.thumb}`,
      uploadDate: v.published, embedUrl: `https://www.youtube-nocookie.com/embed/${v.id}`, contentUrl: v.url })),
  ],
};

const clips = [
  ['CREEPER, AW MAN', 'Minecraft', '0:40'], ['4k clutch on Bind', 'VALORANT', '0:39'], ['Hbox would be proud', '', '0:19'],
  ['5 kills no win :<', '', '0:59'], ['cross map tomahawk on miami', 'VALORANT', '0:24'], ['run 6 dies after blaze rods...', 'Minecraft', '0:51'],
];
const clipRows = clips.map(([t, g, d]) => `<li><a href="https://www.twitch.tv/halmictv/clips?range=all"><span class="ct">${esc(t)}</span><span class="cg">${esc(g)}</span><span class="cd">${d}</span></a></li>`).join('');

const subs = {
  wordmark: wordmark('c'), mark, jsonld: `<script type="application/ld+json">${JSON.stringify(ld)}</script>`,
  featured: card(featured, 'vid-featured'), reel: rest.map((v) => card(v)).join(''), clips: clipRows,
  year: String(new Date().getFullYear()),
};

fs.mkdirSync(path.join(here, 'public/brand'), { recursive: true });
for (const f of ['mark.svg']) fs.copyFileSync(path.join(here, '../brand/svg/mark-paper.svg'), path.join(here, 'public/brand/mark-paper.svg'));
fs.copyFileSync(path.join(here, '../brand/svg/mark-tile-accent.svg'), path.join(here, 'public/favicon.svg'));
for (const f of fs.readdirSync(path.join(here, 'src')).filter((n) => n.endsWith('.html'))) {
  const html = read(`src/${f}`).replace(/\{\{(\w+)\}\}/g, (_, k) => subs[k] ?? `MISSING:${k}`);
  fs.writeFileSync(path.join(here, 'public', f), html);
}
console.log('built', fs.readdirSync(path.join(here, 'src')).join(', '));
