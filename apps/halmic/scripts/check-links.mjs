// Checks the built public/ tree: every internal href/src/og:image resolves to a file, no placeholders or draft markers remain,
// sitemap entries exist, the 404 is noindex, and the card layout holds (one link per card, no inline styles, local images only, the removed copy stays removed). Run after `npm run build`. Exits 1 on any problem.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { homeStats } from '../stats.mjs';
import { model, SIZE_CLS } from '../bentos.mjs';
import { parseLayout, resolve as arrangeHome, isDefault } from '../layout.mjs';
const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const SITE = 'https://halmic.com';
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const sprite = fs.readFileSync(path.join(pub, 'icons.svg'), 'utf8');
const symbols = new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
const htmls = walk(pub).filter((f) => f.endsWith('.html'));
const bad = [];
// content/layout.json: the build must follow it whatever it says; the editorial checks below (which film leads, which games come first) hold for the default arrangement only
const cj = (p) => JSON.parse(fs.readFileSync(path.join(pub, '..', 'content', p), 'utf8'));
const LAY = parseLayout(fs.readFileSync(path.join(pub, '..', 'content/layout.json'), 'utf8'));
const DEF = isDefault(LAY);
const HOME = arrangeHome(model({ videos: cj('videos.json'), exclude: cj('videos.exclude.json'), curation: cj('curation.json'), games: cj('games.json'), posts: cj('posts.json'), mountaintop: cj('mountaintop/index.json'), phoenix: cj('phoenix-rising.json') }), LAY);
if (HOME.problems.length) bad.push(...HOME.problems.map((x) => `layout.json: ${x}`));
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
  for (const m of h.matchAll(/<use href="([^"#]*)#([^"]+)"/g)) { if (!/^\/icons\.svg(\?v=[0-9a-f]+)?$/.test(m[1])) bad.push(`${rel}: icon sprite href ${m[1]}`); if (!symbols.has(m[2])) bad.push(`${rel}: icon "${m[2]}" is missing from icons.svg`); }
  for (const m of h.matchAll(/\bposter="([^"]*)"/g)) check(rel, m[1]);
  if (/<video\b/.test(h) && !/<video\b[^>]*\bmuted\b[^>]*\bpreload="none"/.test(h)) bad.push(`${rel}: video must be muted with preload="none"`);
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
for (const id of ['stream', 'videos', 'games', 'work', 'design', 'hi', 'twitch', 'elsewhere']) if (!home.includes(`id="${id}"`)) bad.push(`index.html: missing #${id}`);
if (/id="clips"|id="when"|class="plays"|On the stream/.test(home)) bad.push('index.html: the old stream section is back');
if ((home.match(/<h2>/g) ?? []).length < 4) bad.push('index.html: expected the bento labels as h2');
if (DEF && (home.match(/<a class="tile /g) ?? []).length < 20) bad.push('index.html: fewer tiles than expected');
if (/class="[^"]*\b(ey|cb|card|ct|cx)\b/.test(home)) bad.push('index.html: old card/eyebrow markup is back (the home page is bento tiles)');
if (/\b(clip|video)\b/i.test([...home.matchAll(/<span class="chip">[\s\S]*?<\/span><\/span>/g)].map((m) => m[0]).join(''))) bad.push('index.html: a chip says clip/video (platforms are shown by icon)');
for (const m of home.matchAll(/<span class="bdg[^>]*>/g)) if (!/role="img"/.test(m[0]) || !/aria-label="[^"]+"/.test(m[0])) bad.push(`index.html: badge without an accessible name ${m[0].slice(0, 70)}`);
for (const [id, name] of DEF ? [['tw', 'Twitch'], ['yt', 'YouTube']] : [['tw', 'Twitch']]) if (!new RegExp(`class="bdg bdg-${id}" role="img" aria-label="${name}"`).test(home)) bad.push(`index.html: no ${name} badge`);
for (const [kind, href, extra] of [['tw', 'https://www.twitch.tv/halmictv', 'id="twitch"'], ['yt', 'https://www.youtube.com/@halmic', ''], ['itch', 'https://halmic.itch.io/', ''], ['x', 'https://x.com/halmicc', 'id="hi"'], ['rd', 'https://www.reddit.com/r/pokemonphoenixrising/comments/8m5eew/phoenix_rising_demo_megathread/', ''], ['md', 'https://halmic.medium.com/', '']].filter(([k]) => DEF || k === 'tw' || k === 'x')) { // under a custom layout only the required tiles (Twitch, hi) are sure to be shown
  const m = home.match(new RegExp(`<a class="tile t-link tl-${kind}[^"]*" href="([^"]+)"[^>]*${extra ? extra.replace(/"/g, '"') : ''}[^>]*>`)) ?? home.match(new RegExp(`<a class="tile t-link tl-${kind}[^"]*" href="([^"]+)"[^>]*>`)); // the Posts bento has its own link tile for the same network, so look for the tagged one first
  if (!m) bad.push(`index.html: link tile ${kind} missing`);
  else { if (m[1] !== href) bad.push(`index.html: link tile ${kind} points at ${m[1]}`); if (extra && !m[0].includes(extra)) bad.push(`index.html: link tile ${kind} lost ${extra}`); }
}
for (const m of home.matchAll(/<a class="tile [^"]*"[^>]*>([\s\S]*?)<\/a>/g)) if (!/<h3 class="tt">/.test(m[1])) bad.push(`index.html: tile without a title ${m[0].slice(0, 80)}`);
if (DEF && (!/<h2>Watch<\/h2>/.test(home) || !/<h2>Play<\/h2>/.test(home) || !/<h2>Work<\/h2>/.test(home))) bad.push('index.html: Watch / Play / Work bentos expected');
if (/<h2>(Clips|Videos)<\/h2>/.test(home)) bad.push('index.html: separate Clips / Videos groups are back (one Watch bento)');
for (const t of ['watch', 'play', 'work', 'say hi']) if (!home.includes(`<span>${t}</span>`)) bad.push(`index.html: nav item "${t}" missing`);
if (!home.includes('href="/#stream"')) bad.push('index.html: nav should point at #stream');
if (!home.includes('href="/#work"') || /href="\/#design"/.test(home)) bad.push('index.html: nav should point at #work (#design stays as an anchor alias)');
if (!home.includes('id="design"')) bad.push('index.html: #design alias missing');
const sedd = fs.readFileSync(path.join(pub, 'design/southeast-denver-dental/index.html'), 'utf8');
if (!/<video\b[^>]*data-loop/.test(sedd) || !sedd.includes('Footage from the')) bad.push('design/southeast-denver-dental: in-use loop or its caption missing');
if (!/media-src 'self'/.test(fs.readFileSync(path.join(pub, '_headers'), 'utf8'))) bad.push('_headers: media-src should be self');
for (const e of ['webm', 'mp4']) if (fs.statSync(path.join(pub, `work/southeast-denver-dental-inuse.${e}`)).size > 900 * 1024) bad.push(`dental loop .${e} is over 900 KB`);
// hero reel: muted, inline, no source until hero.js starts it (preload none, no autoplay), poster only as data-poster so it can never be the LCP; every file hero.js points at exists and stays inside its size budget
const reelVid = home.match(/<div class="reel"[^>]*aria-hidden="true">[\s\S]*?<video\b[^>]*>/)?.[0] ?? '';
const reelTag = reelVid.slice(reelVid.indexOf('<video'));
if (!/<canvas\b/.test(reelVid) || !/<video\b[^>]*\bmuted\b[^>]*\bloop\b[^>]*\bplaysinline\b[^>]*\bpreload="none"/.test(reelTag) || /\s(autoplay|controls|src|poster)[=\s>]/.test(reelTag)) bad.push('index.html: hero reel video must be muted loop playsinline preload="none", without autoplay/controls/src/poster, inside an aria-hidden .reel with a canvas');
const reelPoster = reelTag.match(/data-poster="([^"]+)"/)?.[1];
if (!reelPoster || !resolve(reelPoster)) bad.push('index.html: hero reel video needs a data-poster that resolves');
if (!/<script src="\/hero\.js\?v=[0-9a-f]+" defer>/.test(home)) bad.push('index.html: hero.js should load with defer and a content hash');
const heroJs = fs.readFileSync(path.join(pub, 'hero.js'), 'utf8');
if (/\beval\(|new Function\(|\.innerHTML\s*=|\.style\.cssText|setAttribute\(\s*['"]style/.test(heroJs)) bad.push('hero.js: eval/inline-style patterns are not allowed (CSP)');
for (const m of heroJs.matchAll(/'(\/hero\/[^']+)'/g)) if (!resolve(m[1])) bad.push(`hero.js: ${m[1]} does not exist`);
for (const [f, max] of [['reel-1080.webm', 4.5], ['reel-720.webm', 2.5], ['reel-720.mp4', 3.2], ['reel-m.webm', 1.6], ['reel-m.mp4', 2]]) { const fp = path.join(pub, 'hero', f); if (!fs.existsSync(fp)) bad.push(`hero/${f} missing`); else if (fs.statSync(fp).size > max * 1024 * 1024) bad.push(`hero/${f} is over ${max} MB`); }
for (const [f, max] of [['reel-poster.jpg', 110], ['reel-poster-m.jpg', 80]]) { const fp = path.join(pub, 'hero', f); if (!fs.existsSync(fp)) bad.push(`hero/${f} missing`); else if (fs.statSync(fp).size > max * 1024) bad.push(`hero/${f} is over ${max} KB`); }
// Special Force leads Watch (home) and /videos/; the clean names show, the real titles stay in data-title
if (DEF) {
  const watch = home.slice(home.indexOf('<div class="bento b-watch">'));
  const vids = [...watch.matchAll(/<a class="tile tm ([^"]*)" href="[^"]*" data-vid="([^"]+)" data-title="([^"]*)"/g)];
  if (vids[0]?.[2] !== 'qVEDjNc5Gmg' || vids[1]?.[2] !== 'IIJVKHEtawU') bad.push(`index.html: Special Force 1 and 2 should be the first two Watch tiles (got ${vids.slice(0, 2).map((m) => m[2])})`);
  if (!/\blead w2\b/.test(vids[0]?.[1] ?? '') || !/\bx4\b/.test(vids[1]?.[1] ?? '')) bad.push('index.html: Special Force 1 should be the 2x2 lead and Special Force 2 its x4 satellite');
  if (!/<h3 class="tt">Special Force: Origins<\/h3>/.test(home) || !/<h3 class="tt">Special Force 2: The Array<\/h3>/.test(home)) bad.push('index.html: clean Special Force titles missing');
  if (!/data-title="SPECIAL FORCE 1 - ORIGINS"/.test(home)) bad.push('index.html: real Special Force title should stay in data-title');
  if (!/<p class="ts">Short film<\/p>/.test(watch)) bad.push('index.html: Short film caption missing');
  const vi = fs.readFileSync(path.join(pub, 'videos/index.html'), 'utf8');
  const vo = [...vi.matchAll(/<a class="tile tm [^"]*" href="[^"]*" data-vid="([^"]+)"/g)].map((m) => m[1]);
  if (vo[0] !== 'qVEDjNc5Gmg' || vo[1] !== 'IIJVKHEtawU') bad.push(`videos/index.html: Special Force films should come first (got ${vo.slice(0, 2)})`);
  for (const id of ['qVEDjNc5Gmg', 'IIJVKHEtawU']) { const f = `videos/${id}-hd.jpg`; if (!resolve(`/${f}`)) bad.push(`${f} missing`); }
}
// hover previews: every id in previews/index.json has both files inside the size budget; every video/clip tile id on the home page that is listed has them; total stays under 6 MB; the lead films are 640x360 loops
{
  const dir = path.join(pub, 'previews');
  const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')).ids;
  let total = 0;
  const lim = (id) => (['qVEDjNc5Gmg', 'IIJVKHEtawU'].includes(id) ? [450, 450] : [220, 300]);
  for (const id of idx) {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) { bad.push(`previews/index.json: odd id ${id}`); continue; }
    const [mw, mm] = lim(id);
    for (const [e, max] of [['webm', mw], ['mp4', mm]]) { const f = path.join(dir, `${id}.${e}`); if (!fs.existsSync(f)) bad.push(`previews/${id}.${e} missing`); else { const kb = fs.statSync(f).size / 1024; total += kb; if (kb > max) bad.push(`previews/${id}.${e} is ${kb.toFixed(0)} KB (max ${max})`); } }
  }
  for (const f of fs.readdirSync(dir)) if (/\.(webm|mp4)$/.test(f) && !idx.includes(f.replace(/\.(webm|mp4)$/, ''))) bad.push(`previews/${f} is not listed in index.json`);
  if (total > 6 * 1024) bad.push(`previews total ${(total / 1024).toFixed(1)} MB is over 6 MB`);
  for (const m of home.matchAll(/data-vid="([^"]+)"/g)) if (['qVEDjNc5Gmg', 'IIJVKHEtawU', 'N7HKj1dYZjU', '2jM2QSTSte4', 'mRIj1BeCJ_o', 'Nhs4iQcN7-w', 'Et47QCJ3-3g', 'pl6lJAYPLgc'].includes(m[1]) && !idx.includes(m[1])) bad.push(`previews: no loop for home tile ${m[1]}`);
  const hd = fs.readFileSync(path.join(pub, '_headers'), 'utf8');
  if (!/\/previews\/\*\n\s+Cache-Control: public, max-age=604800/.test(hd) || !/\/hero\/\*\n\s+Cache-Control: public, max-age=\d+/.test(hd)) bad.push('_headers: /previews/* and /hero/* cache rules missing');
  if (/previews/.test(home.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, ''))) bad.push('index.html: nothing preview-related may be referenced from the markup (loaded on hover only)');
}
const px = fs.readFileSync(path.join(pub, 'work/pokemon-phoenix-rising/index.html'), 'utf8');
if (!/Videos by <a href="https:\/\/www\.youtube\.com\/@PhoenixRisingGame"/.test(px) || (px.match(/data-vid="/g) ?? []).length < 2) bad.push('work/pokemon-phoenix-rising: channel credit or videos missing');
const mtDir = path.join(pub, 'work/project-mountaintop');
const mtHome = fs.readFileSync(path.join(mtDir, 'index.html'), 'utf8');
if (!/data-vid="Gv-xMeMM8m4"/.test(mtHome) || !mtHome.includes('youtube-nocookie.com/embed/Gv-xMeMM8m4')) bad.push('work/project-mountaintop: main video missing');
const mtLogLinks = [...mtHome.matchAll(/<a class="card[^"]*" href="(\/work\/project-mountaintop\/[^"]+)"/g)].map((m) => m[1]);
if (mtLogLinks.length < 6) bad.push(`work/project-mountaintop: expected 6 dev-log cards, found ${mtLogLinks.length}`);
for (const l of mtLogLinks) { const h = fs.readFileSync(path.join(pub, l, 'index.html'), 'utf8'); if (!/<article class="log">/.test(h) || !/"@type":"BlogPosting"/.test(h)) bad.push(`${l}: not a dev-log article with BlogPosting JSON-LD`); }
for (const f of walk(mtDir).filter((x) => x.endsWith('.html'))) { const h = fs.readFileSync(f, 'utf8'); if (/<iframe/.test(h)) bad.push(`${path.relative(pub, f)}: pre-loaded iframe (embeds must be click-to-load)`); }
// Mountaintop leads Play (2x2), Phoenix Rising leads Work (2x2); Discord is gone everywhere; the hi tile is X
{
  if (DEF) {
  const sec = (id) => { const i = home.indexOf(`id="${id}"`); return home.slice(i, home.indexOf('class="bsec"', i + 10) > 0 ? home.indexOf('class="bsec"', i + 10) : undefined); };
  const play = sec('games'), work = sec('work');
  if (!/<div class="bento b-play"><div class="cl" role="group" aria-label="Project Mountaintop"><a class="tile tm lead w2" href="\/work\/project-mountaintop\/"/.test(play)) bad.push('index.html: Project Mountaintop should be the 2x2 lead tile of Play');
  if (/project-mountaintop\/"[^>]*>/.test(work.replace(/<a class="tile t-stat[^>]*>/g, ''))) bad.push('index.html: Mountaintop tile should not be in Work');
  if (!/<a class="tile t-stat tdim\s+lead w2" href="\/work\/pokemon-phoenix-rising\/"/.test(work) || !/QA developer/.test(work)) bad.push('index.html: Phoenix Rising 2x2 lead with the QA developer role missing from Work');
  if (/data-vid="/.test(work)) bad.push('index.html: the Phoenix Rising videos live on its page, not as Work tiles');
  if (/Episode 1 of the game|>2018</.test(home)) bad.push('index.html: the 2018 stat tile is back');
  if (!/<a class="tile t-link tl-rd[^"]*" href="https:\/\/www\.reddit\.com\/r\/pokemonphoenixrising\/comments\/8m5eew\/phoenix_rising_demo_megathread\/"/.test(work)) bad.push('index.html: demo megathread link tile missing from Work');
  const gamesOrder = [...play.matchAll(/<a class="tile [^"]*" href="([^"]+)"/g)].map((m) => m[1]).filter((h) => !h.includes('#logs'));
  if (gamesOrder[1] !== '/games/glass-gunslinger-dod/' || gamesOrder[2] !== '/games/lvasion-du-criminel-de-sa-prison/') bad.push(`index.html: Play order after the lead should be Glass Gunslinger, L'évasion (got ${gamesOrder.slice(1, 3)})`);
  }
  for (const f of walk(pub).filter((x) => /\.(html|txt|xml|js|css)$/.test(x))) if (/discord/i.test(fs.readFileSync(f, 'utf8'))) bad.push(`${path.relative(pub, f)}: mentions Discord`);
  if (/discord/i.test(fs.readFileSync(path.join(pub, 'icons.svg'), 'utf8'))) bad.push('icons.svg: Discord glyph still in the sprite');
  const gi = fs.readFileSync(path.join(pub, 'games/index.html'), 'utf8');
  if (DEF && !/<div class="bento b-play"><div class="cl" role="group" aria-label="Project Mountaintop"><a class="tile tm lead w2" href="\/work\/project-mountaintop\/"/.test(gi)) bad.push('games/index.html: Project Mountaintop should be the first tile');
  const postsJson = JSON.parse(fs.readFileSync(path.join(pub, '..', 'content/posts.json'), 'utf8')).posts;
  const postsShown = HOME.sections.some((x) => x.id === 'posts');
  if (postsJson.length && postsShown) {
    if (!home.includes('id="posts"') || !/<h2>Posts<\/h2>/.test(home)) bad.push('index.html: #posts bento missing');
    for (const p of postsJson) { if (!/^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/.test(p.url) || !home.includes(`href="${p.url}"`)) bad.push(`index.html: post tile ${p.id} missing or wrong url`); if (p.media && (!p.alt || !resolve(`/posts/${p.media}`) || fs.statSync(path.join(pub, 'posts', p.media)).size > 200 * 1024)) bad.push(`posts/${p.media}: missing, no alt, or over 200 KB`); }
  } else if (!postsShown && home.includes('id="posts"')) bad.push('index.html: empty #posts bento rendered');
}
const games = fs.readFileSync(path.join(pub, 'games/index.html'), 'utf8');
const gOrder = [...games.matchAll(/<a class="tile [^"]*" href="\/games\/([^/"]+)\//g)].map((m) => m[1]);
if (DEF && (gOrder[0] !== 'glass-gunslinger-dod' || gOrder[1] !== 'lvasion-du-criminel-de-sa-prison')) bad.push(`games/index.html: featured games should come first (got ${gOrder.slice(0, 2)})`);
for (const f of ['games/index.html', 'videos/index.html', 'design/index.html']) { const h = fs.readFileSync(path.join(pub, f), 'utf8'); if (/class="[^"]*\b(ey|cb)\b/.test(h)) bad.push(`${f}: eyebrow/card markup on an index page`); if (!/class="bento /.test(h)) bad.push(`${f}: bento expected`); }
if (DEF && (games.match(/class="tile tm lead w2"/g) ?? []).length !== 1) bad.push('games/index.html: expected exactly one lead tile (Project Mountaintop)');
// clusters: every bento is a stack of .cl groups; projects stay together; year tiles come from the data (years are never typed in build.mjs)
if (DEF) {
  const clusters = (h, id) => { const i = h.indexOf(`id="${id}"`); const sec = h.slice(i, h.indexOf('class="bsec"', i + 10) > 0 ? h.indexOf('class="bsec"', i + 10) : undefined); return [...sec.matchAll(/<div class="cl" role="group" aria-label="([^"]*)">([\s\S]*?)(?=<div class="cl"|$)/g)].map((m) => [m[1], m[2]]); };
  for (const id of ['stream', 'games', 'work', 'elsewhere']) if (/<div class="bento [^"]*">(?!<div class="cl")/.test(home.slice(home.indexOf(`id="${id}"`)).split('class="bsec"')[0])) bad.push(`index.html: #${id} has tiles outside a cluster`);
  const names = (id) => clusters(home, id).map((c) => c[0]);
  const same = (id, want) => { const got = names(id).join('|'); if (got !== want.join('|')) bad.push(`index.html: #${id} clusters should be ${want.join(', ')} (got ${names(id).join(', ')})`); };
  same('stream', ['Special Force', 'FIFA With the Boys', 'More from the channel', 'Twitch clips']);
  same('games', ['Project Mountaintop', 'Tiny games']);
  same('work', ['Pokémon Phoenix Rising', 'Southeast Denver Dental']);
  const yearOf = (h) => [...h.matchAll(/<div class="tile t-stat t-year [^"]*"[^>]*><span class="num"[^>]*><span class="nv">(\d{4})<\/span>/g)].map((m) => +m[1]);
  const vids = JSON.parse(fs.readFileSync(path.join(pub, '..', 'content/videos.json'), 'utf8')).videos;
  const yv = (id) => +vids.find((v) => v.id === id).published.slice(0, 4);
  const cl = (id, name) => clusters(home, id).find((c) => c[0] === name)?.[1] ?? '';
  if (yearOf(cl('stream', 'Special Force')).join() !== String(Math.min(yv('qVEDjNc5Gmg'), yv('IIJVKHEtawU')))) bad.push('index.html: Special Force year tile does not match the films\' publish dates');
  if (yearOf(cl('stream', 'FIFA With the Boys')).join() !== String(yv('Nhs4iQcN7-w'))) bad.push('index.html: FIFA year tile does not match the first episode');
  const mtJson = JSON.parse(fs.readFileSync(path.join(pub, '..', 'content/mountaintop/index.json'), 'utf8'));
  if (yearOf(cl('games', 'Project Mountaintop')).join() !== String(+mtJson.videoPublished.slice(0, 4))) bad.push('index.html: Mountaintop year tile does not match the content dates');
  if (yearOf(cl('work', 'Pokémon Phoenix Rising')).length || yearOf(cl('work', 'Southeast Denver Dental')).length) bad.push('index.html: Work has no dated source, so no year tiles');
  // stat tiles: every number shown is re-derived here from the content files (stats.mjs reads them; the minutes and the engines are also summed independently below) and must match the built tile, in the right cluster
  {
    const S = homeStats(), cur = JSON.parse(fs.readFileSync(path.join(pub, '..', 'content/curation.json'), 'utf8')), games = JSON.parse(fs.readFileSync(path.join(pub, '..', 'content/games.json'), 'utf8')).games;
    const sec = (l) => l.split(':').reduce((n, p) => n * 60 + +p, 0);
    const epSecs = cur.videos.series.episodes.reduce((n, id) => n + sec(vids.find((v) => v.id === id).length), 0);
    const engines = new Set(games.filter((g) => (cur.games[g.slug]?.tier ?? 'more') !== 'off').map((g) => g.madeWith.toLowerCase()));
    if (S.fifaMinutes !== Math.round(epSecs / 60) || S.engines.length !== engines.size) bad.push('stats.mjs: minutes or engines disagree with the content files');
    const tile = (h, key) => { const m = h.match(new RegExp(`<(a|div) class="tile [^"]*"[^>]*data-stat="${key}"[^>]*>([\\s\\S]*?)</\\1>`)); if (!m) return null; const t = (re) => m[2].match(re)?.[1] ?? ''; return { num: t(/<span class="nv">([^<]*)<\/span>/), unit: t(/<small>([^<]*)<\/small>/), cap: t(/<p class="ts">([^<]*)<\/p>/), title: t(/<h3 class="tt">([^<]*)<\/h3>/) }; };
    const want = [
      ['stream', 'FIFA With the Boys', 'fifa-minutes', String(Math.round(epSecs / 60)), 'min'],
      ['games', 'Project Mountaintop', 'log-words', String(Math.round(S.logWords)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f'), 'words'],
      ['games', 'Tiny games', 'engines', String(engines.size), engines.size === 1 ? 'engine' : 'engines'],
    ];
    for (const [id, name, key, num, unit] of want) { const t = tile(cl(id, name), key); if (!t) bad.push(`index.html: stat "${key}" missing from the ${name} cluster`); else if (t.num !== num || t.unit !== unit) bad.push(`index.html: stat "${key}" shows ${t.num} ${t.unit}, the data says ${num} ${unit}`); }
    const eng = tile(cl('games', 'Tiny games'), 'engines'); if (eng && eng.cap.split(', ').length !== engines.size) bad.push('index.html: the engines tile should list every engine');
    const fm = tile(cl('stream', 'Special Force'), 'film-minutes'); const filmSecs = cur.videos.other.filter((o) => o.kind === 'short film').reduce((n, o) => n + sec(vids.find((v) => v.id === o.id).length), 0);
    if (!fm || !fm.cap.endsWith(`, ${Math.round(filmSecs / 60)} minutes`)) bad.push(`index.html: Special Force runtime caption should end with ${Math.round(filmSecs / 60)} minutes (got ${fm?.cap})`);
    if (/class="num[^"]*"[^>]*aria-hidden/.test(home)) bad.push('index.html: a numeral is hidden from screen readers');
    if (S.logWords % 100 !== 0 || S.logWords < 1000) bad.push('stats.mjs: the dev-log word count looks wrong');
  }
  if (/data-cs=/.test(home)) bad.push('index.html: data-cs interleaving is gone (clips go in the Twitch cluster)');
  // each tile's internal destination appears in exactly one cluster
  const owners = {};
  for (const id of ['stream', 'games', 'work']) for (const [n, body] of clusters(home, id)) for (const m of body.matchAll(/<a class="tile [^"]*" href="(\/[^"#]+)"/g)) { if (owners[m[1]] && owners[m[1]] !== n) bad.push(`index.html: ${m[1]} in two clusters`); owners[m[1]] = n; }
}
// the home page follows content/layout.json: the sections in its order with its titles, the clusters in each, every tile at its size and one flex tile per cluster that has one
{
  const got = [...home.matchAll(/<div class="bsec" id="([^"]+)">/g)].map((m) => m[1]);
  if (got.join() !== HOME.sections.map((x) => x.id).join()) bad.push(`index.html: sections should be ${HOME.sections.map((x) => x.id)} (got ${got})`);
  const sizeOf = (cls) => Object.entries(SIZE_CLS).filter(([, c]) => c).reduce((z, [k, c]) => (c.split(' ').every((x) => cls.split(' ').includes(x)) && (z === 'one' || SIZE_CLS[z].length < c.length) ? k : z), 'one');
  for (const sec of HOME.sections) {
    const i = home.indexOf(`<div class="bsec" id="${sec.id}">`), n = home.indexOf('<div class="bsec"', i + 10), body = home.slice(i, n > 0 ? n : undefined);
    if (!body.includes(`<h2>${sec.title.replace(/&/g, '&amp;')}</h2>`)) bad.push(`index.html: #${sec.id} should be titled ${sec.title}`);
    if (/<div class="bento [^"]*">(?!<div class="cl")/.test(body)) bad.push(`index.html: #${sec.id} has tiles outside a cluster`);
    const cls = [...body.matchAll(/<div class="cl" role="group" aria-label="([^"]*)">([\s\S]*?)(?=<div class="cl"|$)/g)];
    if (cls.map((m) => m[1]).join('|') !== sec.clusters.map((c) => c.name).join('|')) { bad.push(`index.html: #${sec.id} clusters should be ${sec.clusters.map((c) => c.name).join(', ')} (got ${cls.map((m) => m[1]).join(', ')})`); continue; }
    sec.clusters.forEach((c, k) => {
      const tiles = [...cls[k][2].matchAll(/<(?:a|div) class="tile ([^"]*)"[^>]*>/g)].map((m) => ({ cls: m[1], flex: /\bdata-flex\b/.test(m[0]) }));
      const own = tiles.filter((x) => !x.flex), flex = tiles.length - own.length;
      if (own.length !== c.tiles.length || flex !== (c.flex ? 1 : 0)) { bad.push(`index.html: cluster ${c.name} should have ${c.tiles.length} tiles${c.flex ? ' and its flex tile' : ''} (got ${own.length} + ${flex})`); return; }
      if (!c.id.startsWith('clips')) c.tiles.forEach((x, j) => { if (sizeOf(own[j].cls) !== x.size) bad.push(`index.html: tile ${x.id} in ${c.name} should be ${x.size} (got ${sizeOf(own[j].cls)})`); });
    });
  }
}
// switcher: header menu with Home and the one portfolio link; the footer row; aria-controls matches; the portfolio href and label appear exactly twice
for (const h of htmls) {
  const t = fs.readFileSync(h, 'utf8'), rel = path.relative(pub, h);
  if (rel === '404.html' || !t.includes('class="xs"')) continue;
  if (!/<a class="xs-logo" href="\/"[^>]*aria-controls="xs-menu"><svg/.test(t) || !/<ul class="xs-menu" id="xs-menu"><li class="xs-hl"><a class="xs-home" href="\/">/.test(t)) bad.push(`${rel}: switcher markup changed`);
  if ((t.match(/class="xs-row"/g) ?? []).length !== 1 || (t.match(/class="xs-foot"/g) ?? []).length !== 1) bad.push(`${rel}: expected one header and one footer portfolio row`);
  if (!/<script src="\/vt\.js\?v=[0-9a-f]+"><\/script>/.test(t)) bad.push(`${rel}: vt.js missing from the head`);
}
// view transitions: a page has at most one [data-hero] and one h1 (names are unique per document); internal tiles carry data-vt; vt.js and the CSS agree on the names
for (const h of htmls) { const t = fs.readFileSync(h, 'utf8'); if ((t.match(/\bdata-hero\b/g) ?? []).length > 1) bad.push(`${path.relative(pub, h)}: more than one data-hero`); }
for (const f of ['games/glass-gunslinger-dod', 'design/southeast-denver-dental', 'work/project-mountaintop/first-steps-week-1-2-recap']) if (!/\bdata-hero\b/.test(fs.readFileSync(path.join(pub, f, 'index.html'), 'utf8'))) bad.push(`${f}: no data-hero`);
for (const m of home.matchAll(/<a class="tile [^"]*" href="(\/[^"]*)"[^>]*>/g)) if (!/data-vt="/.test(m[0]) && !m[1].startsWith('/#') && !m[1].includes('#logs')) bad.push(`index.html: internal tile ${m[1]} has no data-vt`);
{
  const css = fs.readFileSync(path.join(pub, 'base.css'), 'utf8'), vt = fs.readFileSync(path.join(pub, 'vt.js'), 'utf8');
  if (!/@view-transition \{ navigation: auto; \}/.test(css) || !/prefers-reduced-motion: no-preference\) \{\s*@view-transition/.test(css)) bad.push('base.css: @view-transition must be opt-in under no-preference motion');
  for (const n of ['hero-media', 'hero-title']) if (!css.includes(n) || !vt.includes(n)) bad.push(`view transition name ${n} missing from base.css or vt.js`);
  if (/\.style\.cssText|setAttribute\(\s*['"]style|innerHTML/.test(vt)) bad.push('vt.js: CSP-unsafe pattern');
}
const sm = fs.readFileSync(path.join(pub, 'sitemap.xml'), 'utf8');
for (const m of sm.matchAll(/<loc>([^<]+)<\/loc>/g)) { check('sitemap.xml', m[1]); if (/calm|404/.test(m[1])) bad.push(`sitemap.xml: ${m[1]}`); }
if (!/name="robots" content="noindex"/.test(fs.readFileSync(path.join(pub, '404.html'), 'utf8'))) bad.push('404.html: not noindex');
for (const f of ['robots.txt', 'llms.txt', 'rss.xml']) for (const m of fs.readFileSync(path.join(pub, f), 'utf8').matchAll(/https:\/\/halmic\.com(\/[^\s<)"]*)/g)) check(f, m[1]);
if (/calm/.test(fs.readFileSync(path.join(pub, 'llms.txt'), 'utf8'))) bad.push('llms.txt mentions calm');
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`links ok: ${htmls.length} pages`);
