#!/usr/bin/env node
// npm run content:check: validate the halmic content the CMS edits (content-rules.mjs) and scan it with the identity denylist.
//
//   node scripts/content/validate.mjs                 the content in this repo (content/, public/posts, public/work/mountaintop)
//   node scripts/content/validate.mjs --from <dir>    a space-content halmic/ folder, before content:pull copies it:
//                                                      layout.json, curation.json, posts.json, posts/<image>, mountaintop/{index.json,*.md,images/<image>}
// What the edits must agree with (videos.json, games.json, phoenix-rising.json, the video posters) is always read from this repo.
// Exits 1 with every problem listed. Files are read only if they are regular files (a symlink could point anywhere on the machine).
import fs from 'node:fs';
import path from 'node:path';
import { checkPosts, checkCuration, checkMountaintop, checkLayout } from '../../content-rules.mjs';
import { scanContent } from '../../../../scripts/identity-lib.mjs';

const app = path.resolve(import.meta.dirname, '..', '..');
const root = path.resolve(app, '..', '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const from = arg('--from') ? path.resolve(arg('--from')) : null;
const SOURCE = (dir) => ({
  layout: path.join(dir, 'layout.json'), curation: path.join(dir, 'curation.json'), posts: path.join(dir, 'posts.json'), postMedia: path.join(dir, 'posts'),
  mt: path.join(dir, 'mountaintop'), mtImages: path.join(dir, 'mountaintop', 'images'),
});
const src = from ? SOURCE(from) : {
  layout: path.join(app, 'content/layout.json'), curation: path.join(app, 'content/curation.json'), posts: path.join(app, 'content/posts.json'), postMedia: path.join(app, 'public/posts'),
  mt: path.join(app, 'content/mountaintop'), mtImages: path.join(app, 'public/work/mountaintop'),
};
const problems = [];
const where = (f) => path.relative(from ?? app, f);
const regular = (f) => { const s = fs.lstatSync(f, { throwIfNoEntry: false }); if (s && !s.isFile()) problems.push(`${where(f)} is not a regular file`); return !!s?.isFile(); };
const text = (f, fallback) => (regular(f) ? fs.readFileSync(f, 'utf8') : fallback === undefined ? (problems.push(`${where(f)} is missing`), null) : fallback);
const json = (f) => { const t = text(f); if (t === null) return null; try { return JSON.parse(t); } catch (e) { problems.push(`${where(f)}: not JSON (${e.message})`); return null; } };
const files = (d, re) => {
  const out = {};
  if (!fs.existsSync(d)) return out;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.') || (e.isDirectory() && path.join(d, e.name) === src.mtImages)) continue;
    const f = path.join(d, e.name);
    if (!re.test(e.name)) { if (from) problems.push(`${where(f)}: unexpected file`); continue; }
    if (regular(f)) out[e.name] = fs.statSync(f).size;
  }
  return out;
};
const repo = (p) => JSON.parse(fs.readFileSync(path.join(app, 'content', p), 'utf8'));

if (from && !fs.existsSync(from)) { console.error(`content: ${from} does not exist`); process.exit(1); }
const videos = repo('videos.json'), exclude = repo('videos.exclude.json'), games = repo('games.json'), phoenix = repo('phoenix-rising.json');
const out = new Set(exclude.ids);
const videoIds = videos.videos.filter((v) => !out.has(v.id)).map((v) => v.id);
const thumbs = fs.readdirSync(path.join(app, 'public/videos')).filter((f) => /^[\w-]{11}\.jpg$/.test(f)).map((f) => f.slice(0, -4));

const curation = json(src.curation), posts = json(src.posts), mt = json(path.join(src.mt, 'index.json'));
const media = files(src.postMedia, /\.(webp|jpg|png)$/);
const images = files(src.mtImages, /\.(webp|jpg|png)$/);
const md = Object.keys(files(src.mt, /^(index\.json|[a-z0-9-]+\.md)$/)).filter((f) => f.endsWith('.md'));
const logs = Object.fromEntries(md.filter((f) => f !== 'project.md').map((f) => [f.slice(0, -3), text(path.join(src.mt, f))]));
const intro = text(path.join(src.mt, 'project.md'));
const layoutText = text(src.layout, '{ "version": 1 }');

const at = (f, list) => problems.push(...list.map((x) => (x.startsWith(f) || x.startsWith('mountaintop/') ? x : `${f}: ${x}`)));
if (posts) at('posts.json', checkPosts(posts, { media }));
const curP = curation ? checkCuration(curation, { videoIds, gameSlugs: games.games.map((g) => g.slug) }) : ['missing'];
if (curation) at('curation.json', curP);
if (mt) at('mountaintop/index.json', checkMountaintop(mt, { logs, intro: intro ?? '', images, thumbs }));
// the layout is checked against the content it will be built with; it cannot be judged while that content is broken
if (curation && posts && mt && !curP.length) at('layout.json', checkLayout(layoutText, { videos, exclude, curation, games, posts, mountaintop: mt, phoenix }));

// identity: the same denylist and rule as the build output check (scripts/check-identity.mjs), over every text file the CMS can change
const deny = fs.readFileSync(path.join(root, 'scripts/identity-denylist.txt'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((p) => new RegExp(p, 'i'));
const scanned = [src.layout, src.curation, src.posts, path.join(src.mt, 'index.json'), ...md.map((f) => path.join(src.mt, f))].filter((f) => fs.existsSync(f) && fs.lstatSync(f).isFile());
for (const f of scanned) for (const h of scanContent(fs.readFileSync(f, 'utf8'), deny)) problems.push(`${where(f)}:${h.line}: a denied identity pattern matched (see scripts/check-identity.mjs)`);
for (const n of [...Object.keys(media), ...Object.keys(images), ...md]) for (const re of deny) if (re.test(n)) problems.push(`${n}: the file name matches a denied identity pattern`);

if (problems.length) { console.error(`halmic content: ${problems.length} problem${problems.length === 1 ? '' : 's'}\n  ${problems.join('\n  ')}`); process.exit(1); }
console.log(`halmic content ok: ${posts.posts.length} posts, ${Object.keys(logs).length} dev logs, ${Object.keys(media).length + Object.keys(images).length} images${from ? ` (from ${from})` : ''}`);
