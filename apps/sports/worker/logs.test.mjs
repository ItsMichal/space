import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { handle, keyOf } from './index.js';
import { Board } from './stats.js';
import { KEEP_MS, MAX_LOG, PER_DAY, dayOf, logKey, logRequest, sweepLogs } from './logs.js';

const H = 'https://sports.halmic.com';
const NOW = Date.parse('2026-10-28T12:00:00Z');
const gz = (o) => gzipSync(Buffer.from(JSON.stringify(o)));
const post = (body, type = 'application/gzip') => new Request(H + '/logs', { method: 'POST', headers: { 'content-type': type }, body });

// a fake R2 bucket with put/list/delete
function bucket() {
  const objs = new Map();
  return {
    objs,
    async put(key, body, o) { objs.set(key, { key, body, uploaded: new Date(this.now ?? NOW), type: o?.httpMetadata?.contentType }); },
    async get(key) { const o = objs.get(key); return o ? { size: o.body.length, body: new Response(o.body).body } : null; },
    async list({ prefix, cursor, limit }) {
      const all = [...objs.values()].filter((o) => o.key.startsWith(prefix)).sort((a, b) => (a.key < b.key ? -1 : 1));
      const at = cursor ? +cursor : 0, page = all.slice(at, at + limit);
      return { objects: page, truncated: at + limit < all.length, cursor: String(at + limit) };
    },
    async delete(keys) { for (const k of [].concat(keys)) objs.delete(k); },
  };
}
// the Stats object's day count over a Map (stats.js sqlStore keeps it in SQL)
function admitter() {
  const days = new Map();
  const board = new Board({ logs: (d) => days.get(d) ?? 0, countLog: (d) => { for (const k of days.keys()) if (k !== d) days.delete(k); days.set(d, (days.get(d) ?? 0) + 1); } });
  return { days, admit: async (now) => board.admitLog(dayOf(now), PER_DAY) };
}

test('a gzipped log is stored under logs/ with its time first; the id names it', async () => {
  const b = bucket(), a = admitter();
  const r = await logRequest(post(gz({ v: 1, ev: [] })), b, a.admit, NOW);
  assert.equal(r.status, 200);
  const { id } = await r.json();
  assert.match(id, /^2026-10-28T12-00-00-000Z-[0-9a-f]{12}\.json\.gz$/);
  assert.ok(b.objs.has('logs/' + id));
  assert.equal(b.objs.get('logs/' + id).type, 'application/gzip');
  assert.equal(a.days.get('2026-10-28'), 1);
});

test('only gzip, only POST, at most 1 MB', async () => {
  const b = bucket(), a = admitter();
  assert.equal((await logRequest(post('{"v":1}', 'application/json'), b, a.admit, NOW)).status, 415);
  assert.equal((await logRequest(post(Buffer.from('not gzip at all, really not')), b, a.admit, NOW)).status, 400);
  assert.equal((await logRequest(new Request(H + '/logs'), b, a.admit, NOW)).status, 405);
  const big = Buffer.alloc(MAX_LOG + 1); big[0] = 0x1f; big[1] = 0x8b;
  assert.equal((await logRequest(post(big), b, a.admit, NOW)).status, 413);
  assert.equal(b.objs.size, 0);
  assert.equal(a.days.size, 0);
});

test('at most PER_DAY logs a day; the next day starts again', async () => {
  const b = bucket(), a = admitter();
  a.days.set('2026-10-28', PER_DAY);
  assert.equal((await logRequest(post(gz({})), b, a.admit, NOW)).status, 429);
  assert.equal(b.objs.size, 0);
  assert.equal((await logRequest(post(gz({})), b, a.admit, NOW + 86400_000)).status, 200);
  assert.deepEqual([...a.days], [['2026-10-29', 1]]);
});

test('the sweep deletes logs older than a day, across list pages, and nothing else', async () => {
  const b = bucket();
  for (let i = 0; i < 1500; i++) { b.now = NOW - KEEP_MS - 1000 - i; await b.put(logKey(b.now), Buffer.from('x')); }
  b.now = NOW - 3600_000; await b.put(logKey(b.now), Buffer.from('x'));
  b.now = NOW - KEEP_MS - 5000; await b.put('index.html', Buffer.from('x'));
  assert.equal(await sweepLogs(b, NOW), 1500);
  assert.deepEqual([...b.objs.keys()].filter((k) => k.startsWith('logs/')).length, 1);
  assert.ok(b.objs.has('index.html'));
});

test('logs/ is never served, and /logs goes through the gate and the day count', async () => {
  assert.equal(keyOf('/logs/2026-10-28T12-00-00-000Z-abcdefabcdef.json.gz'), null);
  const b = bucket();
  b.objs.set('logs/x.json.gz', { key: 'logs/x.json.gz', body: Buffer.from('x'), uploaded: new Date(NOW) });
  const open = { SPORTS_GATE: 'off', BUCKET: b };
  assert.equal((await handle(new Request(H + '/logs/x.json.gz'), open, { now: NOW })).status, 404);
  assert.equal((await handle(post(gz({})), { SPORTS_GATE: 'on', SPORTS_PASSKEY: 'k', BUCKET: b }, { now: NOW })).status, 401);
  assert.equal((await handle(post(gz({})), open, { now: NOW })).status, 501);   // no Stats object, no count, no logs
  const a = admitter(), asked = [];
  const STATS = { idFromName: (n) => n, get: () => ({ fetch: async (url, init) => { const q = JSON.parse(init.body); asked.push(q); return new Response(JSON.stringify({ ok: await a.admit(Date.parse(q.day + 'T12:00:00Z')) })); } }) };
  const r = await handle(post(gz({ v: 1 })), { ...open, STATS }, { now: NOW });
  assert.equal(r.status, 200);
  assert.deepEqual(asked, [{ day: '2026-10-28', cap: PER_DAY }]);
});
