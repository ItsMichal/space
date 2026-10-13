// Numbers shown on the home page's stat tiles, derived from the content files. build.mjs renders them and scripts/check-links.mjs re-derives them
// from the files to prove the built tiles still agree. Nothing here is typed in; a number with no data behind it does not exist.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { frontMatter } from './md.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const json = (p) => JSON.parse(fs.readFileSync(path.join(here, p), 'utf8'));
export const THIN = ' ';   // narrow no-break space: the thousands separator
export const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, THIN);
const secs = (len) => String(len).split(':').reduce((n, p) => n * 60 + +p, 0);
export const minutes = (len) => Math.round(secs(len) / 60);

// words of prose in a markdown body: image lines, callout fences, code blocks and link targets do not count
export const wordCount = (md) => md.replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\]\([^)]*\)/g, ' ').replace(/^:::.*$/gm, ' ')
  .split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export function homeStats() {
  const cur = json('./content/curation.json'), vids = json('./content/videos.json').videos, exclude = new Set(json('./content/videos.exclude.json').ids);
  const byId = Object.fromEntries(vids.filter((v) => !exclude.has(v.id)).map((v) => [v.id, v]));
  const eps = cur.videos.series.episodes.map((id) => byId[id]);
  const films = cur.videos.other.filter((o) => o.kind === 'short film').map((o) => byId[o.id]);
  const mt = json('./content/mountaintop/index.json');
  const logWords = mt.logs.reduce((n, l) => n + wordCount(frontMatter(fs.readFileSync(path.join(here, `content/mountaintop/${l.slug}.md`), 'utf8')).body), 0);
  const games = json('./content/games.json').games.filter((g) => (cur.games[g.slug]?.tier ?? 'more') !== 'off');
  const engines = [...new Map(games.map((g) => [g.madeWith.toLowerCase(), g.madeWith])).values()];
  return {
    fifaMinutes: minutes(eps.reduce((n, e) => n + secs(e.length), 0)),   // all episodes of the series, summed from their lengths
    filmMinutes: minutes(films.reduce((n, f) => n + secs(f.length), 0)),
    logWords: Math.round(logWords / 100) * 100,   // to the nearest hundred: a word count depends on who counts
    logCount: mt.logs.length,
    engines, gameCount: games.length,
  };
}
