// Static build for halmic.com, no dependencies: src/*.html templates + content/*.json + brand SVGs -> public/ (pages, sitemap, robots, rss, llms.txt).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { md, inline, frontMatter } from './md.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = 'https://halmic.com';
const read = (p) => fs.readFileSync(path.join(here, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const write = (p, s) => { fs.mkdirSync(path.dirname(path.join(here, 'public', p)), { recursive: true }); fs.writeFileSync(path.join(here, 'public', p), s); };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// css/js are not fingerprinted by name, so every page links them with ?v=<content hash> and _headers can cache them for a year
const V = (f) => `/${f}?v=${crypto.createHash('sha1').update(fs.readFileSync(path.join(here, 'public', f))).digest('hex').slice(0, 8)}`;
const BUILD_DATE = new Date().toISOString().slice(0, 10);

const parts = json('./brand/wordmark-parts.json');
const videos = json('./content/videos.json');
const games = json('./content/games.json').games;
const cur = json('./content/curation.json');

// ---- logos (inline, from the generated geometry) ----
function wordmark(dir = 'c') {
  const w = parts[dir];
  const g = w.groups.map((l) => `<g class="ch ch-${l.ch}">${l.ds.map((d, i) => `<path${l.ch === 'i' && i === 1 ? ' class="idot"' : ''} d="${d}"/>`).join('')}</g>`).join('');
  return `<svg class="wordmark" viewBox="0 0 ${w.w} ${w.h}" role="img" aria-label="halmic" focusable="false"><title>halmic</title>${g}</svg>`;
}
const hbare = read('./brand/svg/hmark-3-bare.svg');
const hv = hbare.match(/viewBox="([^"]+)"/)[1];
const hpaths = [...hbare.matchAll(/<path d="([^"]+)"/g)].map((m) => `<path d="${m[1]}"/>`).join('');
const mark = `<svg class="mark" viewBox="${hv}" aria-hidden="true" focusable="false">${hpaths}</svg>`;

// ---- content ----
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'short' });
const exclude = new Set(json('./content/videos.exclude.json').ids);
const byId = Object.fromEntries(videos.videos.filter((v) => !exclude.has(v.id)).map((v) => [v.id, v]));
const vc = cur.videos;
const episodes = vc.series.episodes.map((id, i) => ({ ...byId[id], ep: i + 1 }));
const latestEp = episodes.at(-1), earlierEps = episodes.slice(0, -1);
const others = vc.other.map((o) => ({ ...byId[o.id], ...o }));
const smash = vc.smash;
const pageVideos = [...episodes.slice().reverse(), ...others];   // everything that gets its own page, feed, sitemap entry and VideoObject
const when = (v) => (v.published ? fmtDate(v.published) : v.ago ?? '');
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const vslug = (v) => `${slugify(v.title)}-${v.id}`;
const order = Object.keys(cur.games);
const gl = games.slice().sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug)).filter((g) => (cur.games[g.slug]?.tier ?? 'more') !== 'off').map((g) => ({ ...g, ...cur.games[g.slug], tier: cur.games[g.slug]?.tier ?? 'more' }));
const gFeature = gl.filter((g) => g.tier === 'feature'), gMore = gl.filter((g) => g.tier === 'more');

const vtitle = (v) => (v.ep ? `Episode ${v.ep}` : v.title.replace(/ - /g, ': ').replace(/\s+/g, ' '));
const ldDesc = (v) => v.desc || v.excerpt || v.title;
const pr = json('./content/phoenix-rising.json');
const mt = json('./content/mountaintop/index.json');
const mtBase = '/work/project-mountaintop/';
const mtDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en', { year: 'numeric', month: 'short', timeZone: 'UTC' });
const mtLogs = mt.logs.map((l) => { const { meta, body } = frontMatter(read(`./content/mountaintop/${l.slug}.md`)); return { ...l, ...meta, body, url: `${mtBase}${l.slug}/` }; }).sort((a, b) => a.order - b.order);
const mtIntro = read('./content/mountaintop/project.md');
const mtImg = (src, alt) => { const d = mt.images[src]; if (!d) throw new Error(`mountaintop: unknown image ${src}`); return { src: `/work/mountaintop/${src}`, width: d.w, height: d.h }; };

// ---- cards: one component for the home page and the inner index pages (a link, or a plain div when there is nothing to link to) ----
const PLAY = '<span class="play" aria-hidden="true"><i></i><i></i><i></i></span>';
const media = (src, alt, { w = 640, h = 360, play = false, cls = '' } = {}) => `<div class="cm${cls ? ` ${cls}` : ''}"><img src="${src}" width="${w}" height="${h}" loading="lazy" decoding="async" alt="${esc(alt)}">${play ? PLAY : ''}</div>`;
const card = ({ href, cls = '', m = '', ey = '', title, text = '', attrs = '', rel = 'noopener', go = false }) => {
  const inner = `${m}<div class="cb"><p class="ey">${esc(ey)}</p><h3 class="ct">${esc(title)}${go ? ' <span class="go" aria-hidden="true">→</span>' : ''}</h3>${text ? `<p class="cx">${esc(text)}</p>` : ''}</div>`;
  if (!href) return `<div class="card ${cls}"${attrs}>${inner}</div>`;
  return `<a class="card ${cls}" href="${href}"${/^https?:/.test(href) ? ` rel="${rel}"` : ''}${attrs}>${inner}</a>`;
};
const gh = (title, id = '', note = '') => `<div class="gh"${id ? ` id="${id}"` : ''}><h2>${esc(title)}</h2>${note ? `<p>${esc(note)}</p>` : ''}</div>`;
const vcard = (v, cls = '', o = {}) => card({ href: `/videos/${vslug(v)}/`, cls, attrs: ` data-vid="${v.id}" data-title="${esc(v.title)}"`, m: media(v.thumb, `Thumbnail for the video ${v.title}`, { play: true }), ey: o.ey ?? ['video', v.length, when(v)].filter(Boolean).join(' · '), title: o.title ?? vtitle(v), text: o.text });
const gcard = (g, cls = '') => card({ href: `/games/${g.slug}/`, cls: `px ${cls}`, m: media(g.coverLocal, g.alt, { w: 640, h: 508 }), ey: ['game', g.madeWith, g.jam].filter(Boolean).join(' · '), title: g.title.replace(/ \(.*\)$/, ''), text: g.line });
const smashCard = (s) => card({ href: `https://www.youtube.com/watch?v=${s.id}`, m: media(`/videos/${s.id}.jpg`, `Thumbnail of the stream overlay for the set ${s.event}, ${s.round}, halmic vs ${s.opp}`, { play: true }), ey: `video · ${s.date}`, title: `${s.event}: ${s.round}`, text: `vs ${s.opp}` });
const gamesGroup = () => [...gFeature.map((g) => gcard(g, 'w2 gf big')), ...gMore.map((g) => gcard(g)), card({ href: 'https://halmic.itch.io/', cls: 'c-paper txt w2 f3', ey: 'itch.io', title: 'Everything on itch.io', text: 'Every jam game and experiment, playable in the browser.', go: true })].join('');
const SEDD_ALT = 'The Southeast Denver Dental logo in the header of their website: an orange and blue four-lobed tooth mark beside the name in blue and orange capitals.';
const pngSize = (f) => { const png = fs.readFileSync(path.join(here, `public/work/${f}`)); return `width="${png.readUInt32BE(16)}" height="${png.readUInt32BE(20)}"`; };
const seddCard = (cls) => card({ href: '/design/southeast-denver-dental/', cls: `c-paper side ${cls}`, m: `<div class="cm shots"><img src="/work/southeast-denver-dental-header.png" ${pngSize('southeast-denver-dental-header.png')} loading="lazy" decoding="async" alt="${SEDD_ALT}"><img src="/work/southeast-denver-dental-footer.png" ${pngSize('southeast-denver-dental-footer.png')} loading="lazy" decoding="async" alt="The same logo in white on the blue footer of their website."></div>`, ey: 'design', title: 'Logo for Southeast Denver Dental', text: 'I designed the logo for a dental practice in Denver, Colorado.' });
const phoenixCard = (cls) => card({ href: '/work/pokemon-phoenix-rising/', cls: `c-3 side ${cls}`, m: media(`/videos/${pr.thumb}.jpg`, pr.alt), ey: 'QA', title: `${pr.role} on ${pr.title}`, text: pr.line });
const mtCard = (cls) => card({ href: mtBase, cls: `c-3 ${cls}`, m: media(`/work/mountaintop/${mt.cover}`, mt.coverAlt, { w: mt.images[mt.cover].w, h: mt.images[mt.cover].h }), ey: 'game dev · Unity · Arduino', title: mt.title, text: `${mt.hook} Video and dev logs.` });
const hiCard = (cls, id = '') => card({ href: 'https://discord.gg/4xvveJ8jS5', cls: `c-blue txt ${cls}`, attrs: id ? ` id="${id}"` : '', ey: 'say hi', title: 'Want something made? Say hi.', text: 'Find me on Discord.', go: true });
const clips = [['CREEPER, AW MAN', 'Minecraft', '0:40'], ['4k clutch on Bind', 'VALORANT', '0:39'], ['Hbox would be proud', '', '0:19'], ['5 kills no win :<', '', '0:59'], ['cross map tomahawk on miami', 'VALORANT', '0:24'], ['run 6 dies after blaze rods...', 'Minecraft', '0:51']];
const CLIPS_URL = 'https://www.twitch.tv/halmictv/clips?range=all';
// the built clip cards are text-only (no thumbnails to show without the API); /api/clips replaces them in the browser
const clipCards = clips.map(([t, g, d], i) => card({ href: CLIPS_URL, cls: `txt${i ? '' : ' w4 h4 big'}`, attrs: ' data-clipcard', ey: ['clip', g, d].filter(Boolean).join(' · '), title: t })).join('');

const homeCards = () => [
  gh('Clips', 'stream'), clipCards, card({ href: CLIPS_URL, cls: 'c-blue txt f3 f2 w34', attrs: ' id="clips-all"', ey: 'twitch', title: 'All clips on Twitch', text: 'No set schedule: follow halmictv and it will tell you when I’m live.', go: true }),
  gh('Videos', 'videos'),
  vcard(latestEp, 'w2 h2 big', { ey: ['latest episode', latestEp.length, when(latestEp)].filter(Boolean).join(' · '), title: `${vc.series.title}: Episode ${latestEp.ep}`, text: vc.series.line }),
  card({ href: `https://www.youtube.com/playlist?list=${vc.series.playlist}`, cls: 'c-paper txt', ey: `series · ${episodes.length} episodes`, title: vc.series.title, text: `All ${episodes.length} episodes on YouTube.`, go: true }),
  ...earlierEps.slice().reverse().map((v) => vcard(v)),
  ...others.map((v) => vcard(v, '', { ey: [v.kind, v.length].filter(Boolean).join(' · ') })),
  card({ href: '/videos/#smash', cls: 'c-3 txt w2 t3', ey: 'video · Smash Ultimate', title: 'Smash sets from SmashDEN', text: smash.line, go: true }),
  card({ href: '/videos/', cls: 'c-blue txt w2 t3', ey: 'youtube', title: 'All the videos', text: 'Every edit, plus the Smash sets.', go: true }),
  gh('Games', 'games', 'Jam entries and experiments, mostly in tiny engines.'), gamesGroup(),
  gh('Work', 'design'), mtCard('w2 h4 t3 big'), seddCard('w2 t3'), phoenixCard('w2 t3'),
  gh('Elsewhere'), hiCard('', 'hi'),
  card({ href: 'https://x.com/halmicc', cls: 'c-3 txt', ey: 'social', title: 'halmic on X', text: '@halmicc', rel: 'me noopener', go: true }),
  card({ href: 'https://halmic.medium.com/', cls: 'c-paper txt', ey: 'writing', title: 'Posts on Medium', text: 'Some posts live on Medium.', rel: 'me noopener', go: true }),
  card({ href: 'https://www.twitch.tv/halmictv', cls: 'c-3 txt t3', ey: 'schedule', title: 'No set schedule', text: 'Follow on Twitch and it will tell you when I’m live.', rel: 'me noopener', go: true }),
].join('');

const SAME_AS = ['https://www.twitch.tv/halmictv', 'https://www.youtube.com/@halmic', 'https://halmic.itch.io/', 'https://halmic.medium.com/', 'https://x.com/halmicc'];
const PERSON = { '@type': 'Person', '@id': `${SITE}/#halmic`, name: 'halmic', alternateName: ['halmicTV', 'Halmic'], url: `${SITE}/`, description: 'halmic productions: an assortment of various somewhat creative work I’ve done.', image: `${SITE}/og/home.png`, sameAs: SAME_AS };
const videoLd = (v) => ({ '@type': 'VideoObject', name: v.title, description: ldDesc(v), thumbnailUrl: `${SITE}${v.thumb}`, uploadDate: v.published ?? undefined, embedUrl: `https://www.youtube-nocookie.com/embed/${v.id}`, contentUrl: v.url, author: { '@id': `${SITE}/#halmic` }, url: `${SITE}/videos/${vslug(v)}/` });
const gameLd = (g) => ({ '@type': 'VideoGame', name: g.title, description: g.line, url: `${SITE}/games/${g.slug}/`, image: `${SITE}${g.coverLocal}`, gamePlatform: 'Web browser', playMode: 'SinglePlayer', applicationCategory: 'Game', genre: g.genre ?? undefined, author: { '@id': `${SITE}/#halmic` }, sameAs: g.url, ...(g.rating ? {} : {}) });
const designLd = { '@type': 'CreativeWork', name: 'Logo for Southeast Denver Dental', creator: { '@id': `${SITE}/#halmic` }, about: 'Logo design', url: `${SITE}/design/southeast-denver-dental/`, mainEntityOfPage: 'https://www.sedenverdental.com/' };
const ldTag = (graph) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`;

// ---- page chrome ----
const navLinks = [['clips', '/#stream'], ['videos', '/#videos'], ['games', '/#games'], ['design', '/#design'], ['say hi', '/#hi']];
const navFor = (section) => `<nav aria-label="Primary">${navLinks.map(([t, h]) => `<a href="${h}"${t === section ? ' aria-current="true"' : ''}>${t}</a>`).join('')}</nav>`;   // on an inner page the link to its own section is marked as current
const NAV = navFor();
const SKIP = '<a class="skip" href="#main">Skip to content</a>';
const FOOT = `<footer class="foot"><div class="wrap"><p>© ${new Date().getFullYear()} halmic</p><p class="links"><a href="https://www.twitch.tv/halmictv" rel="me">Twitch</a><a href="https://www.youtube.com/@halmic" rel="me">YouTube</a><a href="https://halmic.itch.io/" rel="me">itch.io</a><a href="https://halmic.medium.com/" rel="me">Medium</a><a href="https://x.com/halmicc" rel="me">X</a><a href="https://discord.gg/4xvveJ8jS5">Discord</a></p></div></footer>`;
const head = ({ title, desc, path: p, og, ld, css = ['bold.css'], type = 'website', noindex = false }) => `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${SITE}${p}">`}<meta name="theme-color" content="#0f0e13">
<meta property="og:site_name" content="halmic productions"><meta property="og:type" content="${type}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}${p}"><meta property="og:image" content="${SITE}${og}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${SITE}${og}">
<link rel="icon" href="/favicon-16.png" type="image/png" sizes="16x16"><link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32"><link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="alternate" type="application/rss+xml" title="halmic" href="/rss.xml"><link rel="preload" href="/fonts/halmic-display.43848237.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/halmic-text-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${V('base.css')}">${css.map((c) => `<link rel="stylesheet" href="${V(c)}">`).join('')}${ld ? ldTag(ld) : ''}`;
const inner = ({ title, desc, path: p, og, ld, body, type, noindex, section, wide = false }) => `<!doctype html><html lang="en"><head>${head({ title, desc, path: p, og, ld, css: ['bold.css', 'page.css'], type, noindex })}</head><body>
${SKIP}<header class="top"><div class="wrap"><a href="/" aria-label="halmic, home">${mark}</a>${navFor(section)}</div></header>
<main id="main" class="pg wrap${wide ? ' pgw' : ''}">${body}</main>${FOOT}<script src="${V('app.js')}" defer></script></body></html>`;

// ---- home templates ----
const subs = {
  wordmark: wordmark('c'), mark, year: String(new Date().getFullYear()),
  cards: homeCards(),
  head_bold: head({ title: 'halmic productions: streams, videos, games and design', desc: 'halmic productions: an assortment of various somewhat creative work I’ve done. Twitch (halmictv) clips, YouTube videos, tiny itch.io games, logo design and QA work, all in one place.', path: '/', og: '/og/home.png', ld: [PERSON, { '@type': 'WebSite', '@id': `${SITE}/#site`, url: `${SITE}/`, name: 'halmic productions', alternateName: 'halmic', description: 'An assortment of various somewhat creative work I’ve done.', publisher: { '@id': `${SITE}/#halmic` } }, ...pageVideos.map(videoLd), ...gl.map(gameLd), designLd], css: ['bold.css'] }),
  nav: NAV, skip: SKIP, appjs: V('app.js'), foot: FOOT,
  design_shots: ['header', 'footer', 'phone'].map((k) => { const png = fs.readFileSync(path.join(here, `public/work/southeast-denver-dental-${k}.png`)); return `<figure class="shot shot-${k}"><img src="/work/southeast-denver-dental-${k}.png" width="${png.readUInt32BE(16)}" height="${png.readUInt32BE(20)}" loading="lazy" decoding="async" alt="${{ header: 'The Southeast Denver Dental logo in the header of their website: an orange and blue four-lobed tooth mark beside the name in blue and orange capitals.', footer: 'The same logo in white on the blue footer of their website.', phone: 'The logo in the phone header of their website, next to a menu button.' }[k]}"></figure>`; }).join(''),
};
for (const d of ['videos', 'games']) { const dir = path.join(here, 'public', d); if (fs.existsSync(dir)) for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) fs.rmSync(path.join(dir, e.name), { recursive: true, force: true }); }
fs.rmSync(path.join(here, 'public/design'), { recursive: true, force: true });
fs.rmSync(path.join(here, 'public/work/pokemon-phoenix-rising'), { recursive: true, force: true });
fs.rmSync(path.join(here, 'public/work/project-mountaintop'), { recursive: true, force: true });
fs.copyFileSync(path.join(here, './brand/svg/hmark-3-small.svg'), path.join(here, 'public/favicon.svg'));
for (const f of fs.readdirSync(path.join(here, 'src')).filter((n) => n.endsWith('.html'))) {
  write(f, read(`src/${f}`).replace(/\{\{(\w+)\}\}/g, (_, k) => subs[k] ?? `MISSING:${k}`));
}

// ---- inner pages ----
const urls = [{ loc: '/', pri: 1.0 }, { loc: '/games/', pri: 0.8 }, { loc: '/videos/', pri: 0.8 }, { loc: '/design/', pri: 0.7 }, { loc: '/design/southeast-denver-dental/', pri: 0.7 }];
const vplayer = (v, lazy = false) => `<a class="vid vid-featured" href="${v.url}" data-vid="${v.id}" data-title="${esc(v.title)}" aria-label="Play video: ${esc(v.title)}"><span class="thumb"><img src="${v.thumb}" width="640" height="360" ${lazy ? 'loading="lazy" decoding="async"' : 'fetchpriority="high"'} alt="Thumbnail for the video ${esc(v.title)}"><span class="play" aria-hidden="true"><i></i><i></i><i></i></span></span>${lazy ? `<span class="vt">${esc(v.title)}</span>` : ''}<span class="vm">Plays here when you press it. Nothing loads from YouTube before that.</span></a>`;
const mtVideo = (id, lazy = true) => vplayer({ id, title: mt.videos[id], url: `https://www.youtube.com/watch?v=${id}`, thumb: `/videos/${id}.jpg` }, lazy);

for (const g of gl) {
  urls.push({ loc: `/games/${g.slug}/`, pri: g.tier === 'feature' ? 0.8 : 0.7 });
  write(`games/${g.slug}/index.html`, inner({
    title: `${g.title.replace(/ \(.*\)$/, '')}: a tiny ${g.madeWith ?? 'browser'} game by halmic`, desc: `${g.line} Play ${g.title.replace(/ \(.*\)$/, '')} in your browser on itch.io.`, path: `/games/${g.slug}/`, og: `/og/game-${g.slug}.png`, ld: [PERSON, gameLd(g)], section: 'games',
    body: `<p class="crumb"><a href="/#games">games</a></p><h1>${esc(g.title)}</h1><div class="gpage"><img class="gcover" src="${g.coverLocal}" width="640" height="508" fetchpriority="high" alt="${esc(g.alt)}"><div><p class="lede2">${esc(g.line)}</p>${g.description ? `<p>${esc(g.description)}</p>` : ''}<p class="gmeta">${esc([g.status, g.madeWith, g.genre?.replace(/ ,/g, ','), g.jam].filter(Boolean).join(' · '))}</p><p><a class="btn btn-blue" href="${g.url}" rel="noopener">Play on itch.io</a></p></div></div><p class="more"><a href="/#games">More little games</a> · <a href="/#videos">Videos</a> · <a href="https://www.twitch.tv/halmictv">halmic on Twitch</a></p>`,
  }));
}
write('games/index.html', inner({ title: 'Games by halmic: tiny jam games and experiments', desc: 'Tiny games made by halmic in PICO-8, PuzzleScript, Bitsy and GB Studio. Play them in the browser on itch.io.', path: '/games/', og: '/og/home.png', section: 'games', wide: true, ld: [PERSON, ...gl.map(gameLd)], body: `<h1>Little games</h1><p class="lede2">Jam entries and experiments, mostly in tiny engines.</p><div class="grid">${gamesGroup()}</div>` }));
for (const v of pageVideos) {
  urls.push({ loc: `/videos/${vslug(v)}/`, pri: 0.6 });
  write(`videos/${vslug(v)}/index.html`, inner({
    title: `${v.title} | halmic productions`, desc: ((v.desc || (v.excerpt && v.excerpt.length > 40 ? v.excerpt : '')) || `${v.title}. A video from halmic's YouTube channel.`).slice(0, 160), path: `/videos/${vslug(v)}/`, og: `/og/video-${v.id}.png`, type: 'video.other', section: 'videos', ld: [PERSON, videoLd(v)],
    body: `<p class="crumb"><a href="/#videos">videos</a></p><h1>${esc(v.title)}</h1><div class="vfeat">${vplayer(v)}</div><p class="gmeta">${esc([v.ep && `${vc.series.title}, episode ${v.ep}`, v.kind, v.length, when(v)].filter(Boolean).join(' · '))} · <a href="${v.url}" rel="noopener">Watch on YouTube</a> · <a href="https://www.youtube.com/@halmic?sub_confirmation=1" rel="noopener">Subscribe</a></p>${v.desc ? `<p>${esc(v.desc)}</p>` : v.excerpt ? `<p>${esc(v.excerpt)}</p>` : ''}<p class="more"><a href="/#videos">More videos</a> · <a href="/#games">Little games</a></p>`,
  }));
}
const vindex = `<h1>Videos</h1><p class="gmeta">On YouTube as <a href="https://www.youtube.com/@halmic" rel="noopener">@halmic</a> · <a href="https://www.youtube.com/@halmic?sub_confirmation=1" rel="noopener">Subscribe</a></p><div class="grid">${gh(vc.series.title)}${episodes.slice().reverse().map((v) => vcard(v)).join('')}${gh('Other edits')}${others.map((v) => vcard(v, '', { ey: [v.kind, v.length].filter(Boolean).join(' · ') })).join('')}${gh('Smash', 'smash', smash.line)}${smash.sets.map(smashCard).join('')}${card({ cls: 'c-3 txt w2 note', ey: 'credit', title: smash.credit })}</div>`;
write('videos/index.html', inner({ title: 'Videos by halmic: edits, highlights and friends', desc: 'Videos from halmic on YouTube: edits, highlight reels and friends playing games.', path: '/videos/', og: '/og/home.png', section: 'videos', wide: true, ld: [PERSON, ...pageVideos.map(videoLd)], body: vindex }));
write('design/index.html', inner({ title: 'Design by halmic: logos and things I made', desc: 'Things halmic has designed: a logo for Southeast Denver Dental.', path: '/design/', og: '/og/home.png', section: 'design', wide: true, ld: [PERSON, designLd], body: `<h1>Things I’ve designed</h1><div class="grid">${seddCard('w2 t3')}${hiCard('w2 t3')}</div>` }));
write('design/southeast-denver-dental/index.html', inner({
  title: 'Logo for Southeast Denver Dental | halmic productions', desc: 'halmic designed the logo for Southeast Denver Dental, a dental practice in Denver, Colorado. See it in use on their website.', path: '/design/southeast-denver-dental/', og: '/og/design-sedd.png', section: 'design', ld: [PERSON, designLd],
  body: `<p class="crumb"><a href="/#design">design</a></p><h1>Logo for Southeast Denver Dental</h1><p class="lede2">I designed the logo for Southeast Denver Dental, a dental practice in Denver, Colorado.</p><div class="shots">${subs.design_shots}</div><p>Screenshots are of their public website. <a href="https://www.sedenverdental.com/" rel="noopener">Visit sedenverdental.com</a>.</p>`,
}));

urls.push({ loc: '/work/pokemon-phoenix-rising/', pri: 0.6 });
write('work/pokemon-phoenix-rising/index.html', inner({
  title: `${pr.role} on ${pr.title} | halmic productions`, desc: `halmic was a ${pr.role} on ${pr.title}. ${pr.line}`, path: '/work/pokemon-phoenix-rising/', og: '/og/home.png', section: 'design', ld: [PERSON], wide: true,
  body: `<p class="crumb"><a href="/#design">work</a></p><h1>${esc(pr.role)} on ${esc(pr.title)}</h1><p class="lede2">${esc(pr.line)}</p><div class="grid g3">${pr.videos.map((v, i) => card({ href: `https://www.youtube.com/watch?v=${v.id}`, cls: '', attrs: ` data-vid="${v.id}" data-title="${esc(v.title)}"`, m: media(`/videos/${v.id}.jpg`, `Thumbnail for the video ${v.title}`, { play: true }), ey: `video · ${v.length} · ${v.published.slice(0, 4)}`, title: v.title, text: `Video by ${pr.channel.name}` })).join('')}</div><p class="gmeta">Videos by <a href="${pr.channel.url}" rel="noopener">${esc(pr.channel.name)}</a>, the game’s official YouTube channel. Each one loads from YouTube only when you press it.</p><p class="more"><a href="/#design">More work</a> · <a href="/#videos">Videos</a></p>`,
}));

// ---- Project Mountaintop: project page + one page per dev log ----
const mtOpts = { img: mtImg, youtube: (id) => `<div class="vfeat">${mtVideo(id)}</div>` };
const mtVideoLd = { '@type': 'VideoObject', name: mt.videos[mt.video], description: `${mt.title}: ${mt.line}`, thumbnailUrl: `${SITE}/videos/${mt.video}.jpg`, uploadDate: mt.videoPublished, embedUrl: `https://www.youtube-nocookie.com/embed/${mt.video}`, contentUrl: `https://www.youtube.com/watch?v=${mt.video}`, author: { '@id': `${SITE}/#halmic` }, url: `${SITE}${mtBase}` };
const mtWorkLd = { '@type': 'CreativeWork', '@id': `${SITE}${mtBase}#work`, name: mt.title, description: mt.line, url: `${SITE}${mtBase}`, image: `${SITE}/work/mountaintop/${mt.cover}`, creator: { '@id': `${SITE}/#halmic` }, genre: 'Video game', video: { '@type': 'VideoObject', name: mt.videos[mt.video], url: `${SITE}${mtBase}` }, hasPart: mtLogs.map((l) => ({ '@type': 'BlogPosting', headline: l.title, url: `${SITE}${l.url}` })) };
const mtLogLd = (l) => ({ '@type': 'BlogPosting', headline: l.title, description: l.description, datePublished: l.date, dateModified: l.updated ?? l.date, image: `${SITE}/work/mountaintop/${l.hero}`, url: `${SITE}${l.url}`, mainEntityOfPage: `${SITE}${l.url}`, author: { '@id': `${SITE}/#halmic` }, publisher: { '@id': `${SITE}/#halmic` }, isPartOf: { '@id': `${SITE}${mtBase}#work` }, about: { '@id': `${SITE}${mtBase}#work` } });
urls.push({ loc: mtBase, pri: 0.7 }, ...mtLogs.map((l) => ({ loc: l.url, pri: 0.5 })));
const mtLogCard = (l, i) => card({ href: l.url, cls: l.hero === mt.cover ? 'c-3 txt' : '', m: l.hero === mt.cover ? '' : media(`/work/mountaintop/${l.hero}`, l.heroAlt, { w: mt.images[l.hero].w, h: mt.images[l.hero].h }), ey: `dev log ${l.order} · ${mtDate(l.date)}`, title: l.title, text: l.description });
write('work/project-mountaintop/index.html', inner({
  title: `${mt.title}: a hiking-pole rhythm game | halmic productions`, desc: `${mt.title}, a Unity rhythm game played with custom Arduino hiking-pole controllers. Gameplay video and the dev logs, by halmic.`, path: mtBase, og: '/og/work-project-mountaintop.png', section: 'design', ld: [PERSON, mtWorkLd, mtVideoLd], wide: true,
  body: `<p class="crumb"><a href="/#design">work</a></p><h1>${esc(mt.title)}</h1><p class="lede2">${esc(mt.hook)}</p><p class="gmeta">${esc([mt.role, 'Unity', 'Arduino', 'C#'].join(' · '))}</p><div class="mtintro"><div class="log">${md(mtIntro, mtOpts)}</div><div class="vfeat">${mtVideo(mt.video, false)}</div></div>${gh('Dev logs', 'logs', 'Written while it was being built, in 2023.')}<div class="grid g3">${mtLogs.map(mtLogCard).join('')}</div><p class="more"><a href="/#design">More work</a> · <a href="/#games">Little games</a> · <a href="https://www.youtube.com/@halmic" rel="noopener">halmic on YouTube</a></p>`,
}));
for (const l of mtLogs) {
  const i = mtLogs.indexOf(l), prev = mtLogs[i - 1], next = mtLogs[i + 1];
  write(`work/project-mountaintop/${l.slug}/index.html`, inner({
    title: `${l.title} | Project Mountaintop dev log | halmic productions`, desc: l.description.slice(0, 160), path: l.url, og: `/og/mountaintop-${l.slug}.png`, section: 'design', type: 'article', ld: [PERSON, mtWorkLd, mtLogLd(l)],
    body: `<p class="crumb"><a href="${mtBase}">Project Mountaintop</a> · dev log ${l.order}</p><h1>${esc(l.title)}</h1><p class="gmeta">${esc(mtDate(l.date))} · <a href="${mtBase}">All dev logs</a></p><article class="log">${md(l.body, mtOpts)}</article><p class="more">${prev ? `<a href="${prev.url}">← ${esc(prev.title)}</a> · ` : ''}${next ? `<a href="${next.url}">${esc(next.title)} →</a> · ` : ''}<a href="${mtBase}">Project Mountaintop</a></p>`,
  }));
}

// ---- 404 (served by the assets layer for unknown paths: not_found_handling "404-page"; noindex, not in the sitemap) ----
write('404.html', inner({ title: 'Not here | halmic productions', desc: 'This page does not exist.', path: '/404.html', og: '/og/home.png', noindex: true, body: `<h1>Not here.</h1><p class="lede2">Nothing lives at this address.</p><p class="more"><a href="/">Back to halmic</a></p>` }));

// ---- _headers (generated; Cloudflare static-assets headers file; /api/* responses get theirs from worker/index.js) ----
// CSP matches the site as built: no inline script/style (JSON-LD is a data block), fonts and images are self-hosted, the only
// third-party requests are the click-to-load youtube-nocookie and Twitch clip player iframes. connect-src 'self' covers /api/*.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src https://www.youtube-nocookie.com https://clips.twitch.tv; media-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";
const rule = (p, h) => `${p}\n${Object.entries(h).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\n`;
write('_headers', [
  rule('/*', { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Content-Security-Policy': CSP }),
  // fonts are not fingerprinted by name, so a month rather than immutable; HTML gets the assets layer's default (revalidate on every load, etag)
  rule('/fonts/*', { 'Cache-Control': 'public, max-age=2592000' }),
  // css/js are linked with ?v=<hash> (see V() above), so they can be immutable
  rule('/*.css', { 'Cache-Control': 'public, max-age=31536000, immutable' }),
  rule('/*.js', { 'Cache-Control': 'public, max-age=31536000, immutable' }),
  ...['jpg', 'png', 'svg'].map((e) => rule(`/*.${e}`, { 'Cache-Control': 'public, max-age=86400' })),
].join('\n'));

// ---- sitemap, robots, rss, llms ----
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${SITE}${u.loc}</loc><lastmod>${BUILD_DATE}</lastmod><priority>${u.pri}</priority></url>`).join('')}</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
write('rss.xml', `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>halmic productions</title><link>${SITE}/</link><description>Videos, games and other things from halmic.</description><language>en</language>${pageVideos.map((v) => `<item><title>${esc(v.title)}</title><link>${SITE}/videos/${vslug(v)}/</link><guid isPermaLink="true">${SITE}/videos/${vslug(v)}/</guid>${v.published ? `<pubDate>${new Date(v.published).toUTCString()}</pubDate>` : ''}<description>${esc(ldDesc(v))}</description></item>`).join('')}${mtLogs.map((l) => `<item><title>${esc(`Project Mountaintop dev log: ${l.title}`)}</title><link>${SITE}${l.url}</link><guid isPermaLink="true">${SITE}${l.url}</guid><pubDate>${new Date(l.date).toUTCString()}</pubDate><description>${esc(l.description)}</description></item>`).join('')}</channel></rss>\n`);
write('llms.txt', `# halmic productions\n\n> halmic productions (also halmic, halmicTV): an assortment of various somewhat creative work I’ve done. It streams games and codes stupid things on Twitch, makes edited videos on YouTube and tiny games on itch.io, and designs logos and other things. This is its home page.\n\n## Where to find halmic\n- Twitch: https://www.twitch.tv/halmictv\n- YouTube: https://www.youtube.com/@halmic\n- itch.io: https://halmic.itch.io/\n- Medium: https://halmic.medium.com/\n- X: https://x.com/halmicc\n\n## Pages\n- ${SITE}/ : home\n- ${SITE}/games/ : little games\n${gl.map((g) => `- ${SITE}/games/${g.slug}/ : ${g.title}`).join('\n')}\n- ${SITE}/videos/ : videos\n- ${SITE}/design/ : design\n- ${SITE}/design/southeast-denver-dental/ : logo for Southeast Denver Dental\n- ${SITE}/work/pokemon-phoenix-rising/ : QA developer on Pokémon Phoenix Rising, a fan-made game\n- ${SITE}${mtBase} : Project Mountaintop, a Unity rhythm game played with Arduino hiking poles\n${mtLogs.map((l) => `- ${SITE}${l.url} : dev log, ${l.title}`).join('\n')}\n`);
console.log('built', fs.readdirSync(path.join(here, 'src')).join(', '), '+', urls.length, 'urls');
