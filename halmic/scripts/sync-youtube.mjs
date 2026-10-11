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

try {
  const xml = (await curl(FEED)).toString('utf8');
  const all = parse(xml);
  if (!all.length) throw new Error('empty feed');
  const held = all.filter((v) => deny.some((r) => r.test(v.title + ' ' + v.description)));
  const ok = all.filter((v) => !held.includes(v));
  await thumbs(ok);
  fs.writeFileSync(outFile, JSON.stringify({ channel: CHANNEL, channelUrl: 'https://www.youtube.com/@halmic', fetched: new Date().toISOString(), videos: ok }, null, 2) + '\n');
  fs.writeFileSync(heldFile, JSON.stringify(held.map(({ id, title }) => ({ id, title })), null, 2) + '\n');
  console.log(`youtube: ${ok.length} videos written, ${held.length} held for review`);
} catch (e) {
  console.warn('youtube sync failed, keeping last good file:', e.message);
  if (!fs.existsSync(outFile)) { fs.writeFileSync(outFile, JSON.stringify({ channel: CHANNEL, channelUrl: 'https://www.youtube.com/@halmic', fetched: null, videos: [] }, null, 2) + '\n'); }
}
