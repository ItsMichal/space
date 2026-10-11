// Build-time sync of the public YouTube feed into halmic/content/videos.json (+ local thumbnails).
// No API key: uses https://www.youtube.com/feeds/videos.xml?channel_id=... (latest ~15 videos only).
// The full back catalogue needs the YouTube Data API or a hand-kept list (see content/videos.manual.json).
// Network failure never breaks the build: the last good videos.json and thumbnails are kept.
// Identity rule: any entry whose title/description matches content/identity-denylist.txt is held back
// (written to videos.held.json for the owner to review) and is not published.
//   usage: node halmic/scripts/sync-youtube.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHANNEL = 'UC8_ZatxbG4ZZyG0S4Uz1G3g';
const FEED = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL}`;
const contentDir = path.join(root, 'content');
const outFile = path.join(contentDir, 'videos.json');
const heldFile = path.join(contentDir, 'videos.held.json');
const thumbDir = path.join(root, 'site', 'public', 'videos');
fs.mkdirSync(contentDir, { recursive: true });
fs.mkdirSync(thumbDir, { recursive: true });

const deny = fs.existsSync(path.join(contentDir, 'identity-denylist.txt'))
  ? fs.readFileSync(path.join(contentDir, 'identity-denylist.txt'), 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#')).map((s) => new RegExp(s, 'i'))
  : [];

const curl = async (url, opts = []) => (await run('curl', ['-sfL', '-m', '25', ...opts, url], { encoding: 'buffer', maxBuffer: 20e6 })).stdout;
const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? unesc(m[1].trim()) : ''; };

function parse(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
    const desc = tag(e, 'media:description');
    return {
      id: tag(e, 'yt:videoId'),
      title: tag(e, 'title'),
      published: tag(e, 'published'),
      description: desc,
      excerpt: desc.replace(/\s+/g, ' ').slice(0, 180),
      views: +(e.match(/<media:statistics views="(\d+)"/)?.[1] ?? 0),
      url: `https://www.youtube.com/watch?v=${tag(e, 'yt:videoId')}`,
      thumb: `/videos/${tag(e, 'yt:videoId')}.jpg`,
    };
  });
}

async function thumbs(list) {
  let sharp = null;
  try { sharp = (await import('sharp')).default; } catch { /* optional: keep the original jpg */ }
  for (const v of list) {
    const file = path.join(thumbDir, `${v.id}.jpg`);
    if (fs.existsSync(file)) continue;
    try {
      const buf = await curl(`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`);
      const out = sharp ? await sharp(buf).resize({ width: 640 }).jpeg({ quality: 72, mozjpeg: true }).toBuffer() : buf;
      fs.writeFileSync(file, out);
    } catch (e) { console.warn('thumbnail failed', v.id, e.message); }
  }
}

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(contentDir, f), 'utf8')); } catch { return d; } };
try {
  const xml = (await curl(FEED)).toString('utf8');
  const feed = parse(xml);
  if (!feed.length) throw new Error('empty feed');
  const exclude = new Set(readJson('videos.exclude.json', { ids: [] }).ids);
  const manual = readJson('videos.manual.json', { videos: [] }).videos;
  // merge: the feed wins (it has dates and descriptions); the hand-kept list adds what the feed (latest ~15) no longer returns
  const byId = new Map(feed.map((v) => [v.id, v]));
  for (const m of manual) if (!byId.has(m.id)) byId.set(m.id, { id: m.id, title: m.title, published: null, ago: m.ago ?? null, length: m.length ?? null, description: '', excerpt: '', views: 0, url: `https://www.youtube.com/watch?v=${m.id}`, thumb: `/videos/${m.id}.jpg`, group: m.group ?? null });
  for (const m of manual) { const v = byId.get(m.id); if (v) { v.length ??= m.length ?? null; v.ago ??= m.ago ?? null; v.group ??= m.group ?? null; } }
  const all = [...byId.values()].filter((v) => !exclude.has(v.id));
  // identity rule: an entry whose own description would print the owner's real name is published with its description blanked
  // (title only); the id and reason go to videos.held.json for the owner to review. A title that matches is dropped entirely.
  const held = [];
  const ok = all.filter((v) => {
    if (deny.some((r) => r.test(v.title))) { held.push({ id: v.id, title: v.title, reason: 'title' }); return false; }
    if (deny.some((r) => r.test(v.description))) { held.push({ id: v.id, title: v.title, reason: 'description blanked' }); v.description = ''; v.excerpt = ''; v.descriptionHeld = true; }
    return true;
  });
  await thumbs(ok);
  for (const f of fs.readdirSync(thumbDir)) if (f.endsWith('.jpg') && exclude.has(f.slice(0, -4))) fs.rmSync(path.join(thumbDir, f));   // drop cached thumbnails of excluded videos
  fs.writeFileSync(outFile, JSON.stringify({ channel: CHANNEL, channelUrl: 'https://www.youtube.com/@halmic', fetched: new Date().toISOString(), videos: ok }, null, 2) + '\n');
  fs.writeFileSync(heldFile, JSON.stringify(held, null, 2) + '\n');
  console.log(`youtube: ${ok.length} videos written (${manual.length} hand-kept, ${exclude.size} excluded), ${held.length} flagged for review`);
} catch (e) {
  console.warn('youtube sync failed, keeping last good file:', e.message);
  if (!fs.existsSync(outFile)) { fs.writeFileSync(outFile, JSON.stringify({ channel: CHANNEL, channelUrl: 'https://www.youtube.com/@halmic', fetched: null, videos: [] }, null, 2) + '\n'); }
}
