// The online count and the all-time leaderboards (one Durable Object, `Stats`, named "global", SQLite storage).
//
//   POST /stats/hello  {id}                          a page heartbeat (every 20 s); id is a random per-tab id
//   POST /stats/score  {player, name, sport, level}  a profile's Skill Level in a sport after a game; the best one is kept
//   GET  /stats                                      {online, boards: {sport: [{name, level}]}}, the top TOP per sport
//   POST /admit-log  {day, cap}                      the Worker only (index.js never forwards it): one more session log
//                                                    today if fewer than cap were stored (worker/logs.js) -> {ok}
//
// player is a random per-profile id made by the page (never shown); name is the profile's character name. The game's
// own Skill Level is the score (0 to a little over 2000; the game writes it at the end of every game).
export const SPORTS = ['baseball', 'bowling', 'tennis', 'golf', 'boxing'];
export const TOP = 10;
export const ONLINE_MS = 45_000;
const FORGET_MS = 5 * 60_000;
const MAX_BODY = 512;
const MAX_LEVEL = 5000;

const ID = /^[0-9A-Za-z_-]{8,40}$/;

/** A character name as stored: printable, trimmed, at most 16 characters; '' when nothing is left. */
export function cleanName(v) {
  if (typeof v !== 'string') return '';
  return [...v.replace(/[\p{C}<>&"'`\\]/gu, '').trim()].slice(0, 16).join('').trim();
}

/** A score body checked, or null. */
export function parseScore(o) {
  if (!o || typeof o !== 'object') return null;
  const name = cleanName(o.name), level = Number(o.level);
  if (!ID.test(String(o.player || '')) || !name || !SPORTS.includes(o.sport)) return null;
  if (!Number.isFinite(level) || level < 0 || level > MAX_LEVEL) return null;
  return { player: o.player, name, sport: o.sport, level: Math.round(level * 10) / 10 };
}

/** The board logic over a small store (the Durable Object's SQL, or a Map in the tests). */
export class Board {
  constructor(db) { this.db = db; }
  hello(id, now) {
    if (!ID.test(String(id || ''))) return null;
    this.db.seen(id, now);
    this.db.forget(now - FORGET_MS);
    return { online: this.db.online(now - ONLINE_MS) };
  }
  score(s, now) {
    const best = this.db.best(s.player, s.sport);
    if (best == null || s.level > best) this.db.setBest(s.player, s.sport, s.name, s.level, now);
    else this.db.rename(s.player, s.name);
    return { best: Math.max(best ?? 0, s.level) };
  }
  admitLog(day, cap) {
    if (this.db.logs(day) >= cap) return false;
    this.db.countLog(day);
    return true;
  }
  snapshot(now) {
    const boards = {};
    for (const sp of SPORTS) boards[sp] = this.db.top(sp, TOP);
    return { online: this.db.online(now - ONLINE_MS), boards };
  }
}

/** The store over Durable Object SQLite (ctx.storage.sql). */
export function sqlStore(sql) {
  sql.exec('CREATE TABLE IF NOT EXISTS seen (id TEXT PRIMARY KEY, at INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS best (player TEXT NOT NULL, sport TEXT NOT NULL, name TEXT NOT NULL, level REAL NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (player, sport))');
  sql.exec('CREATE INDEX IF NOT EXISTS best_by_sport ON best (sport, level DESC)');
  sql.exec('CREATE TABLE IF NOT EXISTS logday (day TEXT PRIMARY KEY, n INTEGER NOT NULL)');
  return {
    seen: (id, at) => sql.exec('INSERT INTO seen (id, at) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET at = excluded.at', id, at),
    forget: (before) => sql.exec('DELETE FROM seen WHERE at < ?', before),
    online: (since) => sql.exec('SELECT COUNT(*) AS n FROM seen WHERE at >= ?', since).one().n,
    best: (player, sport) => sql.exec('SELECT level FROM best WHERE player = ? AND sport = ?', player, sport).toArray()[0]?.level ?? null,
    setBest: (player, sport, name, level, at) =>
      sql.exec('INSERT INTO best (player, sport, name, level, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (player, sport) DO UPDATE SET name = excluded.name, level = excluded.level, at = excluded.at', player, sport, name, level, at),
    rename: (player, name) => sql.exec('UPDATE best SET name = ? WHERE player = ?', name, player),
    logs: (day) => sql.exec('SELECT n FROM logday WHERE day = ?', day).toArray()[0]?.n ?? 0,
    countLog: (day) => { sql.exec('DELETE FROM logday WHERE day <> ?', day); sql.exec('INSERT INTO logday (day, n) VALUES (?, 1) ON CONFLICT (day) DO UPDATE SET n = n + 1', day); },
    top: (sport, n) => sql.exec('SELECT name, level FROM best WHERE sport = ? ORDER BY level DESC, at ASC LIMIT ?', sport, n).toArray().map((r) => ({ name: r.name, level: r.level })),
  };
}

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' } });

async function readJson(req) {
  if (!(req.headers.get('content-type') || '').startsWith('application/json')) return undefined;
  if (Number(req.headers.get('content-length') || 0) > MAX_BODY) return undefined;
  const t = await req.text();
  if (t.length > MAX_BODY) return undefined;
  try { return JSON.parse(t); } catch { return undefined; }
}

/** The requests of /stats against a Board (inside the Durable Object). */
export async function statsRequest(req, board, now) {
  const path = new URL(req.url).pathname;
  if (path === '/stats' && (req.method === 'GET' || req.method === 'HEAD')) return json(200, board.snapshot(now));
  if (path === '/admit-log' && req.method === 'POST') {
    const b = await readJson(req);
    return b && /^\d{4}-\d\d-\d\d$/.test(b.day) && Number.isInteger(b.cap) ? json(200, { ok: board.admitLog(b.day, b.cap) }) : json(400, { err: 'bad request' });
  }
  if (req.method !== 'POST' || (path !== '/stats/hello' && path !== '/stats/score')) return json(404, { err: 'not found' });
  const body = await readJson(req);
  if (body === undefined) return json(400, { err: 'bad request' });
  if (path === '/stats/hello') {
    const r = board.hello(body && body.id, now);
    return r ? json(200, r) : json(400, { err: 'bad id' });
  }
  const s = parseScore(body);
  return s ? json(200, board.score(s, now)) : json(400, { err: 'bad score' });
}
