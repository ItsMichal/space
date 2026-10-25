import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from './index.js';
import { makeCookieValue } from './auth.js';
import { Board, ONLINE_MS, TOP, cleanName, parseScore, statsRequest } from './stats.js';

// the store over Maps (the Durable Object's is SQL: stats.js sqlStore)
function mapStore() {
  const seen = new Map(), best = new Map();
  return {
    seen: (id, at) => seen.set(id, at),
    forget: (before) => { for (const [k, v] of seen) if (v < before) seen.delete(k); },
    online: (since) => [...seen.values()].filter((v) => v >= since).length,
    best: (player, sport) => best.get(player + '/' + sport)?.level ?? null,
    setBest: (player, sport, name, level, at) => best.set(player + '/' + sport, { player, sport, name, level, at }),
    rename: (player, name) => { for (const r of best.values()) if (r.player === player) r.name = name; },
    top: (sport, n) => [...best.values()].filter((r) => r.sport === sport).sort((a, b) => b.level - a.level || a.at - b.at).slice(0, n).map((r) => ({ name: r.name, level: r.level })),
  };
}
const H = 'https://sports.halmic.com';
const post = (path, body, type = 'application/json') => new Request(H + path, { method: 'POST', headers: { 'content-type': type }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const P1 = 'p1aaaaaaaa', P2 = 'p2bbbbbbbb';

test('names are cleaned and cut', () => {
  assert.equal(cleanName('  Ace\u0000<b>  '), 'Aceb');
  assert.equal(cleanName('abcdefghijklmnopqrstuvwxyz'), 'abcdefghijklmnop');
  assert.equal(cleanName(5), '');
});

test('a score needs a profile id, a name, a known sport and a sane level', () => {
  assert.deepEqual(parseScore({ player: P1, name: 'Ace', sport: 'golf', level: 812.34 }), { player: P1, name: 'Ace', sport: 'golf', level: 812.3 });
  for (const bad of [null, {}, { player: 'x', name: 'A', sport: 'golf', level: 1 }, { player: P1, name: '', sport: 'golf', level: 1 },
    { player: P1, name: 'A', sport: 'darts', level: 1 }, { player: P1, name: 'A', sport: 'golf', level: -1 }, { player: P1, name: 'A', sport: 'golf', level: 1e9 },
    { player: P1, name: 'A', sport: 'golf', level: 'NaN' }]) assert.equal(parseScore(bad), null, JSON.stringify(bad));
});

test('the best level per profile and sport is kept; the board is sorted and capped', () => {
  const b = new Board(mapStore());
  b.score(parseScore({ player: P1, name: 'Ace', sport: 'bowling', level: 500 }), 1);
  b.score(parseScore({ player: P1, name: 'Ace', sport: 'bowling', level: 300 }), 2);
  b.score(parseScore({ player: P2, name: 'Bo', sport: 'bowling', level: 700 }), 3);
  assert.deepEqual(b.snapshot(10).boards.bowling, [{ name: 'Bo', level: 700 }, { name: 'Ace', level: 500 }]);
  b.score(parseScore({ player: P1, name: 'Ace2', sport: 'bowling', level: 100 }), 4);
  assert.deepEqual(b.snapshot(10).boards.bowling[1], { name: 'Ace2', level: 500 });   // renamed, best kept
  assert.deepEqual(b.snapshot(10).boards.golf, []);
  for (let i = 0; i < TOP + 5; i++) b.score(parseScore({ player: 'many' + String(i).padStart(6, '0'), name: 'N' + i, sport: 'tennis', level: i }), 5);
  assert.equal(b.snapshot(10).boards.tennis.length, TOP);
  assert.equal(b.snapshot(10).boards.tennis[0].level, TOP + 4);
});

test('online counts the heartbeats of the last ONLINE_MS', () => {
  const b = new Board(mapStore());
  assert.deepEqual(b.hello('tab0000001', 0), { online: 1 });
  assert.deepEqual(b.hello('tab0000002', 1000), { online: 2 });
  assert.deepEqual(b.hello('tab0000002', 1000 + ONLINE_MS + 1), { online: 1 });
  assert.equal(b.hello('bad id!', 0), null);
});

test('the /stats requests', async () => {
  const b = new Board(mapStore());
  assert.equal((await statsRequest(post('/stats/hello', { id: 'tab0000001' }), b, 0)).status, 200);
  assert.equal((await statsRequest(post('/stats/hello', { id: 'x' }), b, 0)).status, 400);
  assert.equal((await statsRequest(post('/stats/hello', 'id=tab0000001', 'application/x-www-form-urlencoded'), b, 0)).status, 400);
  assert.equal((await statsRequest(post('/stats/score', '{"player":', 'application/json'), b, 0)).status, 400);
  assert.equal((await statsRequest(post('/stats/score', { player: P1, name: 'x'.repeat(600), sport: 'golf', level: 1 }), b, 0)).status, 400);   // too large
  const r = await statsRequest(post('/stats/score', { player: P1, name: 'Ace', sport: 'golf', level: 900 }), b, 0);
  assert.deepEqual(await r.json(), { best: 900 });
  const g = await (await statsRequest(new Request(H + '/stats'), b, 0)).json();
  assert.equal(g.online, 1);
  assert.deepEqual(g.boards.golf, [{ name: 'Ace', level: 900 }]);
  assert.equal((await statsRequest(new Request(H + '/stats/nope'), b, 0)).status, 404);
});

test('the Worker sends /stats to the one Durable Object, behind the gate', async () => {
  const NOW = Date.parse('2026-10-23T12:00:00Z');
  const seen = [];
  const STATS = { idFromName: (n) => 'id:' + n, get: (id) => ({ fetch: async (r) => { seen.push([id, new URL(r.url).pathname, r.method]); return new Response('{}'); } }) };
  const env = { SPORTS_PASSKEY: 'pk', BUCKET: { get: async () => null }, STATS };
  assert.equal((await handle(new Request(H + '/stats'), env, { now: NOW })).status, 401);
  const cookie = `hs_pass=${await makeCookieValue('pk', NOW)}`;
  await handle(new Request(H + '/stats', { headers: { cookie } }), env, { now: NOW });
  await handle(new Request(H + '/stats/score', { method: 'POST', headers: { cookie } }), env, { now: NOW });
  assert.deepEqual(seen, [['id:global', '/stats', 'GET'], ['id:global', '/stats/score', 'POST']]);
  assert.equal((await handle(new Request(H + '/stats', { headers: { cookie } }), { ...env, STATS: undefined }, { now: NOW })).status, 501);
});
