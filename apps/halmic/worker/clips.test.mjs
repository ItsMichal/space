import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { getClips, mapClips } from './index.js';

const ENV = { TWITCH_CLIENT_ID: 'id', TWITCH_CLIENT_SECRET: 'secret' };
const NOW = Date.parse('2026-10-11T12:00:00Z');
const res = (body, status = 200) => new Response(JSON.stringify(body), { status });
const tokenOk = () => res({ access_token: 'tok', expires_in: 5000000 });
const clip = (n, o = {}) => ({ id: `Clip${n}`, title: `Title ${n}`, game_id: '27471', duration: 39.6, url: `https://clips.twitch.tv/Clip${n}`, created_at: '2026-10-01T00:00:00Z', view_count: 99, creator_name: 'someone', broadcaster_name: 'halmictv', thumbnail_url: 'https://x/t.jpg', ...o });
// fake fetch routed by hostname + helix path; routes: { users, clips, games } each a Response factory
function fake({ users = () => res({ data: [{ id: '123' }] }), clips = () => res({ data: [clip(1)] }), games = () => res({ data: [{ id: '27471', name: 'Minecraft' }] }) } = {}) {
  const calls = [];
  const fetchFn = async (url) => {
    const u = new URL(url); calls.push(String(url));
    if (u.hostname === 'id.twitch.tv') return tokenOk();
    const f = { '/helix/users': users, '/helix/clips': clips, '/helix/games': games }[u.pathname];
    return f();
  };
  return { fetchFn, calls };
}
const run = (f, extra = {}) => getClips(ENV, { fetchFn: f.fetchFn, now: NOW, state: {}, ids: {}, cache: null, ...extra });

test('missing secrets -> unknown, 300s, no network', async () => {
  const f = fake();
  const r = await getClips({}, { fetchFn: f.fetchFn, now: NOW, state: {} });
  assert.deepEqual(r.body, { clips: [], unknown: true, checkedAt: '2026-10-11T12:00:00.000Z' });
  assert.equal(r.maxAge, 300);
  assert.equal(f.calls.length, 0);
});

test('success joins game names, rounds duration, uses broadcaster id', async () => {
  const f = fake({ clips: () => res({ data: [clip(1), clip(2, { game_id: '' }), clip(3, { game_id: '32982' })] }), games: () => res({ data: [{ id: '27471', name: 'Minecraft' }, { id: '32982', name: 'VALORANT' }] }) });
  const r = await run(f);
  assert.equal(r.maxAge, 3600);
  assert.equal(r.body.unknown, undefined);
  assert.deepEqual(r.body.clips.map((c) => [c.id, c.game, c.duration]), [['Clip1', 'Minecraft', 40], ['Clip2', '', 40], ['Clip3', 'VALORANT', 40]]);
  assert.deepEqual(Object.keys(r.body.clips[0]).sort(), ['createdAt', 'duration', 'game', 'id', 'title', 'url']);
  assert.ok(f.calls.some((u) => u.includes('/helix/clips?broadcaster_id=123&first=20')));
  const g = f.calls.filter((u) => u.includes('/helix/games'));
  assert.equal(g.length, 1);
  assert.equal(g[0], 'https://api.twitch.tv/helix/games?id=27471&id=32982');
});

test('games lookup failing is non-fatal: clips without game names', async () => {
  for (const games of [() => res({}, 500), () => { throw new Error('net'); }]) {
    const r = await run(fake({ games }));
    assert.equal(r.body.clips.length, 1);
    assert.equal(r.body.clips[0].game, '');
    assert.equal(r.body.unknown, undefined);
    assert.equal(r.maxAge, 3600);
  }
});

test('users lookup failing -> unknown, 60s', async () => {
  for (const users of [() => res({}, 500), () => res({ data: [] }), () => { throw new Error('net'); }]) {
    const r = await run(fake({ users }), {});
    assert.deepEqual([r.body.clips, r.body.unknown, r.maxAge], [[], true, 60]);
  }
});

test('clips lookup failing -> unknown, 60s', async () => {
  const r = await run(fake({ clips: () => res({}, 503) }));
  assert.deepEqual([r.body.clips, r.body.unknown, r.maxAge], [[], true, 60]);
});

test('malformed clip ids are dropped', () => {
  const out = mapClips({ data: [clip(1), { ...clip(2), id: 'a"><script>' }, { ...clip(3), id: 'has space' }, { ...clip(4), id: '' }, { ...clip(5), id: 7 }, { title: 'no id' }, clip(6)] });
  assert.deepEqual(out.map((c) => c.id), ['Clip1', 'Clip6']);
});

test('private fields never appear in the output', async () => {
  const r = await run(fake());
  const s = JSON.stringify(r.body);
  for (const k of ['view_count', 'creator_name', 'broadcaster_name', 'thumbnail_url', 'someone', 'creator', 'thumbnail', 'views']) assert.ok(!s.includes(k), k);
});

test('only the top 6 are returned, in Helix order', async () => {
  const r = await run(fake({ clips: () => res({ data: Array.from({ length: 12 }, (_, i) => clip(i + 1)) }) }));
  assert.deepEqual(r.body.clips.map((c) => c.id), ['Clip1', 'Clip2', 'Clip3', 'Clip4', 'Clip5', 'Clip6']);
});

test('worker route: /api/clips 405 on POST, unknown payload and headers without secrets', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') } };
  const ctx = { waitUntil() {} };
  let r = await worker.fetch(new Request('https://x.test/api/clips', { method: 'POST' }), env, ctx);
  assert.equal(r.status, 405); assert.equal(r.headers.get('allow'), 'GET');
  r = await worker.fetch(new Request('https://x.test/api/clips'), env, ctx);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=300');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  const b = await r.json();
  assert.deepEqual([b.clips, b.unknown], [[], true]);
});
