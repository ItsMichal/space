// Static build for halmic.com, no dependencies: src/*.html templates + content/*.json + brand SVGs -> public/ (pages, sitemap, robots, rss, llms.txt).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { md, inline, frontMatter } from './md.mjs';
import { FOR_HALMIC as SIB, markSvg } from '@space/crosslinks';
import { readSiblingPosts } from '@space/crosslinks/node';
import { homeStats, fmt } from './stats.mjs';
import { model, derive, SIZES, SIZE_CLS } from './bentos.mjs';
import { parseLayout, resolve, arrange } from './layout.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = 'https://halmic.com';
const read = (p) => fs.readFileSync(path.join(here, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const write = (p, s) => { fs.mkdirSync(path.dirname(path.join(here, 'public', p)), { recursive: true }); fs.writeFileSync(path.join(here, 'public', p), s); };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// css/js are not fingerprinted by name, so every page links them with ?v=<content hash> and _headers can cache them for a year
const V = (f) => `/${f}?v=${crypto.createHash('sha1').update(fs.readFileSync(path.join(here, 'public', f))).digest('hex').slice(0, 8)}`;
const BUILD_DATE = new Date().toISOString().slice(0, 10);

// ---- icons: Phosphor (Fill, MIT) + Simple Icons brand marks (CC0), copied into brand/icons/ and built into one same-origin sprite ----
const ICONS = {};
for (const [d, pre] of [['phosphor', ''], ['brands', 'b-']]) for (const f of fs.readdirSync(path.join(here, 'brand/icons', d)).filter((n) => n.endsWith('.svg'))) {
  const svg = read(`./brand/icons/${d}/${f}`);
  ICONS[pre + f.slice(0, -4)] = { vb: svg.match(/viewBox="([^"]+)"/)[1], inner: svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[^<]*<\/title>/, '') };
}
write('icons.svg', `<svg xmlns="http://www.w3.org/2000/svg">${Object.entries(ICONS).map(([n, i]) => `<symbol id="${n}" viewBox="${i.vb}">${i.inner}</symbol>`).join('')}</svg>\n`);
const ICON_URL = V('icons.svg');
const icon = (name, cls = '') => { if (!ICONS[name]) throw new Error(`unknown icon: ${name}`); return `<svg class="ic${cls ? ` ${cls}` : ''}" aria-hidden="true" focusable="false"><use href="${ICON_URL}#${name}"/></svg>`; };

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
// ---- the one link to the sibling site (packages/crosslinks): logo switcher in the header, the same row in the footer for
// touch screens, and one link on each paired page. Nothing else on the site names it; scripts/check-identity.mjs enforces that. ----
const sibPosts = readSiblingPosts(path.resolve(here, '../..'));
const xrow = (cls) => `<a class="${cls}" href="${SIB.origin}" rel="me">${markSvg(SIB.mark, 'xs-mark')}<span>${SIB.domain}</span>${icon('arrow-up-right', 'xs-go')}</a>`;
const xpair = (p) => { const l = SIB.pairLink(p, sibPosts); return l ? `<p class="xl"><a href="${l.href}" rel="me">${markSvg(SIB.mark, 'xs-mark')}<span>${l.domain}</span>${l.title ? ` · ${esc(l.title)}` : ''}${icon('arrow-up-right', 'xs-go')}</a></p>` : ''; };
const mark = `<svg class="mark" viewBox="${hv}" aria-hidden="true" focusable="false">${hpaths}</svg>`;

// ---- content ----
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en', { year: 'numeric', month: 'short' });
const content = { videos, exclude: json('./content/videos.exclude.json'), curation: cur, games: json('./content/games.json'), posts: json('./content/posts.json') };
const { vc, episodes, others, films, edits, gl, posts } = derive(content);   // films are the headline of Watch: first on the home page, in /videos/, in the sitemap
const smash = vc.smash;
const pageVideos = [...films, ...episodes.slice().reverse(), ...others.filter((o) => !films.includes(o))];   // everything that gets its own page, feed, sitemap entry and VideoObject
const when = (v) => (v.published ? fmtDate(v.published) : v.ago ?? '');
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const vslug = (v) => `${slugify(v.title)}-${v.id}`;

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
const PLAY = `<span class="play" aria-hidden="true">${icon('play')}</span>`;
const chip = (text, ic) => (text ? `<span class="chip">${ic ? icon(ic) : ''}<span>${esc(text)}</span></span>` : '');
const media = (src, alt, { w = 640, h = 360, play = false, cls = '', chip: c = '' } = {}) => `<div class="cm${cls ? ` ${cls}` : ''}"><img src="${src}" width="${w}" height="${h}" loading="lazy" decoding="async" alt="${esc(alt)}">${play ? PLAY : ''}${c}</div>`;
const GO = `<span class="goi" aria-hidden="true">${icon('arrow-up-right')}${icon('arrow-up-right', 'dup')}</span>`;   // two arrows: the hover loop slides the second one in
// ei: the small icon in the eyebrow of a media card; tile: the larger icon tile that text-only cards carry instead; go: the corner arrow on link-out cards
const card = ({ href, cls = '', m = '', ei = '', ey = '', title, text = '', attrs = '', rel = 'noopener', go = false, tile = '' }) => {
  const inner = `${m}${go ? GO : ''}<div class="cb">${tile ? `<span class="tico">${icon(tile)}</span>` : ''}<div class="bt"><p class="ey">${!tile && ei ? icon(ei) : ''}<span>${esc(ey.charAt(0).toUpperCase() + ey.slice(1))}</span></p><h3 class="ct">${esc(title)}</h3>${text ? `<p class="cx">${esc(text)}</p>` : ''}</div></div>`;
  if (!href) return `<div class="card ${cls}"${attrs}>${inner}</div>`;
  return `<a class="card ${cls}" href="${href}"${/^https?:/.test(href) ? ` rel="${rel}"` : ''}${attrs}>${inner}</a>`;
};
const gh = (title, id = '', note = '', ic = '', alias = '') => `<div class="gh"${id ? ` id="${id}"` : ''}>${alias ? `<span class="anc" id="${alias}"></span>` : ''}<h2>${ic ? icon(ic) : ''}${esc(title)}</h2>${note ? `<p>${esc(note)}</p>` : ''}</div>`;
const kindIcon = (k) => ({ 'short film': 'film-slate', 'highlight reel': 'star' })[k] ?? 'video-camera';
const vcard = (v, cls = '', o = {}) => card({ href: `/videos/${vslug(v)}/`, cls, attrs: ` data-vid="${v.id}" data-title="${esc(v.title)}"`, m: media(v.thumb, `Thumbnail for the video ${v.title}`, { play: true, chip: chip(v.length, 'clock') }), ei: o.ei ?? 'video-camera', ey: o.ey ?? ['video', when(v)].filter(Boolean).join(' · '), title: o.title ?? vtitle(v), text: o.text });
const gcard = (g, cls = '') => card({ href: `/games/${g.slug}/`, cls: `px ${cls}`, m: media(g.coverLocal, g.alt, { w: 640, h: 508, chip: chip(g.madeWith, 'cpu') }), ei: 'game-controller', ey: ['game', g.jam].filter(Boolean).join(' · '), title: g.title.replace(/ \(.*\)$/, ''), text: g.line });
const smashCard = (s) => card({ href: `https://www.youtube.com/watch?v=${s.id}`, m: media(`/videos/${s.id}.jpg`, `Thumbnail of the stream overlay for the set ${s.event}, ${s.round}, halmic vs ${s.opp}`, { play: true }), ei: 'video-camera', ey: `video · ${s.date}`, title: `${s.event}: ${s.round}`, text: `vs ${s.opp}` });
const SEDD_LABEL = 'The Southeast Denver Dental logo in use at the practice';
const seddVideo = (attrs = '') => `<video class="inuse" muted loop playsinline preload="none" poster="/work/southeast-denver-dental-inuse-poster.jpg" width="960" height="540" data-loop${attrs}><source src="/work/southeast-denver-dental-inuse.webm" type="video/webm"><source src="/work/southeast-denver-dental-inuse.mp4" type="video/mp4"></video>`;
const pngSize = (f) => { const png = fs.readFileSync(path.join(here, `public/work/${f}`)); return `width="${png.readUInt32BE(16)}" height="${png.readUInt32BE(20)}"`; };

// ---- bento tiles: the home page and the inner index pages. Every tile is one idea: a picture, a big word or number, or a brand mark, with a short title.
// Platform differences are icons and colour, not words: a round badge (Twitch purple, YouTube red) on watchable media, solid colour on link-out tiles.
const PLATFORM = { tw: ['b-twitch', 'Twitch'], yt: ['b-youtube', 'YouTube'] };
const badge = (p) => `<span class="bdg bdg-${p}" role="img" aria-label="${PLATFORM[p][1]}" title="${PLATFORM[p][1]}">${icon(PLATFORM[p][0])}</span>`;
const kbadge = (ic, label) => `<span class="bdg bdg-k" role="img" aria-label="${esc(label)}" title="${esc(label)}">${icon(ic)}</span>`;
const tchip = (text, ic) => (text ? `<span class="chip">${icon(ic)}<span>${esc(text)}</span></span>` : '');
const disc = `<span class="play" aria-hidden="true">${icon('play')}</span>`;
const tcap = ({ title, cap = '', art = '', sr = '' }) => `<span class="tcap">${art}<span class="tx"><h3 class="tt">${esc(title)}</h3>${cap ? `<p class="ts">${esc(cap)}</p>` : ''}${sr ? `<span class="sr">${esc(sr)}</span>` : ''}</span></span>`;
const timg = (src, cls = '') => `<img${cls ? ` class="${cls}"` : ''} src="${src}" width="640" height="360" loading="lazy" decoding="async" alt="">`;
const tile = ({ href, cls = '', attrs = '', rel = '', inner }) => `<a class="tile ${cls}" href="${href}"${/^https?:/.test(href) ? ` rel="${rel || 'noopener'}"` : ''}${attrs}>${inner}</a>`;
const WIDE = 'w2';
// a YouTube video on this site: plays in place, opens its own page without JS
const hasHd = (v) => fs.existsSync(path.join(here, 'public', 'videos', `${v.id}-hd.jpg`));
const vtile = (v, cls = '', o = {}) => {
  const hd = o.hd && hasHd(v), big = cls.includes('w2');
  return tile({ href: `/videos/${vslug(v)}/`, cls: `tm ${cls}`, attrs: ` data-vid="${v.id}" data-title="${esc(v.title)}" data-vt="m t"${o.attrs ?? ''}`, inner: `<span class="tbg${hd && v.thumbFit ? ` fit-${v.thumbFit}` : ''}">${hd ? `<img src="/videos/${v.id}-hd.jpg" width="960" height="540" loading="lazy" decoding="async" alt="">` : timg(v.thumb, 'yt-img')}</span>${badge('yt')}${tchip(v.length, big ? 'clock' : 'play')}${big ? disc : ''}${tcap({ title: o.title ?? v.name ?? vtitle(v), cap: o.cap ?? o.kind })}` });
};
// FIFA episode tiles carry the series name; the short films carry their clean name with the kind as the caption
const epTile = (v, cls = '', attrs = '') => vtile(v, cls, { title: vc.series.title, cap: `Episode ${v.ep}`, attrs });
const filmTile = (v, cls = 'lead w2', attrs = '') => vtile(v, cls, { hd: true, kind: v.kind[0].toUpperCase() + v.kind.slice(1), attrs });
// a Twitch clip before /api/clips has answered: no picture, the scissors stand in. The browser swaps these for the real clips.
const CLIPS_URL = 'https://www.twitch.tv/halmictv/clips?range=all';
const clipFallback = (t, g, i) => tile({ href: CLIPS_URL, cls: `tm tm-nopic${i === 0 ? ' w2' : ''}`, attrs: ' data-clipcard', inner: `<span class="tbg">${icon('scissors', 'ghost')}</span>${badge('tw')}${tcap({ title: t, sr: g ? `Game: ${g}` : '' })}` });
const gtile = (g, cls = '') => tile({ href: `/games/${g.slug}/`, cls: `tm tg ${cls}`, attrs: ' data-vt="m t"', inner: `<span class="tbg"><img src="${g.coverLocal}" width="640" height="508" loading="lazy" decoding="async" alt=""></span>${tchip(g.madeWith, 'cpu')}${tcap({ title: g.title.replace(/ \(.*\)$/, ''), cap: cls.includes('lead') ? g.line.split(/(?<=\.) /)[0] : '' })}` });
const seddTile = (cls = '') => tile({ href: '/design/southeast-denver-dental/', cls: `tm ${cls}`, attrs: ' data-vt="m t"', inner: `<span class="tbg">${seddVideo(' aria-hidden="true"')}</span>${kbadge('pen-nib', 'Logo design')}${tcap({ title: 'Southeast Denver Dental', cap: 'Logo design' })}` });
const mtTile = (cls = '') => tile({ href: mtBase, cls: `tm ${cls}`, attrs: ' data-vt="t"', inner: `<span class="tbg"><img src="/work/mountaintop/${mt.cover}" width="${mt.images[mt.cover].w}" height="${mt.images[mt.cover].h}" loading="lazy" decoding="async" alt=""></span>${tchip('Unity', 'cpu')}${tcap({ title: mt.title, cap: mt.hook })}` });
// stat tile: a big word or number in the display face and one caption line. Numbers come from the content files, never typed in.
// data-len (characters shown) sizes it to the tile's width; data-g (first glyph) lets the CSS pull the numeral's ink onto the caption's left edge
const numEl = (num, { unit = '', word = false } = {}) => { const t = String(num); return `<span class="num${word ? ' word' : ''}" data-len="${Math.min(t.length, 6)}" data-g="${esc(t[0])}"><span class="nv">${esc(t)}</span>${unit ? `<small>${esc(unit)}</small>` : ''}</span>`; };
const stat = ({ href, cls = '', attrs = '', num, unit = '', word = false, title, cap = '', tone = '', img = '', ic = '', go = true, rel = '' }) => tile({ href, rel, cls: `t-stat ${tone} ${cls}`, attrs, inner: `${img ? `<span class="tbg">${img}</span>` : ''}${ic ? `<span class="lg lg-s">${icon(ic)}</span>` : ''}${go ? GO : ''}${numEl(num, { unit, word })}${tcap({ title, cap })}` });
// year tile: the year in the display face and one line on what happened that year in this work. Years are read from the content's own dates, never typed in.
const yr = (iso) => +String(iso).slice(0, 4);
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
const yearTile = ({ year, title, cap = '', tone = 'tink', cls = '', attrs = '' }) => `<div class="tile t-stat t-year ${tone} ${cls}"${attrs}>${numEl(year)}${tcap({ title, cap })}</div>`;
const phoenixTile = (cls = '') => stat({ href: '/work/pokemon-phoenix-rising/', cls, attrs: ' data-vt="t"', num: 'QA', word: true, tone: 'tdim', img: timg(`/videos/${pr.thumb}.jpg`, 'yt-img'), title: pr.title, cap: pr.role, go: false });
// one of the game's official videos (the game's own channel): plays in place like every other video tile
const prVideoTile = (v, cls = '') => tile({ href: `https://www.youtube.com/watch?v=${v.id}`, cls: `tm ${cls}`, attrs: ` data-vid="${v.id}" data-title="${esc(v.title)}"`, inner: `<span class="tbg">${timg(`/videos/${v.id}.jpg`, 'yt-img')}</span>${badge('yt')}${tchip(v.length, 'play')}${tcap({ title: v.title.replace(/^Phoenix Rising - /, ''), cap: String(v.published.slice(0, 4)) })}` });
const prRedditTile = (cls = '', attrs = '') => ltile({ href: pr.reddit.url, kind: 'rd', glyph: 'b-reddit', title: pr.reddit.title, cap: 'The game’s community', cls, attrs, rel: 'me noopener' });
const prChannelTile = (cls = '') => ltile({ href: pr.channel.url, kind: 'yt', glyph: 'b-youtube', title: 'The game on YouTube', cap: 'Its official channel', cls, rel: 'noopener' });
// link-out tile: the brand mark large on the brand colour, a short label, the corner arrow (the whole tile is the link)
const ltile = ({ href, kind, glyph, title, cap = '', cls = '', attrs = '', rel = '', inner = '' }) => tile({ href, rel, cls: `t-link tl-${kind} ${cls}`, attrs, inner: `<span class="lg" data-ic="${glyph}">${icon(glyph)}</span>${GO}${inner || tcap({ title, cap })}` });
const twitchTile = (cls = '') => ltile({ href: 'https://www.twitch.tv/halmictv', kind: 'tw', glyph: 'b-twitch', cls: `${cls}`, rel: 'me noopener', attrs: ' id="twitch" data-flex', inner: `<span class="tcap"><span class="tx"><h3 class="tt"><span class="toff">Watch live on Twitch</span><span class="ton"><i class="ldot" aria-hidden="true"></i>Live now</span></h3><p class="ts"><span class="toff">No set schedule</span><span class="ton" data-live-game>halmictv</span></p></span></span>` });
const ytTile = (cls = '', title = 'All videos on YouTube', href = 'https://www.youtube.com/@halmic', attrs = '') => ltile({ href, kind: 'yt', glyph: 'b-youtube', title, cls, attrs, rel: 'me noopener' });
const itchTile = (cls = '', attrs = '') => ltile({ href: 'https://halmic.itch.io/', kind: 'itch', glyph: 'b-itchdotio', title: 'Play the games on itch.io', cls, attrs, rel: 'me noopener' });
const hiTile = (cls = '') => ltile({ href: 'https://x.com/halmicc', kind: 'x', glyph: 'b-x', title: 'Say hi on X', cap: 'Want something made?', cls, attrs: ' id="hi"', rel: 'me noopener' });
const mediumTile = (cls = '') => ltile({ href: 'https://halmic.medium.com/', kind: 'md', glyph: 'b-medium', title: 'Posts on Medium', cls, attrs: ' data-flex', rel: 'me noopener' });
// A bento is a stack of clusters; a cluster is one project (or one kind of thing) and is its own packed grid, so another project's tile can never land between its tiles.
// Each tile has a size in grid cells at 4 / 3 / 2 columns; the one tile marked data-flex gets the width that fills the cluster's last row (the fx classes give it that width
// before app.js runs, app.js recomputes it when the cells change: a clip arrives, a tile plays).
const S = homeStats();
const cap1 = (t) => t[0].toUpperCase() + t.slice(1);
const cluster = ({ name, items, flex }) => {
  const fx = [4, 3, 2].map((k, i) => { const c = items.reduce((n, [z]) => n + SIZES[z][i], 0); return `fx${k}-${k - (c % k)}`; }).join(' ');
  return `<div class="cl" role="group" aria-label="${esc(name)}">${items.map(([, h]) => h).join('')}${flex ? flex(fx) : ''}</div>`;
};
// a bento: a section label (small, quiet) and its clusters
const bento = ({ id = '', alias = [], title = '', more = '', cls = '', clusters }) => `<div class="bsec"${id ? ` id="${id}"` : ''}>${alias.map((a) => `<span class="anc" id="${a}"></span>`).join('')}${title ? `<div class="sh"><h2>${esc(title)}</h2>${more}</div>` : ''}<div class="bq"><div class="bento ${cls}">${clusters.join('')}</div></div></div>`;
const more = (href, text) => `<a class="sl" href="${href}">${esc(text)}${icon('arrow-right', 'ic-end')}</a>`;

// X highlights (content/posts.json, empty until there are showcases worth showing): static tiles, no widget or script, the media is a local copy. The whole tile links to the post.
const trimPost = (t) => { const x = t.replace(/https?:\/\/\S+/g, '').replace(/(^|\s)#\w+/g, '').replace(/\s+/g, ' ').trim(); return x.length > 110 ? `${x.slice(0, 107).replace(/\s+\S*$/, '')}…` : x; };
const KINDS = { web: ['lightning', 'Web'], game: ['game-controller', 'Game'], hardware: ['cpu', 'Robotics'], design: ['pen-nib', 'Design'], video: ['film-strip', 'Video'], music: ['star', 'Music'] };
const postTile = (p, cls = '') => tile({ href: p.url, cls: `tm t-post${p.media ? '' : ' tp-text'} ${cls}`, rel: 'noopener', inner: `${p.media ? `<span class="tbg"><img src="/posts/${p.media}" width="${p.w}" height="${p.h}" loading="lazy" decoding="async" alt="${esc(p.alt)}"></span>` : ''}${kbadge('b-x', 'Post on X')}${tchip(fmtDate(p.date), KINDS[p.kind]?.[0] ?? 'calendar-blank')}${p.video ? `<span class="play" aria-hidden="true">${icon('play')}</span>` : ''}${tcap({ title: trimPost(p.text), sr: `${KINDS[p.kind]?.[1] ?? 'Post'}${p.text.length > 110 ? `: ${p.text}` : ''}` })}` });
const clips = [['CREEPER, AW MAN', 'Minecraft'], ['4k clutch on Bind', 'VALORANT'], ['Hbox would be proud', ''], ['5 kills no win :<', ''], ['cross map tomahawk on miami', 'VALORANT'], ['run 6 dies after blaze rods...', 'Minecraft']];

// ---- clusters: one project each, years from the content's own dates. Which tiles, in what order and at what size comes from bentos.mjs (the default)
// and content/layout.json (what the editor changed); here each tile id gets its markup. ----
// Watch. Special Force (the lead film, the year it came out, the sequel), FIFA With the Boys (its year, the four episodes, the playlist), the other edits with the channel link, then the Twitch clips with the Twitch tile.
const filmGroup = films[0].group;
const epYears = episodes.map((e) => yr(e.published));
// Play. Project Mountaintop (a rhythm game you play with hiking poles): the lead, its year, the dev logs. Then the tiny jam games and itch.io.
const mtYear = Math.min(...mtLogs.map((l) => yr(l.date)), yr(mt.videoPublished));
// Work. Pokémon Phoenix Rising (the lead, the game's channel, the subreddit; no dates are known, so no year tile), then the dental logo with the practice's site. Only verified facts become tiles (see content/phoenix-rising.json).
const TILES = {
  ...Object.fromEntries(films.map((v) => [`film:${v.id}`, (cls) => filmTile(v, cls)])),
  'fifa:year': (cls) => yearTile({ year: Math.min(...epYears), title: `First episode of ${vc.series.title}`, cap: Math.max(...epYears) > Math.min(...epYears) ? `Latest in ${Math.max(...epYears)}` : '', tone: 'tblue', cls }),
  ...Object.fromEntries(episodes.map((v) => [`ep:${v.id}`, (cls) => epTile(v, cls)])),
  'fifa:minutes': (cls) => stat({ href: `https://www.youtube.com/playlist?list=${vc.series.playlist}`, num: S.fifaMinutes, unit: 'min', title: 'of bad shots', cap: `${cap1(WORDS[episodes.length])} episodes of ${vc.series.title}`, tone: 'tpaper', cls, attrs: ' data-stat="fifa-minutes"' }),
  ...Object.fromEntries(edits.map((v) => [`video:${v.id}`, (cls) => vtile(v, cls)])),
  // a clip is inserted before the Twitch tile (app.js); the built stand-ins are what shows until /api/clips answers
  ...Object.fromEntries(clips.map(([title, game], i) => [`clip:${i}`, () => clipFallback(title, game, i)])),
  'mt:lead': (cls) => mtTile(cls),
  'mt:year': (cls) => yearTile({ year: mtYear, title: `${mt.title}, capstone and expo demo`, tone: 'tpaper', cls }),
  ...Object.fromEntries(gl.map((g) => [`game:${g.slug}`, (cls) => gtile(g, cls)])),
  'games:engines': (cls) => stat({ href: '/games/', num: S.engines.length, unit: S.engines.length === 1 ? 'engine' : 'engines', title: S.engines.length === S.gameCount ? 'One for every game' : `Across ${WORDS[S.gameCount]} games`, cap: S.engines.join(', '), tone: 'tpaper', cls, attrs: ' data-vt="t" data-stat="engines"' }),
  'pr:lead': (cls) => phoenixTile(cls),
  'pr:channel': (cls) => prChannelTile(cls),
  sedd: (cls) => seddTile(cls),
  ...Object.fromEntries(posts.map((p) => [`post:${p.id}`, (cls) => postTile(p, cls)])),
  hi: (cls) => hiTile(cls),
};
const FLEX = {
  'films:year': (fx) => yearTile({ year: Math.min(...films.map((f) => yr(f.published))), title: `${filmGroup}, ${WORDS[films.length]} short films`, cap: `${S.filmMinutes} minutes in all`, tone: 'tink', cls: fx, attrs: ' data-flex data-stat="film-minutes"' }),
  'edits:youtube': (fx) => ytTile(fx, 'All videos on YouTube', 'https://www.youtube.com/@halmic', ' data-flex'),
  twitch: (fx) => twitchTile(fx),
  'mt:logs': (fx) => stat({ href: `${mtBase}#logs`, num: fmt(S.logWords), unit: 'words', title: `across ${WORDS[S.logCount]} dev logs`, cap: 'Written while it was being built', tone: 'tblue', cls: fx, attrs: ' data-flex data-stat="log-words"' }),
  itch: (fx) => itchTile(fx, ' data-flex'),
  'pr:reddit': (fx) => prRedditTile(fx, ' data-flex'),
  'sedd:site': (fx) => ltile({ href: 'https://www.sedenverdental.com/', kind: 'site', glyph: 'compass', title: 'sedenverdental.com', cap: 'The practice, with the logo in use', cls: fx, attrs: ' data-flex', rel: 'noopener' }),
  'x:more': (fx) => ltile({ href: 'https://x.com/halmicc', kind: 'x', glyph: 'b-x', title: 'More on X', cls: fx, attrs: ' data-flex', rel: 'me noopener' }),
  medium: (fx) => mediumTile(fx),
};
const M = model({ ...content, mountaintop: mt, phoenix: pr });
const LAYOUT = parseLayout(read('./content/layout.json'));
const HOME = resolve(M, LAYOUT);
if (HOME.problems.length) throw new Error(`content/layout.json:\n  ${HOME.problems.join('\n  ')}`);
const renderCluster = (c, flex = FLEX[c.flex?.id]) => cluster({ name: c.name, items: c.tiles.map((x) => [x.size, TILES[x.id](SIZE_CLS[x.size])]), flex: c.flex ? flex : null });
// inner pages show a cluster even when the home page hides it, with the same tile order and sizes
const cl = (id, flex) => renderCluster(arrange(M, LAYOUT, id), flex);
const SECTION = {
  stream: { alias: ['videos'], cls: 'b-watch', more: more('/videos/', 'All videos') },
  games: { cls: 'b-play', more: more('/games/', 'All games') },
  work: { alias: ['design'], cls: 'b-work', more: more('/work/pokemon-phoenix-rising/', 'Pokémon Phoenix Rising') },
  posts: { cls: 'b-posts', more: more('https://x.com/halmicc', 'More on X') },
  elsewhere: { cls: 'b-else' },
};
const homeCards = () => HOME.sections.map((s) => bento({ id: s.id, title: s.title, ...SECTION[s.id], clusters: s.clusters.map((c) => renderCluster(c)) })).join('');

const SAME_AS = ['https://www.twitch.tv/halmictv', 'https://www.youtube.com/@halmic', 'https://halmic.itch.io/', 'https://halmic.medium.com/', 'https://x.com/halmicc'];
const PERSON = { '@type': 'Person', '@id': `${SITE}/#halmic`, name: 'halmic', alternateName: ['halmicTV', 'Halmic'], url: `${SITE}/`, description: 'halmic productions: short films, Twitch streams, tiny games and design work.', image: `${SITE}/og/home.png`, sameAs: SAME_AS };
const videoLd = (v) => ({ '@type': 'VideoObject', name: v.title, description: ldDesc(v), thumbnailUrl: `${SITE}${v.thumb}`, uploadDate: v.published ?? undefined, embedUrl: `https://www.youtube-nocookie.com/embed/${v.id}`, contentUrl: v.url, author: { '@id': `${SITE}/#halmic` }, url: `${SITE}/videos/${vslug(v)}/` });
const gameLd = (g) => ({ '@type': 'VideoGame', name: g.title, description: g.line, url: `${SITE}/games/${g.slug}/`, image: `${SITE}${g.coverLocal}`, gamePlatform: 'Web browser', playMode: 'SinglePlayer', applicationCategory: 'Game', genre: g.genre ?? undefined, author: { '@id': `${SITE}/#halmic` }, sameAs: g.url, ...(g.rating ? {} : {}) });
const designLd = { '@type': 'CreativeWork', name: 'Logo for Southeast Denver Dental', creator: { '@id': `${SITE}/#halmic` }, about: 'Logo design', url: `${SITE}/design/southeast-denver-dental/`, mainEntityOfPage: 'https://www.sedenverdental.com/' };
const ldTag = (graph) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`;

// ---- page chrome ----
const navLinks = [['watch', '/#stream', 'video-camera'], ['play', '/#games', 'game-controller'], ['work', '/#work', 'briefcase'], ['say hi', '/#hi', 'chat-circle-dots']];
const NAV_OF = { videos: 'watch', games: 'play' };   // an inner page's section name -> its nav item
const navFor = (section) => `<nav aria-label="Primary">${navLinks.map(([t, h, i]) => `<a href="${h}"${t === (NAV_OF[section] ?? section) ? ' aria-current="true"' : ''}>${icon(i)}<span>${t}</span></a>`).join('')}</nav>`;   // on an inner page the link to its own section is marked as current
const NAV = navFor();
const LOGO = `<div class="xs"><a class="xs-logo" href="/" aria-label="halmic, home" aria-controls="xs-menu">${mark}</a><ul class="xs-menu" id="xs-menu"><li class="xs-hl"><a class="xs-home" href="/">${icon('arrow-left')}<span>Home</span></a></li><li>${xrow('xs-row')}</li></ul></div>`;
const SKIP = '<a class="skip" href="#main">Skip to content</a>';
const FOOT = `<footer class="foot"><div class="wrap"><p>© ${new Date().getFullYear()} halmic</p><p class="links">${[['Twitch', 'https://www.twitch.tv/halmictv', 'b-twitch', ' rel="me"'], ['YouTube', 'https://www.youtube.com/@halmic', 'b-youtube', ' rel="me"'], ['itch.io', 'https://halmic.itch.io/', 'b-itchdotio', ' rel="me"'], ['Medium', 'https://halmic.medium.com/', 'b-medium', ' rel="me"'], ['X', 'https://x.com/halmicc', 'b-x', ' rel="me"']].map(([t, h, i, r]) => `<a href="${h}"${r}>${icon(i)}<span>${t}</span></a>`).join('')}${xrow('xs-foot')}</p></div></footer>`;
// buttons and button rows for the inner pages; ext adds the external-link arrow
const btn = ({ href, label, ic = '', kind = 'ghost', ext = false, rel = '' }) => `<a class="btn btn-sm btn-${kind}" href="${href}"${ext ? ` rel="noopener${rel}"` : ''}>${ic ? icon(ic) : ''}<span>${label}</span>${ext ? icon('arrow-up-right', 'ic-end') : ''}</a>`;
const mrow = (...b) => `<div class="mrow">${b.map(btn).join('')}</div>`;
const crumb = (href, label) => `<p class="crumb"><a href="${href}">${icon('arrow-left')}<span>${label}</span></a></p>`;
const meta = (...items) => `<ul class="gmeta">${items.filter((i) => i[1]).map(([i, t]) => `<li>${icon(i)}<span>${esc(t)}</span></li>`).join('')}</ul>`;
const ogType = (f) => (f.endsWith('.png') ? 'image/png' : 'image/jpeg');
const clipT = (s, n) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, '').replace(/[\s-]+$/, '')}…`);   // page titles stay under ~60 characters
const ogAltOf = (title, ogAlt) => esc(ogAlt ?? title.replace(/ \| halmic productions$/, ''));
const head = ({ title, desc, path: p, og, ogAlt, published, ld, css = ['bold.css'], type = 'website', noindex = false }) => `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${SITE}${p}">`}<meta name="theme-color" content="#0f0e13">
<meta property="og:site_name" content="halmic productions"><meta property="og:type" content="${type}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}${p}"><meta property="og:image" content="${SITE}${og}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:type" content="${ogType(og)}"><meta property="og:image:alt" content="${ogAltOf(title, ogAlt)}"><meta property="og:locale" content="en_US">${published ? `<meta property="article:published_time" content="${published}">` : ''}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${SITE}${og}"><meta name="twitter:image:alt" content="${ogAltOf(title, ogAlt)}"><meta name="twitter:site" content="@halmicc">
<link rel="icon" href="/favicon-16.png" type="image/png" sizes="16x16"><link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32"><link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="alternate" type="application/rss+xml" title="halmic" href="/rss.xml"><link rel="preload" href="/fonts/halmic-display.43848237.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/halmic-text-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${V('base.css')}"><link rel="stylesheet" href="${V('switcher.css')}"><script src="${V('switcher.js')}" defer></script><script src="${V('vt.js')}"></script>${css.map((c) => `<link rel="stylesheet" href="${V(c)}">`).join('')}<link rel="stylesheet" href="${V('motion.css')}"><script src="${V('motion.js')}" defer></script>${ld ? ldTag(ld) : ''}`;
const inner = ({ title, desc, path: p, og, ogAlt, published, ld, body, type, noindex, section, wide = false }) => `<!doctype html><html lang="en"><head>${head({ title, desc, path: p, og, ogAlt, published, ld, css: ['bold.css', 'page.css'], type, noindex })}</head><body>
${SKIP}<header class="top"><div class="wrap">${LOGO}${navFor(section)}</div></header>
<main id="main" class="pg wrap${wide ? ' pgw' : ''}">${body}</main>${FOOT}<script src="${V('app.js')}" defer></script></body></html>`;

// ---- home templates ----
const subs = {
  wordmark: wordmark('c'), mark, year: String(new Date().getFullYear()),
  cards: homeCards(),
  head_bold: head({ title: 'halmic productions: streams, videos, games and design', desc: 'Short films and edited videos on YouTube, Twitch (halmictv) streams and clips, tiny itch.io games, logo design and QA work.', path: '/', og: '/og/home.jpg', ogAlt: 'halmic productions: the halmic wordmark in cream on a dark background with blue leaning bars', ld: [PERSON, { '@type': 'WebSite', '@id': `${SITE}/#site`, url: `${SITE}/`, name: 'halmic productions', alternateName: 'halmic', description: 'Short films, Twitch streams, tiny games and design work.', publisher: { '@id': `${SITE}/#halmic` } }, ...pageVideos.map(videoLd), ...gl.map(gameLd), designLd], css: ['bold.css'] }),
  ic_twitch: icon('b-twitch'), ic_out: icon('arrow-up-right', 'ic-end'), ic_down: icon('arrow-down', 'ic-end ic-down'),
  nav: NAV, logo: LOGO, skip: SKIP, appjs: V('app.js'), herojs: V('hero.js'), foot: FOOT,
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

// ---- hover previews: the ids that have both files, so the browser never asks for one that is missing (clips are keyed clip-<id>) ----
const pvDir = path.join(here, 'public', 'previews');
const pvIds = fs.existsSync(pvDir) ? fs.readdirSync(pvDir).filter((f) => f.endsWith('.webm') && fs.existsSync(path.join(pvDir, f.replace(/\.webm$/, '.mp4')))).map((f) => f.slice(0, -5)).sort() : [];
write('previews/index.json', `${JSON.stringify({ ids: pvIds })}\n`);

// ---- inner pages ----
const urls = [{ loc: '/', pri: 1.0 }, { loc: '/games/', pri: 0.8 }, { loc: '/videos/', pri: 0.8 }, { loc: '/design/', pri: 0.7 }, { loc: '/design/southeast-denver-dental/', pri: 0.7 }];
const vplayer = (v, lazy = false, hero = !lazy) => `<a class="vid vid-featured" href="${v.url}" data-vid="${v.id}" data-title="${esc(v.title)}" aria-label="Play video: ${esc(v.title)}"><span class="thumb"${hero ? ' data-hero' : ''}><img src="${v.thumb}" width="640" height="360" ${lazy ? 'loading="lazy" decoding="async"' : 'fetchpriority="high"'} alt="Thumbnail for the video ${esc(v.title)}">${PLAY}</span>${lazy ? `<span class="vt">${esc(v.title)}</span>` : ''}</a>`;
const mtVideo = (id, lazy = true) => vplayer({ id, title: mt.videos[id], url: `https://www.youtube.com/watch?v=${id}`, thumb: `/videos/${id}.jpg` }, lazy, false);

for (const g of gl) {
  urls.push({ loc: `/games/${g.slug}/`, pri: g.tier === 'feature' ? 0.8 : 0.7 });
  write(`games/${g.slug}/index.html`, inner({
    title: `${g.title.replace(/ \(.*\)$/, '')}: a tiny ${g.madeWith ?? 'browser'} game by halmic`, desc: `${g.line} Play ${g.title.replace(/ \(.*\)$/, '')} in your browser on itch.io.`, path: `/games/${g.slug}/`, og: `/og/game-${g.slug}.jpg`, ogAlt: `${g.title.replace(/ \(.*\)$/, '')}, a tiny game by halmic: cover art next to the title`, ld: [PERSON, gameLd(g)], section: 'games',
    body: `${crumb('/#games', 'games')}<h1>${esc(g.title)}</h1><div class="gpage"><img class="gcover" data-hero src="${g.coverLocal}" width="640" height="508" fetchpriority="high" alt="${esc(g.alt)}"><div><p class="lede2">${esc(g.line)}</p>${g.description ? `<p>${esc(g.description)}</p>` : ''}${meta(['tag', g.status], ['cpu', g.madeWith], ['game-controller', g.genre?.replace(/ ,/g, ',')], ['calendar-blank', g.jam])}${xpair(`/games/${g.slug}/`)}<p class="crow"><a class="btn btn-blue" href="${g.url}" rel="noopener">${icon('b-itchdotio')}<span>Play on itch.io</span>${icon('arrow-up-right', 'ic-end')}</a></p></div></div>${mrow({ href: '/#games', label: 'More little games', ic: 'game-controller' }, { href: '/#videos', label: 'Videos', ic: 'video-camera' }, { href: 'https://www.twitch.tv/halmictv', label: 'halmic on Twitch', ic: 'b-twitch', ext: true })}`,
  }));
}
write('games/index.html', inner({ title: 'Games by halmic: tiny jam games and experiments', desc: 'Tiny games made by halmic in PICO-8, PuzzleScript, Bitsy and GB Studio. Play them in the browser on itch.io.', path: '/games/', og: '/og/games.jpg', ogAlt: 'Little games by halmic: screenshots of four tiny games', section: 'games', wide: true, ld: [PERSON, ...gl.map(gameLd)], body: `<h1>Little games</h1><p class="lede2">Jam entries and experiments, mostly in tiny engines.</p>${bento({ cls: 'b-play', clusters: [cl('mountaintop'), cl('tiny')] })}` }));
for (const v of pageVideos) {
  urls.push({ loc: `/videos/${vslug(v)}/`, pri: films.includes(v) ? 0.7 : 0.6 });
  write(`videos/${vslug(v)}/index.html`, inner({
    title: `${clipT(v.title.replace(/\s*-\s*Funny.*$/i, ''), 50)} | halmic productions`, desc: ((v.desc || (v.excerpt && v.excerpt.length > 40 ? v.excerpt : '')) || `${v.title}. A video from halmic's YouTube channel.`).trim().replace(/^.{0,69}$/s, (m) => `${m} ${m.includes(v.title) ? '' : `${v.title}. `}A video from halmic on YouTube.`).slice(0, 160), path: `/videos/${vslug(v)}/`, og: `/og/video-${v.id}.jpg`, ogAlt: `Thumbnail of the video ${v.title}`, type: 'video.other', section: 'videos', ld: [PERSON, videoLd(v)],
    body: `${crumb('/#videos', 'videos')}<h1>${esc(v.title)}</h1><div class="vfeat">${vplayer(v)}</div>${meta([kindIcon(v.kind), v.ep ? `${vc.series.title}, episode ${v.ep}` : v.kind], ['clock', v.length], ['calendar-blank', when(v)])}<div class="mrow">${btn({ href: v.url, label: 'Watch on YouTube', ic: 'b-youtube', kind: 'blue', ext: true })}${btn({ href: 'https://www.youtube.com/@halmic?sub_confirmation=1', label: 'Subscribe', ic: 'b-youtube', ext: true })}</div>${v.desc ? `<p>${esc(v.desc)}</p>` : v.excerpt ? `<p>${esc(v.excerpt)}</p>` : ''}${mrow({ href: '/#videos', label: 'More videos', ic: 'video-camera' }, { href: '/#games', label: 'Little games', ic: 'game-controller' })}`,
  }));
}
const smashTile = (st) => tile({ href: `https://www.youtube.com/watch?v=${st.id}`, cls: 'tm', attrs: ` data-vid="${st.id}" data-title="${esc(`${st.event}: ${st.round}, halmic vs ${st.opp}`)}"`, inner: `<span class="tbg">${timg(`/videos/${st.id}.jpg`, 'yt-img')}</span>${badge('yt')}${tcap({ title: `vs ${st.opp}`, cap: `${st.event}, ${st.round}`, sr: '' })}` });
const smashFlex = (fx) => `<div class="tile t-note ${fx}" data-flex><p>${esc(smash.credit)}</p></div>`;
const vindex = `<h1>Videos</h1>${bento({ title: 'Short films, FIFA and edits', cls: 'b-watch', clusters: [cl('films'), cl('fifa'), cl('edits', (fx) => ytTile(fx, 'halmic on YouTube', 'https://www.youtube.com/@halmic?sub_confirmation=1', ' data-flex'))] })}${bento({ id: 'smash', title: 'Smash', more: `<span class="sl sl-note">${esc(smash.line)}</span>`, cls: 'b-smash', clusters: [cluster({ name: 'Smash sets', items: smash.sets.map((st) => ['one', smashTile(st)]), flex: smashFlex })] })}`;
write('videos/index.html', inner({ title: 'Videos by halmic: edits, highlights and friends', desc: 'Videos from halmic on YouTube: edits, highlight reels and friends playing games.', path: '/videos/', og: '/og/videos.jpg', ogAlt: 'Videos by halmic: thumbnails of four videos', section: 'videos', wide: true, ld: [PERSON, ...pageVideos.map(videoLd)], body: vindex }));
write('design/index.html', inner({ title: 'Design by halmic: logos and things I made', desc: 'Things halmic has designed: a logo for Southeast Denver Dental, a dental practice in Denver, Colorado, and how it looks in use.', path: '/design/', og: '/og/design.jpg', ogAlt: 'Design by halmic: the Southeast Denver Dental logo', section: 'work', wide: true, ld: [PERSON, designLd], body: `<h1>Things I’ve designed</h1>${bento({ cls: 'b-design', clusters: [cluster({ name: 'Southeast Denver Dental', items: [['lead', seddTile('lead w2')], ['one', hiTile('')], ['one', ytTile()]], flex: (fx) => mediumTile(fx) })] })}` }));
write('design/southeast-denver-dental/index.html', inner({
  title: 'Logo for Southeast Denver Dental | halmic productions', desc: 'halmic designed the logo for Southeast Denver Dental, a dental practice in Denver, Colorado. See it in use on their website.', path: '/design/southeast-denver-dental/', og: '/og/design-sedd.jpg', ogAlt: 'The Southeast Denver Dental logo, an orange and blue four-lobed tooth mark beside the name', section: 'work', ld: [PERSON, designLd],
  body: `${crumb('/#work', 'work')}<h1>Logo for Southeast Denver Dental</h1><p class="lede2">I designed the logo for Southeast Denver Dental, a dental practice in Denver, Colorado.</p><figure class="inuse-fig"><div class="inuse-wrap" data-hero>${seddVideo(` aria-label="${SEDD_LABEL}"`)}<button type="button" class="ibtn vtoggle is-paused" data-vtoggle aria-label="Play video" aria-pressed="false">${icon('pause', 'ic-pause')}${icon('play', 'ic-play')}</button></div><figcaption>${icon('film-strip')}<span>${SEDD_LABEL}. Footage from the <a href="https://www.sedenverdental.com/" rel="noopener">practice’s own website</a>.</span></figcaption></figure><div class="shots">${subs.design_shots}</div><p>Screenshots are of their public website.</p>${mrow({ href: 'https://www.sedenverdental.com/', label: 'Visit sedenverdental.com', kind: 'blue', ext: true }, { href: '/#work', label: 'More work', ic: 'briefcase' })}`,
}));

urls.push({ loc: '/work/pokemon-phoenix-rising/', pri: 0.6 });
write('work/pokemon-phoenix-rising/index.html', inner({
  title: `${pr.role} on ${pr.title} | halmic productions`, desc: `halmic was a ${pr.role} on ${pr.title}. ${pr.line}`, path: '/work/pokemon-phoenix-rising/', og: '/og/work-phoenix-rising.jpg', ogAlt: pr.alt, section: 'work', ld: [PERSON], wide: true,
  body: `${crumb('/#work', 'work')}<h1>${esc(pr.role)} on ${esc(pr.title)}</h1><p class="lede2">${esc(pr.line)}</p>${meta(['user-circle', pr.role], ['cpu', 'RPG Maker XP'], ['game-controller', 'Fan-made, episodic'])}<h2 class="h2s">About the game</h2><p>${esc(pr.about)}</p>${mrow({ href: pr.reddit.url, label: pr.reddit.title, ic: 'b-reddit', kind: 'blue', ext: true, rel: ' me' }, { href: pr.channel.url, label: 'Official YouTube channel', ic: 'b-youtube', ext: true })}<h2 class="h2s">Official videos</h2><div class="grid g3">${pr.videos.map((v, i) => card({ href: `https://www.youtube.com/watch?v=${v.id}`, cls: '', attrs: ` data-vid="${v.id}" data-title="${esc(v.title)}"`, m: media(`/videos/${v.id}.jpg`, `Thumbnail for the video ${v.title}`, { play: true, chip: chip(v.length, 'clock') }), ei: 'video-camera', ey: `video · ${v.published.slice(0, 4)}`, title: v.title, text: `Video by ${pr.channel.name}` })).join('')}</div><p class="gmeta">Videos by <a href="${pr.channel.url}" rel="noopener">${esc(pr.channel.name)}</a>, the game’s official YouTube channel.</p>${pr.redditPosts.length ? `<h2 class="h2s">From Reddit</h2><ul class="rlist">${pr.redditPosts.map((r) => `<li><a href="${r.url}" rel="noopener">${esc(r.title)}</a> <span>${esc(r.sub)}${r.date ? ` · ${esc(r.date)}` : ""}</span>${r.summary ? `<br>${esc(r.summary)}` : ""}</li>`).join('')}</ul>` : ''}${mrow({ href: '/#work', label: 'More work', ic: 'briefcase' }, { href: '/#videos', label: 'Videos', ic: 'video-camera' })}`,
}));

// ---- Project Mountaintop: project page + one page per dev log ----
const mtOpts = { img: mtImg, youtube: (id) => `<div class="vfeat">${mtVideo(id)}</div>` };
const mtVideoLd = { '@type': 'VideoObject', name: mt.videos[mt.video], description: `${mt.title}: ${mt.line}`, thumbnailUrl: `${SITE}/videos/${mt.video}.jpg`, uploadDate: mt.videoPublished, embedUrl: `https://www.youtube-nocookie.com/embed/${mt.video}`, contentUrl: `https://www.youtube.com/watch?v=${mt.video}`, author: { '@id': `${SITE}/#halmic` }, url: `${SITE}${mtBase}` };
const mtWorkLd = { '@type': 'CreativeWork', '@id': `${SITE}${mtBase}#work`, name: mt.title, description: mt.line, url: `${SITE}${mtBase}`, image: `${SITE}/work/mountaintop/${mt.cover}`, creator: { '@id': `${SITE}/#halmic` }, genre: 'Video game', video: { '@type': 'VideoObject', name: mt.videos[mt.video], url: `${SITE}${mtBase}` }, hasPart: mtLogs.map((l) => ({ '@type': 'BlogPosting', headline: l.title, url: `${SITE}${l.url}` })) };
const mtLogLd = (l) => ({ '@type': 'BlogPosting', headline: l.title, description: l.description, datePublished: l.date, dateModified: l.updated ?? l.date, image: `${SITE}/work/mountaintop/${l.hero}`, url: `${SITE}${l.url}`, mainEntityOfPage: `${SITE}${l.url}`, author: { '@id': `${SITE}/#halmic` }, publisher: { '@id': `${SITE}/#halmic` }, isPartOf: { '@id': `${SITE}${mtBase}#work` }, about: { '@id': `${SITE}${mtBase}#work` } });
urls.push({ loc: mtBase, pri: 0.7 }, ...mtLogs.map((l) => ({ loc: l.url, pri: 0.5 })));
const mtLogCard = (l, i) => card({ href: l.url, attrs: ` data-vt="${l.hero === mt.cover ? 't' : 'm t'}"`, cls: l.hero === mt.cover ? 'c-3 txt' : '', m: l.hero === mt.cover ? '' : media(`/work/mountaintop/${l.hero}`, l.heroAlt, { w: mt.images[l.hero].w, h: mt.images[l.hero].h }), tile: l.hero === mt.cover ? 'notebook' : '', ei: 'notebook', ey: `dev log ${l.order} · ${mtDate(l.date)}`, title: l.title, text: l.description });
write('work/project-mountaintop/index.html', inner({
  title: `${mt.title}: a hiking-pole rhythm game | halmic productions`, desc: `${mt.title}, a Unity rhythm game played with custom Arduino hiking-pole controllers. Gameplay video and the dev logs, by halmic.`, path: mtBase, og: '/og/work-project-mountaintop.jpg', ogAlt: mt.coverAlt, section: 'work', ld: [PERSON, mtWorkLd, mtVideoLd], wide: true,
  body: `${crumb('/#work', 'work')}<h1>${esc(mt.title)}</h1><p class="lede2">${esc(mt.hook)}</p>${meta(['user-circle', mt.role], ['cpu', 'Unity'], ['cpu', 'Arduino'], ['tag', 'C#'])}${xpair(mtBase)}<div class="mtintro"><div class="log">${md(mtIntro, mtOpts)}</div><div class="vfeat">${mtVideo(mt.video, false)}</div></div>${gh('Dev logs', 'logs', 'Written while it was being built, in 2023.', 'notebook')}<div class="grid g3">${mtLogs.map(mtLogCard).join('')}</div>${mrow({ href: '/#work', label: 'More work', ic: 'briefcase' }, { href: '/#games', label: 'Little games', ic: 'game-controller' }, { href: 'https://www.youtube.com/@halmic', label: 'halmic on YouTube', ic: 'b-youtube', ext: true })}`,
}));
for (const l of mtLogs) {
  const i = mtLogs.indexOf(l), prev = mtLogs[i - 1], next = mtLogs[i + 1];
  write(`work/project-mountaintop/${l.slug}/index.html`, inner({
    title: `${l.title} | Project Mountaintop dev log`, desc: l.description.slice(0, 160), path: l.url, og: `/og/mountaintop-${l.slug}.jpg`, ogAlt: l.heroAlt, published: l.date, section: 'work', type: 'article', ld: [PERSON, mtWorkLd, mtLogLd(l)],
    body: `${crumb(mtBase, `Project Mountaintop · dev log ${l.order}`)}<h1>${esc(l.title)}</h1>${meta(['calendar-blank', mtDate(l.date)], ['notebook', `Dev log ${l.order} of ${mtLogs.length}`])}${xpair(l.url)}<article class="log">${md(l.body, mtOpts).replace('<img ', '<img data-hero ')}</article>${mrow(...(prev ? [{ href: prev.url, label: prev.title, ic: 'arrow-left' }] : []), ...(next ? [{ href: next.url, label: next.title, ic: 'arrow-right' }] : []), { href: mtBase, label: 'All dev logs', ic: 'notebook' })}`,
  }));
}

// ---- 404 (served by the assets layer for unknown paths: not_found_handling "404-page"; noindex, not in the sitemap) ----
write('404.html', inner({ title: 'Not here | halmic productions', desc: 'This page does not exist.', path: '/404.html', og: '/og/home.jpg', noindex: true, body: `<h1>Not here.</h1><p class="lede2">Nothing lives at this address.</p>${mrow({ href: '/', label: 'Back to halmic', ic: 'arrow-left' })}` }));

// ---- _headers (generated; Cloudflare static-assets headers file; /api/* responses get theirs from worker/index.js) ----
// CSP matches the site as built: no inline script/style (JSON-LD is a data block), fonts and images are self-hosted, the only
// third-party requests are the click-to-load youtube-nocookie and Twitch clip player iframes. connect-src 'self' covers /api/*.
const CSP = "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://cloudflareinsights.com; frame-src https://www.youtube-nocookie.com https://clips.twitch.tv; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";
const rule = (p, h) => `${p}\n${Object.entries(h).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\n`;
write('_headers', [
  rule('/*', { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Content-Security-Policy': CSP }),
  // fonts are not fingerprinted by name, so a month rather than immutable; HTML gets the assets layer's default (revalidate on every load, etag)
  rule('/fonts/*', { 'Cache-Control': 'public, max-age=2592000' }),
  // hover previews and the hero reel keep their names when re-rendered, so a week; app.js asks for previews/index.json with cache: 'no-cache' (revalidates), so a new preview shows up at once
  rule('/previews/*', { 'Cache-Control': 'public, max-age=604800' }),
  rule('/hero/*', { 'Cache-Control': 'public, max-age=604800' }),
  // css/js are linked with ?v=<hash> (see V() above), so they can be immutable
  rule('/*.css', { 'Cache-Control': 'public, max-age=31536000, immutable' }),
  rule('/*.js', { 'Cache-Control': 'public, max-age=31536000, immutable' }),
  rule('/icons.svg', { 'Cache-Control': 'public, max-age=31536000, immutable' }),
  ...['jpg', 'png', 'svg'].map((e) => rule(`/*.${e}`, { 'Cache-Control': 'public, max-age=86400' })),
].join('\n'));

// ---- sitemap, robots, rss, llms ----
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${SITE}${u.loc}</loc><lastmod>${BUILD_DATE}</lastmod><priority>${u.pri}</priority></url>`).join('')}</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
write('rss.xml', `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>halmic productions</title><link>${SITE}/</link><description>Videos, games and other things from halmic.</description><language>en</language>${pageVideos.map((v) => `<item><title>${esc(v.title)}</title><link>${SITE}/videos/${vslug(v)}/</link><guid isPermaLink="true">${SITE}/videos/${vslug(v)}/</guid>${v.published ? `<pubDate>${new Date(v.published).toUTCString()}</pubDate>` : ''}<description>${esc(ldDesc(v))}</description></item>`).join('')}${mtLogs.map((l) => `<item><title>${esc(`Project Mountaintop dev log: ${l.title}`)}</title><link>${SITE}${l.url}</link><guid isPermaLink="true">${SITE}${l.url}</guid><pubDate>${new Date(l.date).toUTCString()}</pubDate><description>${esc(l.description)}</description></item>`).join('')}</channel></rss>\n`);
write('llms.txt', `# halmic productions\n\n> halmic productions (also halmic, halmicTV): short films, Twitch streams, tiny games and design work. It streams games and codes stupid things on Twitch, makes edited videos on YouTube and tiny games on itch.io, and designs logos and other things. This is its home page.\n\n## Where to find halmic\n- Twitch: https://www.twitch.tv/halmictv\n- YouTube: https://www.youtube.com/@halmic\n- itch.io: https://halmic.itch.io/\n- Medium: https://halmic.medium.com/\n- X: https://x.com/halmicc\n\n## Pages\n- ${SITE}/ : home\n- ${SITE}/games/ : little games\n${gl.map((g) => `- ${SITE}/games/${g.slug}/ : ${g.title}`).join('\n')}\n- ${SITE}/videos/ : videos\n- ${SITE}/design/ : design\n- ${SITE}/design/southeast-denver-dental/ : logo for Southeast Denver Dental\n- ${SITE}/work/pokemon-phoenix-rising/ : QA developer on Pokémon Phoenix Rising, a fan-made game (about the game, official videos, subreddit)\n- ${SITE}${mtBase} : Project Mountaintop, a Unity rhythm game played with Arduino hiking poles\n${mtLogs.map((l) => `- ${SITE}${l.url} : dev log, ${l.title}`).join('\n')}\n`);
console.log('built', fs.readdirSync(path.join(here, 'src')).join(', '), '+', urls.length, 'urls');
