// Checks the built public/ tree: every internal href/src/og:image resolves to a file, no placeholders or draft markers remain,
// sitemap entries exist, the 404 is noindex, and the card layout holds (one link per card, no inline styles, local images only, the removed copy stays removed). Run after `npm run build`. Exits 1 on any problem.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const SITE = 'https://halmic.com';
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const sprite = fs.readFileSync(path.join(pub, 'icons.svg'), 'utf8');
const symbols = new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
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
if ((home.match(/<a class="tile /g) ?? []).length < 20) bad.push('index.html: fewer tiles than expected');
if (/class="[^"]*\b(ey|cb|card|ct|cx)\b/.test(home)) bad.push('index.html: old card/eyebrow markup is back (the home page is bento tiles)');
if (/\b(clip|video)\b/i.test([...home.matchAll(/<span class="chip">[\s\S]*?<\/span><\/span>/g)].map((m) => m[0]).join(''))) bad.push('index.html: a chip says clip/video (platforms are shown by icon)');
for (const m of home.matchAll(/<span class="bdg[^>]*>/g)) if (!/role="img"/.test(m[0]) || !/aria-label="[^"]+"/.test(m[0])) bad.push(`index.html: badge without an accessible name ${m[0].slice(0, 70)}`);
for (const [id, name] of [['tw', 'Twitch'], ['yt', 'YouTube']]) if (!new RegExp(`class="bdg bdg-${id}" role="img" aria-label="${name}"`).test(home)) bad.push(`index.html: no ${name} badge`);
for (const [kind, href, extra] of [['tw', 'https://www.twitch.tv/halmictv', 'id="twitch"'], ['yt', 'https://www.youtube.com/@halmic', ''], ['itch', 'https://halmic.itch.io/', ''], ['dc', 'https://discord.gg/4xvveJ8jS5', 'id="hi"'], ['x', 'https://x.com/halmicc', ''], ['md', 'https://halmic.medium.com/', '']]) {
  const m = home.match(new RegExp(`<a class="tile t-link tl-${kind}[^"]*" href="([^"]+)"[^>]*>`));
  if (!m) bad.push(`index.html: link tile ${kind} missing`);
  else { if (m[1] !== href) bad.push(`index.html: link tile ${kind} points at ${m[1]}`); if (extra && !m[0].includes(extra)) bad.push(`index.html: link tile ${kind} lost ${extra}`); }
}
for (const m of home.matchAll(/<a class="tile [^"]*"[^>]*>([\s\S]*?)<\/a>/g)) if (!/<h3 class="tt">/.test(m[1])) bad.push(`index.html: tile without a title ${m[0].slice(0, 80)}`);
if (!/<h2>Watch<\/h2>/.test(home) || !/<h2>Play<\/h2>/.test(home) || !/<h2>Work<\/h2>/.test(home)) bad.push('index.html: Watch / Play / Work bentos expected');
if (/<h2>(Clips|Videos)<\/h2>/.test(home)) bad.push('index.html: separate Clips / Videos groups are back (one Watch bento)');
for (const t of ['watch', 'play', 'work', 'say hi']) if (!home.includes(`<span>${t}</span>`)) bad.push(`index.html: nav item "${t}" missing`);
if (!home.includes('href="/#stream"')) bad.push('index.html: nav should point at #stream');
if (!home.includes('href="/#work"') || /href="\/#design"/.test(home)) bad.push('index.html: nav should point at #work (#design stays as an anchor alias)');
if (!home.includes('id="design"')) bad.push('index.html: #design alias missing');
const sedd = fs.readFileSync(path.join(pub, 'design/southeast-denver-dental/index.html'), 'utf8');
if (!/<video\b[^>]*data-loop/.test(sedd) || !sedd.includes('Footage from the')) bad.push('design/southeast-denver-dental: in-use loop or its caption missing');
if (!/media-src 'self'/.test(fs.readFileSync(path.join(pub, '_headers'), 'utf8'))) bad.push('_headers: media-src should be self');
for (const e of ['webm', 'mp4']) if (fs.statSync(path.join(pub, `work/southeast-denver-dental-inuse.${e}`)).size > 900 * 1024) bad.push(`dental loop .${e} is over 900 KB`);
const px = fs.readFileSync(path.join(pub, 'work/pokemon-phoenix-rising/index.html'), 'utf8');
if (!/Videos by <a href="https:\/\/www\.youtube\.com\/@PhoenixRisingGame"/.test(px) || (px.match(/data-vid="/g) ?? []).length < 2) bad.push('work/pokemon-phoenix-rising: channel credit or videos missing');
const mtDir = path.join(pub, 'work/project-mountaintop');
const mtHome = fs.readFileSync(path.join(mtDir, 'index.html'), 'utf8');
if (!/data-vid="Gv-xMeMM8m4"/.test(mtHome) || !mtHome.includes('youtube-nocookie.com/embed/Gv-xMeMM8m4')) bad.push('work/project-mountaintop: main video missing');
const mtLogLinks = [...mtHome.matchAll(/<a class="card[^"]*" href="(\/work\/project-mountaintop\/[^"]+)"/g)].map((m) => m[1]);
if (mtLogLinks.length < 6) bad.push(`work/project-mountaintop: expected 6 dev-log cards, found ${mtLogLinks.length}`);
for (const l of mtLogLinks) { const h = fs.readFileSync(path.join(pub, l, 'index.html'), 'utf8'); if (!/<article class="log">/.test(h) || !/"@type":"BlogPosting"/.test(h)) bad.push(`${l}: not a dev-log article with BlogPosting JSON-LD`); }
for (const f of walk(mtDir).filter((x) => x.endsWith('.html'))) { const h = fs.readFileSync(f, 'utf8'); if (/<iframe/.test(h)) bad.push(`${path.relative(pub, f)}: pre-loaded iframe (embeds must be click-to-load)`); }
if (!/<a class="tile [^"]*" href="\/work\/project-mountaintop\/"/.test(home)) bad.push('index.html: Project Mountaintop tile missing from Work');
const games = fs.readFileSync(path.join(pub, 'games/index.html'), 'utf8');
const gOrder = [...games.matchAll(/<a class="tile [^"]*" href="\/games\/([^/"]+)\//g)].map((m) => m[1]);
if (gOrder[0] !== 'glass-gunslinger-dod' || gOrder[1] !== 'lvasion-du-criminel-de-sa-prison') bad.push(`games/index.html: featured games should come first (got ${gOrder.slice(0, 2)})`);
for (const f of ['games/index.html', 'videos/index.html', 'design/index.html']) { const h = fs.readFileSync(path.join(pub, f), 'utf8'); if (/class="[^"]*\b(ey|cb)\b/.test(h)) bad.push(`${f}: eyebrow/card markup on an index page`); if (!/class="bento /.test(h)) bad.push(`${f}: bento expected`); }
if ((games.match(/class="tile tm tg lead w2"/g) ?? []).length !== 1) bad.push('games/index.html: expected exactly one lead game tile');
const sm = fs.readFileSync(path.join(pub, 'sitemap.xml'), 'utf8');
for (const m of sm.matchAll(/<loc>([^<]+)<\/loc>/g)) { check('sitemap.xml', m[1]); if (/calm|404/.test(m[1])) bad.push(`sitemap.xml: ${m[1]}`); }
if (!/name="robots" content="noindex"/.test(fs.readFileSync(path.join(pub, '404.html'), 'utf8'))) bad.push('404.html: not noindex');
for (const f of ['robots.txt', 'llms.txt', 'rss.xml']) for (const m of fs.readFileSync(path.join(pub, f), 'utf8').matchAll(/https:\/\/halmic\.com(\/[^\s<)"]*)/g)) check(f, m[1]);
if (/calm/.test(fs.readFileSync(path.join(pub, 'llms.txt'), 'utf8'))) bad.push('llms.txt mentions calm');
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`links ok: ${htmls.length} pages`);
