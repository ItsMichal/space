// Build-time sync of the public itch.io profile into halmic/content/games.json (+ local cover images).
// itch has no keyless API for a profile, so this parses the public HTML defensively (regex, no dependencies)
// and keeps the last good data when anything fails or the page layout changes.
//   usage: node halmic/scripts/sync-itch.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE = 'https://halmic.itch.io/';
const outFile = path.join(root, 'content', 'games.json');
const coverDir = path.join(root, 'site', 'public', 'games');
fs.mkdirSync(coverDir, { recursive: true });

const curl = async (url) => (await run('curl', ['-sfL', '-m', '25', '-A', 'Mozilla/5.0 (halmic site build)', url], { encoding: 'buffer', maxBuffer: 30e6 })).stdout;
const text = (x) => x.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#0?39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const slug = (u) => u.replace(/^https:\/\/halmic\.itch\.io\//, '').replace(/\/$/, '');

function parseProfile(html) {
  const cells = html.split(/<div[^>]*?data-game_id="/).slice(1);
  return cells.map((c) => {
    const href = c.match(/href="(https:\/\/halmic\.itch\.io\/[^"]+)"/)?.[1];
    const title = c.match(/class="title game_link"[^>]*>([^<]+)/)?.[1];
    const img = c.match(/data-lazy_src="([^"]+)"/)?.[1] ?? c.match(/<img[^>]*src="(https:\/\/img\.itch\.zone[^"]+)"/)?.[1];
    const blurb = c.match(/class="game_text"[^>]*>([^<]*)</)?.[1];
    if (!href || !title) return null;
    return { slug: slug(href), url: href, title: text(title), blurb: blurb ? text(blurb) : '', cover: img ?? null, playInBrowser: /Play in browser/.test(c) };
  }).filter(Boolean);
}
function parseGame(html) {
  const info = {};
  for (const m of html.matchAll(/<tr><td>([^<]+)<\/td><td>([\s\S]*?)<\/td><\/tr>/g)) info[text(m[1])] = text(m[2]);
  const desc = html.match(/class="formatted_description user_formatted">([\s\S]*?)<\/div>/)?.[1];
  return {
    status: info.Status ?? null, madeWith: info['Made with'] ?? null, genre: info.Genre ?? null, tags: info.Tags ? info.Tags.split(',').map((t) => t.trim()) : [],
    rating: info.Rating ?? null,
    jam: [...html.matchAll(/<a[^>]*href="https:\/\/itch\.io\/jam\/[^"]*"[^>]*>([^<]+)<\/a>/g)].map((m) => text(m[1]))[0] ?? null,
    published: html.match(/<abbr title="([^"]+)"/)?.[1] ?? null,
    description: desc ? text(desc).slice(0, 600) : '',
  };
}

try {
  const games = parseProfile((await curl(PROFILE)).toString('utf8'));
  if (!games.length) throw new Error('no games parsed (layout changed?)');
  for (const g of games) {
    try { Object.assign(g, parseGame((await curl(g.url)).toString('utf8'))); } catch (e) { console.warn('detail failed', g.slug, e.message); }
    if (g.cover) {
      const candidates = [g.cover.replace(/\/\d+x\d+(%23c|#c)\//, '/original/'), g.cover];   // full-size first, the 315x250 thumb as fallback
      const file = path.join(coverDir, `${g.slug}.jpg`);
      try {
        let sharp = null; try { sharp = (await import('sharp')).default; } catch { /* optional */ }
        let buf = null;
        for (const u of candidates) { try { buf = await curl(u); break; } catch { /* next */ } }
        if (!buf) throw new Error('no cover reachable');
        fs.writeFileSync(file, sharp ? await sharp(buf).resize({ width: 640, height: 508, fit: 'cover' }).jpeg({ quality: 78, mozjpeg: true }).toBuffer() : buf);   // first frame of gifs
        g.coverLocal = `/games/${g.slug}.jpg`;
      } catch (e) { console.warn('cover failed', g.slug, e.message); if (fs.existsSync(file)) g.coverLocal = `/games/${g.slug}.jpg`; }
    }
  }
  fs.writeFileSync(outFile, JSON.stringify({ profile: PROFILE, fetched: new Date().toISOString(), games }, null, 2) + '\n');
  console.log(`itch: ${games.length} games written`);
} catch (e) {
  console.warn('itch sync failed, keeping last good file:', e.message);
  if (!fs.existsSync(outFile)) fs.writeFileSync(outFile, JSON.stringify({ profile: PROFILE, fetched: null, games: [] }, null, 2) + '\n');
}
