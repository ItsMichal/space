import test from 'node:test';
import assert from 'node:assert/strict';
import { Club, clubRequest, mapStore } from './club.js';
import { GONE_MS, Social, cleanText, filterText, socialMap } from './social.js';

const H = 'https://sports.halmic.com';
const post = (path, body, token) => new Request(H + path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
const get = (path, token) => new Request(H + path, { headers: { authorization: 'Bearer ' + token } });

/** a club with signed-in accounts made straight in the store; t.now moves the clock */
async function setup(names) {
  const t = { now: 1_000_000 };
  const club = new Club(socialMap(mapStore()));
  const social = new Social(club, { now: () => t.now, pollMs: 30 });
  const call = async (req) => { const r = await clubRequest(req, club, t.now, social); return { status: r.status, body: await r.json() }; };
  const who = {};
  for (const name of names) {
    const id = 'id-' + name;
    club.db.putAccount({ id, name, character: '', owns_at: t.now, created: t.now });
    who[name] = { id, token: await club.session(id, t.now), since: 0 };
  }
  // one poll: the events since the last one
  const poll = async (n, venue = 'menu') => {
    const r = await call(get(`/club/events?since=${who[n].since}&venue=${venue}`, who[n].token));
    assert.equal(r.status, 200);
    who[n].since = r.body.seq;
    return r.body.events;
  };
  const tag = async (n) => (await call(get('/club/friends', who[n].token))).body.tag;
  return { t, club, social, call, who, poll, tag };
}

test('friends: a code asks, the code back accepts; both hear it; remove', async () => {
  const { call, who, poll, tag } = await setup(['ann', 'bob']);
  await poll('ann'); await poll('bob');
  const bobTag = await tag('bob'), annTag = await tag('ann');
  assert.match(bobTag, /^[A-Z2-9]{6}$/);
  assert.equal((await call(post('/club/friends/add', { tag: 'nope00' }, who.ann.token))).status, 404);
  assert.equal((await call(post('/club/friends/add', { tag: annTag }, who.ann.token))).status, 400);
  assert.equal((await call(post('/club/friends/add', { tag: bobTag.toLowerCase() }, who.ann.token))).status, 200);
  assert.ok((await poll('bob')).some((e) => e.k === 'friends'));
  let bl = (await call(get('/club/friends', who.bob.token))).body.friends;
  assert.deepEqual(bl.map((f) => [f.name, f.state]), [['ann', 'in']]);
  assert.equal((await call(get('/club/friends', who.ann.token))).body.friends[0].state, 'out');
  // a direct message before they are friends is refused
  assert.equal((await call(post('/club/chat', { to: who.bob.id, text: 'hi' }, who.ann.token))).status, 403);
  await call(post('/club/friends/add', { tag: annTag }, who.bob.token));
  bl = (await call(get('/club/friends', who.bob.token))).body.friends;
  assert.equal(bl[0].state, 'friend');
  assert.equal(bl[0].online, true);
  assert.equal(bl[0].venue, 'menu');
  await call(post('/club/friends/remove', { id: who.ann.id }, who.bob.token));
  assert.equal((await call(get('/club/friends', who.ann.token))).body.friends.length, 0);
});

test('presence: friends hear online, venue changes and going away', async () => {
  const { t, social, call, who, poll, tag } = await setup(['ann', 'bob']);
  await poll('ann'); await poll('bob');
  await call(post('/club/friends/add', { tag: await tag('bob') }, who.ann.token));
  await call(post('/club/friends/add', { tag: await tag('ann') }, who.bob.token));
  await poll('ann');
  await poll('bob', 'bowling');
  const ev = await poll('ann');
  assert.ok(ev.some((e) => e.k === 'presence' && e.id === who.bob.id && e.online && e.venue === 'bowling'));
  t.now += GONE_MS + 1;
  await poll('ann');   // ann polls on; bob did not: gone
  assert.equal(social.online(who.bob.id), false);
  const later = await poll('ann');
  assert.ok(later.some((e) => e.k === 'presence' && e.id === who.bob.id && !e.online) || (await call(get('/club/friends', who.ann.token))).body.friends[0].online === false);
});

test('chat: the club room, direct messages, the filter, the rate limit, blocks', async () => {
  const { call, who, poll, tag } = await setup(['ann', 'bob', 'cat']);
  for (const n of ['ann', 'bob', 'cat']) await poll(n);
  assert.equal((await call(post('/club/chat', { text: 'hello  club\n' }, who.ann.token))).status, 200);
  const got = await poll('bob');
  assert.deepEqual(got.filter((e) => e.k === 'chat').map((e) => [e.name, e.text, e.to]), [['ann', 'hello club', undefined]]);
  assert.equal((await call(get('/club/chat', who.cat.token))).body.messages.length, 1);
  await call(post('/club/chat', { text: 'you sh1t' }, who.ann.token));
  assert.equal((await poll('cat')).filter((e) => e.k === 'chat').at(-1).text, 'you ****');
  for (let i = 0; i < 3; i++) await call(post('/club/chat', { text: 'x' + i }, who.ann.token));
  assert.equal((await call(post('/club/chat', { text: 'one too many' }, who.ann.token))).status, 429);
  assert.equal((await call(post('/club/chat', { text: '   ' }, who.bob.token))).status, 400);
  // cat blocks bob: bob's room messages do not reach cat, nor bob's friend request
  await call(post('/club/block', { id: who.bob.id, block: true }, who.cat.token));
  await poll('cat');
  await call(post('/club/chat', { text: 'from bob' }, who.bob.token));
  assert.ok(!(await poll('cat')).some((e) => e.k === 'chat' && e.name === 'bob'));
  assert.ok(!(await call(get('/club/chat', who.cat.token))).body.messages.some((m) => m.name === 'bob'));
  assert.equal((await call(post('/club/friends/add', { tag: await tag('cat') }, who.bob.token))).status, 403);
  assert.deepEqual((await call(get('/club/friends', who.cat.token))).body.blocked.map((b) => b.name), ['bob']);
  assert.equal((await call(post('/club/report', { id: who.bob.id, reason: 'chat', text: 'rude' }, who.cat.token))).status, 200);
  // direct messages between friends reach only the two
  await call(post('/club/friends/add', { tag: await tag('bob') }, who.ann.token));
  await call(post('/club/friends/add', { tag: await tag('ann') }, who.bob.token));
  await poll('ann'); await poll('bob'); await poll('cat');
  await call(post('/club/chat', { to: who.ann.id, text: 'psst' }, who.bob.token));
  assert.equal((await poll('ann')).find((e) => e.k === 'chat').to, who.ann.id);
  assert.ok(!(await poll('cat')).some((e) => e.k === 'chat'));
});

test('filter: whole words and plain leetspeak only', () => {
  assert.equal(filterText('Fuuuck this'), '****** this');
  assert.equal(filterText('sh!t happens'), '**** happens');
  assert.equal(filterText('scunthorpe glasses classic'), 'scunthorpe glasses classic');
  assert.equal(cleanText('a'.repeat(300)).length, 200);
});

test('invites go to online friends only', async () => {
  const { call, who, poll, tag } = await setup(['ann', 'bob']);
  await poll('ann');
  await call(post('/club/friends/add', { tag: await tag('bob') }, who.ann.token));
  await call(post('/club/friends/add', { tag: await tag('ann') }, who.bob.token));
  assert.equal((await call(post('/club/invite', { to: who.bob.id, sport: 'tennis', code: 'ABCDE' }, who.ann.token))).status, 409);
  await poll('bob');
  assert.equal((await call(post('/club/invite', { to: who.bob.id, sport: 'chess', code: 'ABCDE' }, who.ann.token))).status, 400);
  assert.equal((await call(post('/club/invite', { to: who.bob.id, sport: 'tennis', code: 'ABCDE' }, who.ann.token))).status, 200);
  const inv = (await poll('bob')).find((e) => e.k === 'invite');
  assert.deepEqual([inv.name, inv.sport, inv.code], ['ann', 'tennis', 'ABCDE']);
});

test('matchmaking: a queue per sport, bands that widen, the lobby code, ratings from agreeing results', async () => {
  const { t, call, who, poll, social } = await setup(['ann', 'bob', 'cat']);
  for (const n of ['ann', 'bob', 'cat']) await poll(n);
  social.db.setRating(who.cat.id, 1500, 0);
  await call(post('/club/match', { sport: 'bowling' }, who.ann.token));
  await call(post('/club/match', { sport: 'golf' }, who.bob.token));
  await call(post('/club/match', { sport: 'bowling' }, who.cat.token));
  assert.ok(!(await poll('ann')).some((e) => e.k === 'match'), 'different sports, a rating gap of 500: no match yet');
  t.now += 15_000; await poll('bob');
  t.now += 15_000; await poll('bob');   // 30 s: a band of 600 each side
  const m = (await poll('ann')).find((e) => e.k === 'match');
  assert.ok(m && m.host && m.sport === 'bowling' && m.peer.name === 'cat');
  const mc = (await poll('cat')).find((e) => e.k === 'match');
  assert.equal(mc.match, m.match); assert.equal(mc.host, false);
  assert.equal((await call(post('/club/match/lobby', { match: m.match, code: 'QWERT' }, who.cat.token))).status, 404, 'only the host');
  await call(post('/club/match/lobby', { match: m.match, code: 'QWERT' }, who.ann.token));
  assert.equal((await poll('cat')).find((e) => e.k === 'match-lobby').code, 'QWERT');
  await call(post('/club/result', { match: m.match, won: true }, who.ann.token));
  const r = await call(post('/club/result', { match: m.match, won: false }, who.cat.token));
  assert.ok(r.body.rating < 1500);
  const ann = (await call(get('/club/friends', who.ann.token))).body.rating;
  assert.equal(ann - 1000, 1500 - r.body.rating);
  // cancel: out of the queue
  await call(post('/club/match/cancel', {}, who.bob.token));
  await call(post('/club/match', { sport: 'golf' }, who.ann.token));
  assert.ok(!(await poll('ann')).some((e) => e.k === 'match'));
});

test('a deleted account takes its friends and blocks with it', async () => {
  const { call, who, poll, tag, club } = await setup(['ann', 'bob']);
  await poll('ann'); await poll('bob');
  await call(post('/club/friends/add', { tag: await tag('bob') }, who.ann.token));
  await call(post('/club/friends/add', { tag: await tag('ann') }, who.bob.token));
  await call(post('/club/delete', {}, who.bob.token));
  assert.equal((await call(get('/club/friends', who.ann.token))).body.friends.length, 0);
  assert.equal(club.db.player(who.bob.id), null);
  assert.equal((await call(get('/club/events', who.bob.token))).status, 401);
});
