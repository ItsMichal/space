import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { getLive, mapStreams, buildResponse } from './index.js';

const ENV = { TWITCH_CLIENT_ID: 'id', TWITCH_CLIENT_SECRET: 'secret' };
const NOW = Date.parse('2026-10-11T12:00:00Z');
const res = (body, status = 200) => new Response(JSON.stringify(body), { status });
// fake fetch: routes by URL, records calls
function fake(routes) {
  const calls = [];
  const fetchFn = async (url) => { calls.push(String(url)); const r = routes[new URL(url).hostname]; return typeof r === 'function' ? r(calls) : r.clone(); };
  return { fetchFn, calls };
}
const tokenOk = () => res({ access_token: 'tok', expires_in: 5000000 });

test('mapStreams: empty -> offline, stream -> live without viewer count', () => {
  assert.deepEqual(mapStreams({ data: [] }), { live: false });
  assert.deepEqual(mapStreams(undefined), { live: false });
  const s = mapStreams({ data: [{ title: 'T', game_name: 'Minecraft', started_at: '2026-10-11T11:00:00Z', viewer_count: 9 }] });
  assert.deepEqual(s, { live: true, title: 'T', game: 'Minecraft', startedAt: '2026-10-11T11:00:00Z' });
});

test('buildResponse adds checkedAt', () => {
  assert.deepEqual(buildResponse({ live: false }, NOW), { body: { live: false, checkedAt: '2026-10-11T12:00:00.000Z' }, maxAge: 45 });
});

test('missing secrets -> unknown, 300s, no network', async () => {
  const f = fake({});
  const r = await getLive({}, { fetchFn: f.fetchFn, now: NOW, state: {} });
  assert.deepEqual(r.body, { live: false, unknown: true, checkedAt: '2026-10-11T12:00:00.000Z' });
  assert.equal(r.maxAge, 300);
  assert.equal(f.calls.length, 0);
});

test('offline', async () => {
  const f = fake({ 'id.twitch.tv': tokenOk, 'api.twitch.tv': res({ data: [] }) });
  const r = await getLive(ENV, { fetchFn: f.fetchFn, now: NOW, state: {} });
  assert.equal(r.body.live, false);
  assert.equal(r.body.unknown, undefined);
  assert.equal(r.maxAge, 45);
});

test('live, and the token is reused from state', async () => {
  const state = {};
  const f = fake({ 'id.twitch.tv': tokenOk, 'api.twitch.tv': res({ data: [{ title: 'Hi', game_name: 'F1 23', started_at: 'x' }] }) });
  const r = await getLive(ENV, { fetchFn: f.fetchFn, now: NOW, state });
  assert.deepEqual([r.body.live, r.body.game, r.body.title], [true, 'F1 23', 'Hi']);
  const again = await getLive(ENV, { fetchFn: f.fetchFn, now: NOW + 1000, state });
  assert.equal(again.body.live, true);
  assert.equal(f.calls.filter((u) => u.includes('id.twitch.tv')).length, 1);
});

test('401 from Helix refreshes the token once, then succeeds', async () => {
  let n = 0;
  const f = fake({ 'id.twitch.tv': tokenOk, 'api.twitch.tv': () => (++n === 1 ? res({}, 401) : res({ data: [] })) });
  const r = await getLive(ENV, { fetchFn: f.fetchFn, now: NOW, state: {} });
  assert.equal(r.body.live, false);
  assert.equal(r.body.unknown, undefined);
  assert.equal(f.calls.filter((u) => u.includes('id.twitch.tv')).length, 2);
});

test('Twitch errors -> unknown, 60s, never throws', async () => {
  for (const routes of [
    { 'id.twitch.tv': res({}, 500), 'api.twitch.tv': res({}) },
    { 'id.twitch.tv': tokenOk, 'api.twitch.tv': res({}, 503) },
    { 'id.twitch.tv': tokenOk, 'api.twitch.tv': res({}, 401) },
    { 'id.twitch.tv': () => { throw new Error('network'); }, 'api.twitch.tv': res({}) },
  ]) {
    const r = await getLive(ENV, { fetchFn: fake(routes).fetchFn, now: NOW, state: {} });
    assert.equal(r.body.unknown, true);
    assert.equal(r.body.live, false);
    assert.equal(r.maxAge, 60);
  }
});

test('worker routing: 404 json, 405, assets fall-through, headers', async () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') } };
  const ctx = { waitUntil() {} };
  let r = await worker.fetch(new Request('https://x.test/api/nope'), env, ctx);
  assert.equal(r.status, 404); assert.equal((await r.json()).error, 'not found');
  r = await worker.fetch(new Request('https://x.test/api/live', { method: 'POST' }), env, ctx);
  assert.equal(r.status, 405); assert.equal(r.headers.get('allow'), 'GET');
  r = await worker.fetch(new Request('https://x.test/'), env, ctx);
  assert.equal(await r.text(), 'asset');
  r = await worker.fetch(new Request('https://x.test/api/live'), env, ctx);   // no secrets in env
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=300');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await r.json()).unknown, true);
});
