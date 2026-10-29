import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { handle, keyOf, safeNext } from './index.js';
import { MAX_AGE, makeCookieValue, passkeyMatches, passkeyOf, verifyCookieValue } from './auth.js';

const SECRET = 'correct horse';
const ENV = (extra = {}) => ({ SPORTS_PASSKEY: SECRET, BUCKET: bucket(), ...extra });
const NOW = Date.parse('2026-10-23T12:00:00Z');
const O = { now: NOW, failDelayMs: 0 };
const H = 'https://sports.halmic.com';

// a fake R2 bucket: get(key) -> {body, size, httpEtag} | null
function bucket(files = {}) {
  const all = {
    'index.html': '<title>MemeSports</title>',
    'main.js': 'export {}',
    'preload.json': '{"c":8388608,"files":[]}',
    'memesports.webmanifest': '{}',
    'og.png': 'PNG',
    'favicon.ico': 'ICO',
    'z/abc123.0.br': 'BR-BYTES',
    'z/abc123.0.gz': 'GZ-BYTES',
    '.publish-state.json': '{}',
    ...files,
  };
  return {
    gets: [],
    async get(key) {
      this.gets.push(key);
      if (!(key in all)) return null;
      const b = Buffer.from(all[key]);
      return { size: b.length, httpEtag: `"e-${key}"`, body: new Response(b).body };
    },
  };
}
const req = (path, init = {}) => new Request(H + path, init);
const login = async (env, now = NOW) => `hs_pass=${await makeCookieValue(passkeyOf(env), now)}`;
const form = (o) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o).toString() });

test('no secret set: everything is refused, even with a cookie and on the gate', async () => {
  for (const env of [{ BUCKET: bucket() }, { SPORTS_PASSKEY: '', BUCKET: bucket() }, { SPORTS_PASSKEY: '   ', BUCKET: bucket() }]) {
    for (const p of ['/', '/gate', '/robots.txt', '/chunks/abc123/0', '/memesports.wasm']) {
      const r = await handle(req(p, { headers: { cookie: `hs_pass=${await makeCookieValue('x', NOW)}` } }), env, O);
      assert.equal(r.status, 503, p);
    }
    assert.equal((await handle(req('/gate', form({ passkey: '' })), env, O)).status, 503);
  }
});

test('SPORTS_GATE off: open without a cookie or a secret, /gate goes straight on; on (or unset) keeps the gate', async () => {
  for (const env of [{ SPORTS_GATE: 'off', BUCKET: bucket() }, { SPORTS_GATE: ' OFF ', SPORTS_PASSKEY: SECRET, BUCKET: bucket() }]) {
    for (const p of ['/', '/index.html', '/main.js', '/preload.json']) assert.equal((await handle(req(p), env, O)).status, 200, p);
    assert.equal((await handle(req('/chunks/abc123/0', { headers: { 'accept-encoding': 'br' } }), env, O)).status, 200);
    const g = await handle(req('/gate?next=%2Fplay'), env, O);
    assert.equal(g.status, 303);
    assert.equal(g.headers.get('location'), '/play');
    assert.equal(g.headers.get('set-cookie'), null);
  }
  assert.equal((await handle(req('/main.js'), ENV({ SPORTS_GATE: 'on' }), O)).status, 401);
  assert.equal((await handle(req('/main.js'), { SPORTS_GATE: 'on', BUCKET: bucket() }, O)).status, 503);
});

test('the gate rejects: no cookie means no files, no chunks, no bucket reads', async () => {
  const env = ENV();
  for (const p of ['/', '/index.html', '/main.js', '/preload.json', '/chunks/abc123/0', '/memesports.wasm', '/__stats', '/lobby/new', '/z/abc123.0.br']) {
    const r = await handle(req(p, { headers: { accept: '*/*' } }), env, O);
    assert.equal(r.status, 401, p);
    assert.equal(await r.text(), 'passkey required');
  }
  assert.equal((await handle(req('/lobby/new', { method: 'POST' }), env, O)).status, 401);
  assert.deepEqual(env.BUCKET.gets, []);
});

test('a page navigation without a cookie is sent to the gate and comes back after', async () => {
  const r = await handle(req('/play?x=1', { headers: { accept: 'text/html,application/xhtml+xml' } }), ENV(), O);
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('location'), '/gate?next=%2Fplay%3Fx%3D1');
  assert.equal(r.headers.get('set-cookie'), null);
});

test('forged, malformed, expired and other-passkey cookies do not pass', async () => {
  const env = ENV();
  const good = await makeCookieValue(SECRET, NOW);
  const [exp, sig] = good.split('.');
  const bad = [
    `${exp}.${sig.slice(0, -1)}${sig.endsWith('A') ? 'B' : 'A'}`, // one character of the signature changed
    `${Number(exp) + 1}.${sig}`, // a later expiry on the same signature
    `${exp}.`, 'garbage', '', `99999999999.${sig}`,
    await makeCookieValue('another passkey', NOW),
    await makeCookieValue(SECRET, NOW - (MAX_AGE + 5) * 1000), // expired
  ];
  for (const v of bad) {
    const r = await handle(req('/index.html', { headers: { cookie: `hs_pass=${v}`, accept: '*/*' } }), env, O);
    assert.equal(r.status, 401, v);
  }
  const ok = await handle(req('/index.html', { headers: { cookie: `a=b; hs_pass=${good}; c=d` } }), env, O);
  assert.equal(ok.status, 200);
});

test('cookie verification: expiry, passkey change, shape', async () => {
  const v = await makeCookieValue(SECRET, NOW);
  assert.match(v, /^\d{10}\.[A-Za-z0-9_-]{43}$/);
  assert.equal(Number(v.split('.')[0]), Math.floor(NOW / 1000) + MAX_AGE);
  assert.equal(await verifyCookieValue(SECRET, v, NOW), true);
  assert.equal(await verifyCookieValue(SECRET, v, NOW + (MAX_AGE - 10) * 1000), true);
  assert.equal(await verifyCookieValue(SECRET, v, NOW + (MAX_AGE + 10) * 1000), false);
  assert.equal(await verifyCookieValue('new passkey', v, NOW), false, 'rotating the passkey signs everyone out');
  assert.equal(await verifyCookieValue('', v, NOW), false);
  assert.equal(await verifyCookieValue(SECRET, undefined, NOW), false);
});

test('passkey comparison: exact match only, bounded input', async () => {
  assert.equal(await passkeyMatches(SECRET, SECRET), true);
  assert.equal(await passkeyMatches(SECRET, `  ${SECRET}\n`), true);
  for (const g of ['', 'correct hors', 'correct horse!', 'CORRECT HORSE', 'x'.repeat(5000), undefined, null, 5]) assert.equal(await passkeyMatches(SECRET, g), false);
  assert.equal(await passkeyMatches('', ''), false);
});

test('gate page: noindex, no store, no cache of the passkey', async () => {
  const r = await handle(req('/gate'), ENV(), O);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const body = await r.text();
  assert.match(body, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(body, /type="password"/);
  assert.doesNotMatch(body, /correct horse/);
});

test('wrong passkey: 401, the gate again, no cookie', async () => {
  const r = await handle(req('/gate', form({ passkey: 'nope', next: '/' })), ENV(), O);
  assert.equal(r.status, 401);
  assert.equal(r.headers.get('set-cookie'), null);
  assert.match(await r.text(), /not right/);
});

test('right passkey: 303 with a signed HttpOnly Secure SameSite=Lax 30 day cookie, which then opens the files', async () => {
  const env = ENV();
  const r = await handle(req('/gate', form({ passkey: SECRET, next: '/?menu=1' })), env, O);
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('location'), '/?menu=1');
  const sc = r.headers.get('set-cookie');
  assert.match(sc, /^hs_pass=\d{10}\.[A-Za-z0-9_-]{43}; Path=\/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax$/);
  const cookie = sc.split(';')[0];
  assert.equal((await handle(req('/', { headers: { cookie } }), env, O)).status, 200);
  assert.equal((await handle(req('/gate', { headers: { cookie } }), env, O)).status, 303, 'the gate sends a signed-in visitor on');
});

test('the gate only sends people to paths on this host', async () => {
  for (const [n, want] of [['//evil.test', '/'], ['https://evil.test', '/'], ['/\\evil', '/'], ['/gate', '/'], ['/gate?next=/', '/'], ['/a/b?c=d', '/a/b?c=d'], [undefined, '/'], ['/x\r\nSet-Cookie: a=b', '/']]) {
    assert.equal(safeNext(n), want, String(n));
  }
  const r = await handle(req('/gate', form({ passkey: SECRET, next: '//evil.test' })), ENV(), O);
  assert.equal(r.headers.get('location'), '/');
});

test('the gate takes only small form posts', async () => {
  const env = ENV();
  assert.equal((await handle(req('/gate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }), env, O)).status, 415);
  assert.equal((await handle(req('/gate', form({ passkey: 'x'.repeat(4000) })), env, O)).status, 413);
  assert.equal((await handle(req('/gate', { method: 'PUT' }), env, O)).status, 405);
});

test('robots.txt is public and disallows everything; every response says noindex', async () => {
  const r = await handle(req('/robots.txt'), ENV(), O);
  assert.equal(r.status, 200);
  assert.equal(await r.text(), 'User-agent: *\nDisallow: /\n');
  assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow');
  const cookie = await login(ENV());
  const f = await handle(req('/index.html', { headers: { cookie } }), ENV(), O);
  assert.equal(f.headers.get('x-robots-tag'), 'noindex, nofollow');
});

test('static files: MIME types, no-cache, index for directories, ETag revalidation, HEAD', async () => {
  const env = ENV();
  const cookie = await login(env);
  const get = (p, h = {}) => handle(req(p, { headers: { cookie, ...h } }), env, O);
  const idx = await get('/');
  assert.equal(idx.status, 200);
  assert.equal(idx.headers.get('content-type'), 'text/html');
  assert.equal(idx.headers.get('cache-control'), 'private, no-cache');
  assert.equal(await idx.text(), '<title>MemeSports</title>');
  assert.equal((await get('/main.js')).headers.get('content-type'), 'text/javascript');
  assert.equal((await get('/preload.json')).headers.get('content-type'), 'application/json');
  assert.equal((await get('/memesports.webmanifest')).headers.get('content-type'), 'application/manifest+json');
  assert.equal((await get('/og.png')).headers.get('content-type'), 'image/png');
  assert.equal((await get('/favicon.ico')).headers.get('content-type'), 'image/x-icon');
  const tag = (await get('/main.js')).headers.get('etag');
  assert.equal((await get('/main.js', { 'if-none-match': tag })).status, 304);
  const head = await handle(req('/main.js', { method: 'HEAD', headers: { cookie } }), env, O);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await get('/nope.js')).status, 404);
  assert.equal((await handle(req('/main.js', { method: 'POST', headers: { cookie } }), env, O)).status, 405);
});

test('paths that must not reach the bucket', async () => {
  const env = ENV();
  const cookie = await login(env);
  for (const p of ['/z/abc123.0.br', '/.publish-state.json', '/%2e%2e/secret', '/a//b', '/..%2f..%2fx', '/main.js%00', '/a%5Cb']) {
    const r = await handle(req(p, { headers: { cookie } }), env, O);
    assert.equal(r.status, 404, p);
  }
  assert.equal(keyOf('/'), 'index.html');
  assert.equal(keyOf('/sub/'), 'sub/index.html');
  assert.equal(keyOf('/a%20b.js'), 'a b.js');
  assert.equal(keyOf('/%E0%A4%A'), null);
  assert.ok(!env.BUCKET.gets.some((k) => k.startsWith('z/') || k.startsWith('.')));
});

test('chunks: brotli when accepted, gzip otherwise, with Content-Encoding and the serve-web headers', async () => {
  const env = ENV();
  const cookie = await login(env);
  const br = await handle(req('/chunks/abc123/0', { headers: { cookie, 'accept-encoding': 'gzip, deflate, br' } }), env, O);
  assert.equal(br.status, 200);
  assert.equal(br.headers.get('content-encoding'), 'br');
  assert.equal(br.headers.get('content-type'), 'application/octet-stream');
  assert.equal(br.headers.get('cache-control'), 'private, no-cache');
  assert.equal(br.headers.get('vary'), 'Accept-Encoding');
  assert.equal(br.headers.get('content-length'), String('BR-BYTES'.length));
  assert.equal(await br.text(), 'BR-BYTES');
  const gz = await handle(req('/chunks/abc123/0', { headers: { cookie, 'accept-encoding': 'gzip' } }), env, O);
  assert.equal(gz.headers.get('content-encoding'), 'gzip');
  assert.equal(await gz.text(), 'GZ-BYTES');
  assert.deepEqual(env.BUCKET.gets.slice(-2), ['z/abc123.0.br', 'z/abc123.0.gz']);
});

test('chunks: unknown chunk 404, no accepted encoding 406, malformed paths 404, ETag 304', async () => {
  const env = ENV();
  const cookie = await login(env);
  const ae = { cookie, 'accept-encoding': 'br' };
  assert.equal((await handle(req('/chunks/abc123/9', { headers: ae }), env, O)).status, 404);
  assert.equal((await handle(req('/chunks/ffff/0', { headers: ae }), env, O)).status, 404);
  assert.equal((await handle(req('/chunks/abc123/0', { headers: { cookie, 'accept-encoding': 'identity' } }), env, O)).status, 406);
  for (const p of ['/chunks/ABC/0', '/chunks/abc123/-1', '/chunks/abc123/0/', '/chunks/../x/0', '/chunks/abc123/0.br']) {
    assert.equal((await handle(req(p, { headers: ae }), env, O)).status, 404, p);
  }
  const tag = (await handle(req('/chunks/abc123/0', { headers: ae }), env, O)).headers.get('etag');
  const again = await handle(req('/chunks/abc123/0', { headers: { ...ae, 'if-none-match': tag } }), env, O);
  assert.equal(again.status, 304);
  assert.equal(again.headers.get('content-encoding'), 'br');
});

test('dev endpoints are off; lobby and netplay calls (any method) go to the ONLINE object', async () => {
  const env = ENV();
  const cookie = await login(env);
  assert.equal((await handle(req('/__stats', { headers: { cookie } }), env, O)).status, 404);
  assert.equal((await handle(req('/log', { method: 'POST', headers: { cookie }, body: '[]' }), env, O)).status, 405);
  assert.equal((await handle(req('/log', { headers: { cookie } }), env, O)).status, 404);
  assert.equal((await handle(req('/lobby/ABCDE', { headers: { cookie } }), env, O)).status, 501);
  const seen = [];
  const ONLINE = { idFromName: (n) => 'id:' + n, get: (id) => ({ fetch: async (r) => { seen.push([id, new URL(r.url).pathname, r.method]); return new Response('{}'); } }) };
  for (const [p, method] of [['/lobby/new', 'POST'], ['/lobby/ABCDE/join', 'POST'], ['/lobby/ABCDE', 'GET'], ['/netplay/ABCDE/h', 'POST'], ['/lobby/new', 'OPTIONS']]) {
    assert.equal((await handle(req(p, { method, headers: { cookie } }), { ...env, ONLINE }, O)).status, 200, p);
  }
  assert.deepEqual(seen.map((x) => x[0]), Array(5).fill('id:global'));
  assert.deepEqual(seen.map((x) => x[2]), ['POST', 'POST', 'GET', 'POST', 'OPTIONS']);
  assert.equal((await handle(req('/lobby/new', { method: 'POST' }), { ...env, ONLINE }, O)).status, 401);
  assert.equal(seen.length, 5);
});

test('the default export is the fetch handler', async () => {
  const r = await worker.fetch(req('/'), { SPORTS_PASSKEY: SECRET, BUCKET: bucket() });
  assert.equal(r.status, 401);
});
