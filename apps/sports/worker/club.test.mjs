import test from 'node:test';
import assert from 'node:assert/strict';
import { Club, b64u, cbor, cleanName, clubRequest, derToRaw, mapStore, unb64u } from './club.js';

const H = 'https://sports.halmic.com';
const enc = new TextEncoder();
const sha = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', typeof s === 'string' ? enc.encode(s) : s));
const post = (path, body, token) => new Request(H + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
const get = (path, token) => new Request(H + path, { headers: token ? { authorization: 'Bearer ' + token } : {} });
const call = async (club, req, now = 1000) => { const r = await clubRequest(req, club, now); return { status: r.status, body: await r.json() }; };

// ---- a software authenticator (ES256, "none" attestation), as a browser's would answer ---------------------------
function cborEnc(v) {
  const out = [];
  const head = (mt, n) => {
    if (n < 24) out.push((mt << 5) | n);
    else if (n < 256) out.push((mt << 5) | 24, n);
    else if (n < 65536) out.push((mt << 5) | 25, n >> 8, n & 255);
    else out.push((mt << 5) | 26, (n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255);
  };
  const item = (x) => {
    if (typeof x === 'number') { if (x >= 0) head(0, x); else head(1, -1 - x); }
    else if (typeof x === 'string') { const b = enc.encode(x); head(3, b.length); out.push(...b); }
    else if (x instanceof Uint8Array) { head(2, x.length); out.push(...x); }
    else if (x instanceof Map) { head(5, x.size); for (const [k, w] of x) { item(k); item(w); } }
    else throw new Error('enc');
  };
  item(v);
  return new Uint8Array(out);
}
// DER from raw r || s, as authenticators sign
function rawToDer(raw) {
  const int = (b) => { let i = 0; while (i < b.length - 1 && b[i] === 0) i++; b = b.subarray(i); return b[0] & 0x80 ? [0x02, b.length + 1, 0, ...b] : [0x02, b.length, ...b]; };
  const body = [...int(raw.subarray(0, 32)), ...int(raw.subarray(32))];
  return new Uint8Array([0x30, body.length, ...body]);
}
async function authenticator(rpId = 'sports.halmic.com', origin = H) {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const credId = crypto.getRandomValues(new Uint8Array(16));
  let count = 0;
  const authData = async (at, n) => {
    const head = [...(await sha(rpId)), at ? 0x45 : 0x05, (n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
    if (!at) return new Uint8Array(head);
    const cose = cborEnc(new Map([[1, 2], [3, -7], [-1, 1], [-2, unb64u(jwk.x)], [-3, unb64u(jwk.y)]]));
    return new Uint8Array([...head, ...new Uint8Array(16), 0, credId.length, ...credId, ...cose]);
  };
  const cd = (type, challenge, o = origin) => enc.encode(JSON.stringify({ type, challenge, origin: o, crossOrigin: false }));
  return {
    id: b64u(credId),
    async create(challenge, o) {
      const ad = await authData(true, 0);
      return { id: b64u(credId), clientDataJSON: b64u(cd('webauthn.create', challenge, o)), attestationObject: b64u(cborEnc(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', ad]]))) };
    },
    async get(challenge, { o, n = ++count, tamper } = {}) {
      const ad = await authData(false, n), c = cd('webauthn.get', challenge, o);
      const data = new Uint8Array([...ad, ...(await sha(c))]);
      const raw = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, data));
      if (tamper) raw[5] ^= 1;
      return { id: b64u(credId), clientDataJSON: b64u(c), authenticatorData: b64u(ad), signature: b64u(rawToDer(raw)) };
    },
  };
}
const CHAR = 'ab'.repeat(40);
async function signUp(club, auth, extra = {}) {
  const b = await call(club, post('/club/register/begin', {}));
  assert.equal(b.status, 200);
  return call(club, post('/club/register/finish', { challenge: b.body.challenge, name: 'Ace', owns: true, character: CHAR, cred: await auth.create(b.body.challenge), ...extra }));
}

test('CBOR and DER helpers', () => {
  const m = cbor(cborEnc(new Map([[1, 2], [-3, new Uint8Array([7, 8])], ['k', 'v']])))[0];
  assert.equal(m.get(1), 2); assert.deepEqual([...m.get(-3)], [7, 8]); assert.equal(m.get('k'), 'v');
  assert.throws(() => cbor(new Uint8Array([0x5f])));   // indefinite length
  const raw = new Uint8Array(64).map((_, i) => (i === 0 || i === 32 ? 0x80 : i));
  assert.deepEqual([...derToRaw(rawToDer(raw))], [...raw]);
  assert.equal(cleanName(' A<b>\u0000c '), 'Abc');
});

test('make an account, sign in on another visit, change it, sign out, delete it', async () => {
  const club = new Club(mapStore()), auth = await authenticator();
  const r = await signUp(club, auth);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.account.name, 'Ace'); assert.equal(r.body.account.character, CHAR); assert.equal(r.body.account.owns, 1000);
  const me = await call(club, get('/club/me', r.body.token));
  assert.deepEqual(me.body.account, r.body.account);

  const lb = await call(club, post('/club/login/begin', {}));
  const li = await call(club, post('/club/login/finish', { challenge: lb.body.challenge, cred: await auth.get(lb.body.challenge) }));
  assert.equal(li.status, 200, JSON.stringify(li.body));
  assert.equal(li.body.account.id, r.body.account.id);
  const t = li.body.token;

  const up = await call(club, post('/club/me', { name: 'Bee', character: 'CD'.repeat(10) }, t));
  assert.equal(up.body.account.name, 'Bee'); assert.equal(up.body.account.character, 'cd'.repeat(10));
  assert.equal((await call(club, post('/club/me', { name: '<>' }, t))).status, 400);

  assert.equal((await call(club, post('/club/logout', {}, t))).status, 200);
  assert.equal((await call(club, get('/club/me', t))).status, 401);
  assert.equal((await call(club, get('/club/me', r.body.token))).status, 200);   // the first visit's session stays
  assert.equal((await call(club, post('/club/delete', {}, r.body.token))).status, 200);
  assert.equal((await call(club, get('/club/me', r.body.token))).status, 401);
  const lb2 = await call(club, post('/club/login/begin', {}));
  assert.equal((await call(club, post('/club/login/finish', { challenge: lb2.body.challenge, cred: await auth.get(lb2.body.challenge) }))).status, 404);
});

test('an account needs a name and the ownership confirmation', async () => {
  const club = new Club(mapStore()), auth = await authenticator();
  assert.equal((await signUp(club, auth, { owns: false })).status, 400);
  assert.equal((await signUp(club, auth, { owns: 'yes' })).status, 400);
  assert.equal((await signUp(club, auth, { name: '  ' })).status, 400);
  assert.equal((await signUp(club, auth, { character: 'zz' })).status, 400);
  assert.equal((await signUp(club, auth)).status, 200);
  assert.equal((await signUp(club, auth)).status, 409);   // the same passkey twice
});

test('wrong origin, replayed or stale challenge, bad signature and a counter going back are refused', async () => {
  const club = new Club(mapStore()), auth = await authenticator();
  const b = await call(club, post('/club/register/begin', {}));
  const evil = await call(club, post('/club/register/finish', { challenge: b.body.challenge, name: 'A', owns: true, cred: await auth.create(b.body.challenge, 'https://evil.example') }));
  assert.equal(evil.status, 400);
  // the challenge was used up by that try
  assert.equal((await call(club, post('/club/register/finish', { challenge: b.body.challenge, name: 'A', owns: true, cred: await auth.create(b.body.challenge) }))).status, 400);
  // another site's rp id
  const other = await authenticator('evil.example');
  assert.equal((await signUp(club, other)).status, 400);
  assert.equal((await signUp(club, auth)).status, 200);

  const login = async (opts, now = 1000) => {
    const lb = await call(club, post('/club/login/begin', {}), now);
    return call(club, post('/club/login/finish', { challenge: lb.body.challenge, cred: await auth.get(lb.body.challenge, opts) }), now + (opts?.late || 0));
  };
  assert.equal((await login({ tamper: true })).status, 401);
  assert.equal((await login({ o: 'https://evil.example' })).status, 400);
  assert.equal((await login({ late: 6 * 60_000 })).status, 400);
  assert.equal((await login({ n: 5 })).status, 200);
  assert.equal((await login({ n: 5 })).status, 401);   // not higher than last time
  assert.equal((await login({ n: 6 })).status, 200);
  // a challenge from sign-up is not one for sign-in
  const b2 = await call(club, post('/club/register/begin', {}));
  assert.equal((await call(club, post('/club/login/finish', { challenge: b2.body.challenge, cred: await auth.get(b2.body.challenge) }))).status, 400);
});

test('sessions run out; requests without one are refused', async () => {
  const club = new Club(mapStore()), auth = await authenticator();
  const r = await signUp(club, auth);
  assert.equal((await call(club, get('/club/me', r.body.token), 1000 + 91 * 24 * 3600_000)).status, 401);
  assert.equal((await call(club, post('/club/me', { name: 'X' }))).status, 401);
  assert.equal((await call(club, post('/club/me', { name: 'X' }, 'nope'))).status, 401);
  assert.equal((await call(club, new Request(H + '/club/login/begin', { method: 'POST', body: '{}' }))).status, 400);   // not JSON
});

test('new accounts per address are limited', async () => {
  const club = new Club(mapStore());
  const ipPost = (path, body) => new Request(H + path, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '1.2.3.4' }, body: JSON.stringify(body) });
  for (let i = 0; i < 10; i++) {
    const auth = await authenticator(), b = await call(club, ipPost('/club/register/begin', {}));
    assert.equal((await call(club, ipPost('/club/register/finish', { challenge: b.body.challenge, name: 'A', owns: true, cred: await auth.create(b.body.challenge) }))).status, 200);
  }
  assert.equal((await call(club, ipPost('/club/register/begin', {}))).status, 429);
  assert.equal((await call(club, ipPost('/club/register/begin', {}), 1000 + 3600_000)).status, 200);
});

test('a quick account plays straight away and can take a passkey later', async () => {
  const club = new Club(mapStore()), auth = await authenticator();
  assert.equal((await call(club, post('/club/quick', { name: 'Zip', owns: false }))).status, 400);
  const q = await call(club, post('/club/quick', { name: 'Zip', owns: true, character: CHAR }));
  assert.equal(q.status, 200, JSON.stringify(q.body));
  assert.equal(q.body.account.name, 'Zip'); assert.equal(q.body.account.passkey, false);
  assert.equal((await call(club, post('/club/passkey/begin', {}))).status, 401);
  const b = await call(club, post('/club/passkey/begin', {}, q.body.token));
  const f = await call(club, post('/club/passkey/finish', { challenge: b.body.challenge, cred: await auth.create(b.body.challenge) }, q.body.token));
  assert.equal(f.status, 200, JSON.stringify(f.body));
  assert.equal(f.body.account.passkey, true); assert.equal(f.body.account.id, q.body.account.id);
  const lb = await call(club, post('/club/login/begin', {}));
  const li = await call(club, post('/club/login/finish', { challenge: lb.body.challenge, cred: await auth.get(lb.body.challenge) }));
  assert.equal(li.body.account.id, q.body.account.id, 'the passkey signs in to the quick account');
  // a challenge begun for one account does not attach to another
  const o = await call(club, post('/club/quick', { name: 'Other', owns: true }));
  const b2 = await call(club, post('/club/passkey/begin', {}, q.body.token));
  assert.equal((await call(club, post('/club/passkey/finish', { challenge: b2.body.challenge, cred: await (await authenticator()).create(b2.body.challenge) }, o.body.token))).status, 400);
  assert.equal((await call(club, post('/club/passkey/finish', { challenge: 'x', cred: {} }, q.body.token))).status, 400);
});
