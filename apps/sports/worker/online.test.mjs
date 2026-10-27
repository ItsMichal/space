import test from 'node:test';
import assert from 'node:assert/strict';
import { createOnline } from './online.js';

const H = 'https://sports.halmic.com';
const AV = 'ab'.repeat(74);
function setup() {
  let t = 1e12;
  const on = createOnline({ now: () => t, pollMs: 30 });
  const call = async (path, body, method) => {
    const r = await on(new Request(H + path, body === undefined ? { method: method || 'GET' } : { method: 'POST', body: JSON.stringify(body) }));
    return { status: r.status, body: r.status === 204 ? null : await r.json() };
  };
  return { call, tick: (ms) => { t += ms; } };
}

test('a full lobby: create, join, pick a sport, ready, start, leave', async () => {
  const { call, tick } = setup();
  const c = await call('/lobby/new', { name: 'Ann<>', avatar: AV.toUpperCase() });
  assert.equal(c.status, 200);
  assert.match(c.body.code, /^[A-HJKMNP-Z2-9]{5}$/);
  assert.equal(c.body.me, 0);
  assert.equal(c.body.state.sport, 'bowling');
  assert.deepEqual(c.body.state.players, [{ name: 'Ann', ready: true, host: true, avatar: AV, here: true }]);
  const code = c.body.code, host = c.body.token;

  const j = await call(`/lobby/${code.toLowerCase()}/join`, { name: 'Bo', avatar: 'nope' });
  assert.equal(j.status, 200);
  assert.equal(j.body.me, 1);
  assert.equal(j.body.state.players[1].avatar, '');
  const guest = j.body.token;
  assert.equal((await call(`/lobby/${code}/join`, { name: 'Cy' })).status, 409);
  assert.equal((await call(`/lobby/${code}/join`, { name: 'Bo again', token: guest })).body.me, 1);

  assert.equal((await call(`/lobby/${code}/start`, { token: host })).status, 409);
  assert.equal((await call(`/lobby/${code}/set`, { token: guest, sport: 'baseball' })).status, 403);
  assert.equal((await call(`/lobby/${code}/set`, { token: host, sport: 'golf' })).status, 400);
  assert.equal((await call(`/lobby/${code}/set`, { token: host, sport: 'baseball' })).body.sport, 'baseball');
  assert.equal((await call(`/lobby/${code}/set`, { token: guest, ready: true })).body.players[1].ready, true);
  assert.equal((await call(`/lobby/${code}/start`, { token: guest })).status, 403);
  const s = await call(`/lobby/${code}/start`, { token: host });
  assert.equal(s.status, 200);
  assert.deepEqual(s.body.started, { seq: 1, room: code, sport: 'baseball' });

  // the start opened a netplay room under the lobby's code
  assert.equal((await call(`/netplay/${code}/j`, { t: 'offer' })).status, 204);
  assert.deepEqual((await call(`/netplay/${code}/j`)).body, [{ t: 'offer' }]);

  assert.equal((await call(`/lobby/${code}/set`, { token: 'x' })).status, 403);
  assert.equal((await call(`/lobby/${code}/leave`, { token: guest })).status, 204);
  assert.equal((await call(`/lobby/${code}/leave`, { token: host })).status, 204);
  assert.equal((await call(`/lobby/${code}/join`, { name: 'Dee' })).status, 410);
  assert.equal((await call(`/lobby/${code}?v=0`)).body.closed, true);
  tick(31000);
  assert.equal((await call(`/lobby/${code}?v=0`)).status, 404);
  assert.equal((await call('/lobby/ZZZZZ/join', { name: 'Dee' })).status, 404);
  assert.equal((await call('/lobby/new', undefined, 'POST')).status, 200);
  const bad = await new Promise((r) => r(createOnline()(new Request(H + '/lobby/new', { method: 'POST', body: '{' }))));
  assert.equal(bad.status, 400);
});

test('the lobby poll answers at once when behind, waits for a change, or times out', async () => {
  const { call } = setup();
  const c = await call('/lobby/new', { name: 'Ann' });
  const code = c.body.code, v = c.body.state.v;
  assert.equal((await call(`/lobby/${code}?v=0&token=${c.body.token}`)).body.v, v);
  const waiting = call(`/lobby/${code}?v=${v}&token=${c.body.token}`);
  await call(`/lobby/${code}/join`, { name: 'Bo' });
  const w = await waiting;
  assert.equal(w.body.players.length, 2);
  const t0 = Date.now();
  assert.equal((await call(`/lobby/${code}?v=${w.body.v}`)).body.v, w.body.v);
  assert.ok(Date.now() - t0 >= 25);
});

test('a guest that stops polling is dropped; the host stays', async () => {
  const { call, tick } = setup();
  const c = await call('/lobby/new', { name: 'Ann' });
  await call(`/lobby/${c.body.code}/join`, { name: 'Bo' });
  tick(31000);
  const p = await call(`/lobby/${c.body.code}?v=0&token=${c.body.token}`);
  assert.deepEqual(p.body.players.map((x) => x.name), ['Ann']);
});

test('the netplay mailbox: new room, post, long-poll, one poller per side', async () => {
  const { call } = setup();
  const r = await call('/netplay/new', undefined, 'POST');
  const room = r.body.room;
  assert.match(room, /^[A-HJKMNP-Z2-9]{5}$/);
  assert.equal((await call(`/netplay/${room}/x`)).status, 404);
  assert.equal((await call('/netplay/QQQQQ/h')).status, 404);
  const first = call(`/netplay/${room}/h`);
  const second = call(`/netplay/${room}/h`);
  assert.deepEqual((await first).body, []);
  await call(`/netplay/${room}/h`, { sdp: 1 });
  assert.deepEqual((await second).body, [{ sdp: 1 }]);
  assert.deepEqual((await call(`/netplay/${room}/h`)).body, []);
});

test('OPTIONS answers 204', async () => {
  const r = await createOnline()(new Request(H + '/lobby/new', { method: 'OPTIONS' }));
  assert.equal(r.status, 204);
});
