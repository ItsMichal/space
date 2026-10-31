// What the halmic CMS may write, checked before anything is copied into the build (scripts/content/validate.mjs) and by the editor
// in space-content before it opens a pull request. Pure and dependency-free: each check takes parsed files plus what it must agree
// with (video ids, game slugs, media files) and returns a list of problems; an empty list means the file is fine.
// The editable files: layout.json (layout.mjs), curation.json, posts.json, mountaintop/index.json and the dev logs (mountaintop/*.md).
// Everything else (videos.json from the YouTube sync, games.json from itch.io, phoenix-rising.json) stays in the space repo.
import { md, frontMatter } from './md.mjs';
import { model } from './bentos.mjs';
import { parseLayout, resolve, LayoutError } from './layout.mjs';

export const RULES = { maxPosts: 24, maxText: 1000, maxLine: 300, maxAlt: 400, maxTitle: 80, maxMediaKB: 200, maxImagePx: 4000, maxLogBytes: 64 * 1024, maxLogs: 24 };
export const POST_KINDS = ['web', 'game', 'hardware', 'design', 'video', 'music'];
export const GAME_TIERS = ['feature', 'more', 'off'];
export const VIDEO_KINDS = ['short film', 'highlight reel', 'onboard lap', 'video'];
const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const VID = /^[A-Za-z0-9_-]{11}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MEDIA = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(webp|jpg|png)$/;

const checker = (problems) => {
  const p = (m) => problems.push(m);
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  return {
    p, isObj,
    obj: (v, w) => (isObj(v) ? true : (p(`${w} must be an object`), false)),
    keys: (o, allowed, w) => { for (const k of Object.keys(o)) if (!allowed.includes(k)) p(`${w}: unknown field "${k}"`); },
    str: (v, w, max, { optional = false, min = 1 } = {}) => {
      if (v === undefined && optional) return;
      if (typeof v !== 'string' || v.trim().length < min || v.length > max || CTRL.test(v)) p(`${w} must be text of ${min} to ${max} characters`);
    },
    date: (v, w) => { if (typeof v !== 'string' || !DATE.test(v) || Number.isNaN(Date.parse(v))) p(`${w} must be a date like 2024-05-01`); },
    int: (v, w, lo, hi) => { if (!Number.isInteger(v) || v < lo || v > hi) p(`${w} must be a whole number from ${lo} to ${hi}`); },
    oneOf: (v, list, w) => { if (!list.includes(v)) p(`${w} must be one of ${list.join(', ')}`); },
  };
};

// posts.json: the Posts bento. ctx.media: { [file name]: size in bytes } of the post images that will ship.
export function checkPosts(j, { media = {} } = {}) {
  const problems = [], c = checker(problems);
  if (!c.obj(j, 'posts.json')) return problems;
  c.keys(j, ['_note', 'posts'], 'posts.json');
  if (!Array.isArray(j.posts) || j.posts.length > RULES.maxPosts) return [...problems, `posts.json: posts must be a list of at most ${RULES.maxPosts}`];
  const seen = new Set();
  j.posts.forEach((x, i) => {
    const w = `posts[${i}]`;
    if (!c.obj(x, w)) return;
    c.keys(x, ['id', 'url', 'date', 'text', 'kind', 'media', 'video', 'w', 'h', 'alt'], w);
    if (typeof x.id !== 'string' || !/^\d{1,25}$/.test(x.id)) c.p(`${w}.id must be the post's number`);
    else if (seen.has(x.id)) c.p(`${w}: post ${x.id} is listed twice`);
    seen.add(x.id);
    if (typeof x.url !== 'string' || !new RegExp(`^https://x\\.com/[A-Za-z0-9_]{1,15}/status/${x.id}$`).test(x.url)) c.p(`${w}.url must be https://x.com/<account>/status/${x.id}`);
    c.date(x.date, `${w}.date`);
    c.str(x.text, `${w}.text`, RULES.maxText);
    c.oneOf(x.kind, POST_KINDS, `${w}.kind`);
    if (x.video !== undefined && typeof x.video !== 'boolean') c.p(`${w}.video must be true or false`);
    if (x.media === undefined) { for (const k of ['video', 'w', 'h', 'alt']) if (x[k] !== undefined) c.p(`${w}.${k} only goes with media`); return; }
    if (typeof x.media !== 'string' || !MEDIA.test(x.media)) { c.p(`${w}.media must be a file name like post-2024-thing.webp`); return; }
    if (!Object.hasOwn(media, x.media)) c.p(`${w}.media: ${x.media} is not in the post images`);
    else if (media[x.media] > RULES.maxMediaKB * 1024) c.p(`${w}.media: ${x.media} is over ${RULES.maxMediaKB} KB`);
    c.int(x.w, `${w}.w`, 1, RULES.maxImagePx); c.int(x.h, `${w}.h`, 1, RULES.maxImagePx);
    c.str(x.alt, `${w}.alt`, RULES.maxAlt);
  });
  return problems;
}

// curation.json: which games show and how, the FIFA series, the other videos, the Smash sets. ctx: videoIds (published, not excluded) and gameSlugs.
export function checkCuration(j, { videoIds = [], gameSlugs = [] } = {}) {
  const problems = [], c = checker(problems);
  if (!c.obj(j, 'curation.json')) return problems;
  c.keys(j, ['_note', 'games', 'videos'], 'curation.json');
  const vids = new Set(videoIds);
  const vid = (v, w) => { if (typeof v !== 'string' || !VID.test(v)) c.p(`${w} must be a YouTube video id`); else if (!vids.has(v)) c.p(`${w}: video ${v} is not on the channel (or is excluded)`); };
  if (c.obj(j.games, 'games')) for (const [slug, g] of Object.entries(j.games)) {
    const w = `games.${slug}`;
    if (!gameSlugs.includes(slug)) c.p(`${w}: no game with that slug`);
    if (!c.obj(g, w)) continue;
    c.keys(g, ['tier', 'line', 'alt'], w);
    c.oneOf(g.tier, GAME_TIERS, `${w}.tier`);
    c.str(g.line, `${w}.line`, RULES.maxLine, { optional: true });
    c.str(g.alt, `${w}.alt`, RULES.maxAlt, { optional: true });
  }
  if (!c.obj(j.videos, 'videos')) return problems;
  const v = j.videos;
  c.keys(v, ['series', 'other', 'smash'], 'videos');
  if (c.obj(v.series, 'videos.series')) {
    c.keys(v.series, ['title', 'line', 'playlist', 'episodes'], 'videos.series');
    c.str(v.series.title, 'videos.series.title', RULES.maxTitle); c.str(v.series.line, 'videos.series.line', RULES.maxLine);
    if (typeof v.series.playlist !== 'string' || !/^PL[A-Za-z0-9_-]{10,64}$/.test(v.series.playlist)) c.p('videos.series.playlist must be a YouTube playlist id');
    if (!Array.isArray(v.series.episodes) || !v.series.episodes.length || v.series.episodes.length > 12) c.p('videos.series.episodes must list 1 to 12 videos');
    else { v.series.episodes.forEach((id, i) => vid(id, `videos.series.episodes[${i}]`)); if (new Set(v.series.episodes).size !== v.series.episodes.length) c.p('videos.series.episodes lists a video twice'); }
  }
  if (!Array.isArray(v.other) || v.other.length > 24) c.p('videos.other must be a list of at most 24');
  else {
    v.other.forEach((o, i) => {
      const w = `videos.other[${i}]`;
      if (!c.obj(o, w)) return;
      c.keys(o, ['id', 'name', 'group', 'thumbFit', 'kind', 'desc'], w);
      vid(o.id, `${w}.id`);
      c.oneOf(o.kind, VIDEO_KINDS, `${w}.kind`);
      c.str(o.name, `${w}.name`, RULES.maxTitle, { optional: true }); c.str(o.group, `${w}.group`, RULES.maxTitle, { optional: true });
      c.str(o.desc, `${w}.desc`, RULES.maxText, { optional: true });
      if (o.thumbFit !== undefined) c.oneOf(o.thumbFit, ['contain', 'cover'], `${w}.thumbFit`);
    });
    const ids = v.other.map((o) => o?.id);
    if (new Set(ids).size !== ids.length) c.p('videos.other lists a video twice');
    // the Watch bento leads with two short films (the lead and its satellite)
    if (v.other.filter((o) => o?.kind === 'short film').length < 2) c.p('videos.other needs at least two short films (they lead Watch)');
  }
  if (c.obj(v.smash, 'videos.smash')) {
    c.keys(v.smash, ['line', 'credit', 'sets'], 'videos.smash');
    c.str(v.smash.line, 'videos.smash.line', RULES.maxLine); c.str(v.smash.credit, 'videos.smash.credit', RULES.maxLine);
    if (!Array.isArray(v.smash.sets) || v.smash.sets.length > 24) c.p('videos.smash.sets must be a list of at most 24');
    else v.smash.sets.forEach((s, i) => {
      const w = `videos.smash.sets[${i}]`;
      if (!c.obj(s, w)) return;
      c.keys(s, ['id', 'event', 'round', 'opp', 'date'], w);
      if (typeof s.id !== 'string' || !VID.test(s.id)) c.p(`${w}.id must be a YouTube video id`);
      for (const k of ['event', 'round', 'opp', 'date']) c.str(s[k], `${w}.${k}`, RULES.maxTitle);
    });
  }
  return problems;
}

// mountaintop/index.json and the dev logs. ctx.logs: { [slug]: markdown text }, ctx.intro: project.md, ctx.images: { [file]: bytes }
// of the images that will ship, ctx.thumbs: video ids that have a poster in public/videos.
export function checkMountaintop(j, { logs = {}, intro = '', images = {}, thumbs = [] } = {}) {
  const problems = [], c = checker(problems);
  if (!c.obj(j, 'mountaintop/index.json')) return problems;
  c.keys(j, ['_note', 'title', 'role', 'hook', 'line', 'cover', 'coverAlt', 'video', 'videoPublished', 'logs', 'images', 'videos'], 'mountaintop/index.json');
  for (const k of ['title', 'role']) c.str(j[k], k, RULES.maxTitle);
  for (const k of ['hook', 'line']) c.str(j[k], k, RULES.maxLine);
  c.str(j.coverAlt, 'coverAlt', RULES.maxAlt);
  c.date(j.videoPublished, 'videoPublished');
  const imgs = c.isObj(j.images) ? j.images : (c.p('images must be an object'), {});
  for (const [f, d] of Object.entries(imgs)) {
    if (!MEDIA.test(f)) c.p(`images: ${f} is not a file name like week-3.webp`);
    else if (!Object.hasOwn(images, f)) c.p(`images: ${f} is not in the Mountaintop images`);
    else if (images[f] > RULES.maxMediaKB * 1024 * 2) c.p(`images: ${f} is over ${RULES.maxMediaKB * 2} KB`);
    if (!c.isObj(d)) { c.p(`images.${f} must be { w, h }`); continue; }
    c.keys(d, ['w', 'h'], `images.${f}`); c.int(d.w, `images.${f}.w`, 1, RULES.maxImagePx); c.int(d.h, `images.${f}.h`, 1, RULES.maxImagePx);
  }
  const img = (f, w) => { if (!Object.hasOwn(imgs, f)) c.p(`${w}: ${f} is not listed in images`); };
  img(j.cover, 'cover');
  const vids = c.isObj(j.videos) ? j.videos : (c.p('videos must be an object'), {});
  for (const [id, title] of Object.entries(vids)) {
    if (!VID.test(id)) c.p(`videos: ${id} is not a YouTube video id`);
    else if (!thumbs.includes(id)) c.p(`videos: ${id} has no poster image in the site yet (public/videos/${id}.jpg)`);
    c.str(title, `videos.${id}`, RULES.maxLine);
  }
  if (!Object.hasOwn(vids, j.video)) c.p('video must be one of the listed videos');
  // the markdown renderer escapes all text; what it cannot check is that every image and video it points at exists
  const render = (text, w) => {
    try {
      md(text, { img: (src) => { img(src, w); return { src, width: 1, height: 1 }; }, youtube: (id) => { if (!Object.hasOwn(vids, id)) c.p(`${w}: video ${id} is not listed in videos`); return ''; } });
    } catch (e) { c.p(`${w}: could not be read (${e.message})`); }
  };
  render(intro, 'project.md');
  if (!Array.isArray(j.logs) || !j.logs.length || j.logs.length > RULES.maxLogs) return [...problems, `logs must list 1 to ${RULES.maxLogs} dev logs`];
  const slugs = new Set(), orders = new Set();
  j.logs.forEach((l, i) => {
    const w = `logs[${i}]`;
    if (!c.obj(l, w)) return;
    c.keys(l, ['slug', 'hero', 'heroAlt'], w);
    if (typeof l.slug !== 'string' || !SLUG.test(l.slug) || l.slug.length > 80) return c.p(`${w}.slug must be lowercase words joined by dashes`);
    if (slugs.has(l.slug)) c.p(`${w}: ${l.slug} is listed twice`);
    slugs.add(l.slug);
    img(l.hero, `${w}.hero`); c.str(l.heroAlt, `${w}.heroAlt`, RULES.maxAlt);
    const text = logs[l.slug], f = `mountaintop/${l.slug}.md`;
    if (typeof text !== 'string') return c.p(`${f} is missing`);
    if (new TextEncoder().encode(text).length > RULES.maxLogBytes) return c.p(`${f} is over ${RULES.maxLogBytes / 1024} KB`);
    if (!/^---\n[\s\S]*?\n---\n/.test(text)) return c.p(`${f} must start with front matter between --- lines`);
    const { meta, body } = frontMatter(text);
    for (const k of Object.keys(meta)) if (!['title', 'slug', 'date', 'updated', 'description', 'order'].includes(k)) c.p(`${f}: unknown front matter "${k}"`);
    c.str(meta.title, `${f} title`, RULES.maxTitle); c.str(meta.description, `${f} description`, RULES.maxLine);
    if (meta.slug !== l.slug) c.p(`${f}: slug in the front matter must be ${l.slug}`);
    c.date(meta.date, `${f} date`);
    if (meta.updated !== undefined) c.date(meta.updated, `${f} updated`);
    if (!/^\d{1,3}$/.test(meta.order ?? '')) c.p(`${f}: order must be a number`);
    else if (orders.has(meta.order)) c.p(`${f}: another log already has order ${meta.order}`);
    orders.add(meta.order);
    render(body, f);
  });
  for (const s of Object.keys(logs)) if (!slugs.has(s)) c.p(`mountaintop/${s}.md is not listed in logs`);
  return problems;
}

// layout.json against the model the rest of the content makes: the same problems the build would refuse to ship with
export function checkLayout(text, content) {
  try { return resolve(model(content), parseLayout(text)).problems; } catch (e) { if (e instanceof LayoutError) return [e.message.replace(/^layout\.json: /, '')]; throw e; }
}
