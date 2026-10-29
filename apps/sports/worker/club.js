// Accounts (the game repo's docs/club.md stage 4): one Durable Object, `Club`, named "global", SQLite storage.
//
// An account is a display name, a character and a passkey (WebAuthn: the device's own sign-in; no password, no e-mail).
// Making one needs the player to confirm they own the original game; the confirmation and its time are kept with it.
//   POST /club/register/begin  {}                                   -> {challenge, user}       (user: the new account's id)
//   POST /club/register/finish {challenge, name, owns, character, cred: {id, clientDataJSON, attestationObject}}
//                                                                   -> {token, account}
//   POST /club/login/begin     {}                                   -> {challenge}
//   POST /club/login/finish    {challenge, cred: {id, clientDataJSON, authenticatorData, signature}} -> {token, account}
//   GET  /club/me                                                   -> {account}               (Authorization: Bearer <token>)
//   POST /club/me              {name?, character?}                  -> {account}
//   POST /club/logout          {}                                   -> {}
//   POST /club/delete          {}                                   -> {}                      (the account and everything with it)
// Friends, presence, chat and matchmaking: social.js (the same object, the same sessions).
// Binary fields are base64url. The page builds the WebAuthn options itself (rp id = the page's host name); the server
// checks the challenge, the origin (the request's own), the rp id hash, user presence and the signature. Attestation is
// not asked for ("none"). A session is a random token; only its SHA-256 is stored.
//
// This file has no Worker-only imports: the game repo's local server (tools/lan/club.mjs) is a copy of it.
export const SESSION_MS = 90 * 24 * 3600_000;
export const CHALLENGE_MS = 5 * 60_000;
const MAX_BODY = 16_384;
const MAX_CHALLENGES = 5000;
const SIGNUPS_PER_HOUR = 10;   // per address
export const NAME_MAX = 16;
const CHARACTER = /^[0-9a-f]{2,512}$/;
const B64U = /^[A-Za-z0-9_-]{1,8192}$/;

const enc = new TextEncoder(), dec = new TextDecoder();
export const b64u = (buf) => {
  const a = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const sha256 = async (data) => new Uint8Array(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data));
const random = (n) => b64u(crypto.getRandomValues(new Uint8Array(n)));
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** A display name as stored: printable, trimmed, at most NAME_MAX characters; '' when nothing is left. */
export function cleanName(v) {
  if (typeof v !== 'string') return '';
  return [...v.replace(/[\p{C}<>&"'`\\]/gu, '').trim()].slice(0, NAME_MAX).join('').trim();
}

// ---- CBOR (the subset WebAuthn uses: ints, byte and text strings, arrays, maps, simple values) ----------------------
/** The item at `p` in `buf`: [value, the offset after it]. Maps become Map (COSE keys are integers). */
export function cbor(buf, p = 0) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const need = (n) => { if (p + n > buf.length) throw new Error('cbor: short'); };
  const arg = (ai) => {
    if (ai < 24) return ai;
    if (ai === 24) { need(1); return buf[p++]; }
    if (ai === 25) { need(2); p += 2; return dv.getUint16(p - 2); }
    if (ai === 26) { need(4); p += 4; return dv.getUint32(p - 4); }
    if (ai === 27) { need(8); p += 8; const v = dv.getBigUint64(p - 8); if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('cbor: big'); return Number(v); }
    throw new Error('cbor: indefinite');
  };
  const item = (depth) => {
    if (depth > 16) throw new Error('cbor: deep');
    need(1);
    const b = buf[p++], mt = b >> 5, ai = b & 31;
    if (mt === 7) {
      if (ai === 20) return false;
      if (ai === 21) return true;
      if (ai === 22) return null;
      throw new Error('cbor: simple');
    }
    const n = arg(ai);
    if (mt === 0) return n;
    if (mt === 1) return -1 - n;
    if (mt === 2) { need(n); return buf.slice(p, (p += n)); }
    if (mt === 3) { need(n); return dec.decode(buf.subarray(p, (p += n))); }
    if (mt === 4) { const a = []; for (let i = 0; i < n; i++) a.push(item(depth + 1)); return a; }
    if (mt === 5) { const m = new Map(); for (let i = 0; i < n; i++) { const k = item(depth + 1); m.set(k, item(depth + 1)); } return m; }
    throw new Error('cbor: tag');
  };
  const v = item(0);
  return [v, p];
}

/** authenticatorData: {rpIdHash, flags, count, credId?, key? (a COSE Map)}. */
export function parseAuthData(a) {
  if (a.length < 37) throw new Error('authData: short');
  const out = { rpIdHash: a.slice(0, 32), flags: a[32], count: new DataView(a.buffer, a.byteOffset + 33, 4).getUint32(0) };
  if (out.flags & 0x40) {   // AT: attested credential data
    if (a.length < 55) throw new Error('authData: short');
    const n = (a[53] << 8) | a[54];
    if (55 + n > a.length) throw new Error('authData: short');
    out.credId = a.slice(55, 55 + n);
    const [key] = cbor(a, 55 + n);
    out.key = key;
  }
  return out;
}

/** A COSE public key as {jwk, alg} for WebCrypto, or null when the kind is not one we take (ES256, RS256, EdDSA). */
export function coseToJwk(k) {
  if (!(k instanceof Map)) return null;
  const kty = k.get(1), alg = k.get(3);
  if (kty === 2 && alg === -7 && k.get(-1) === 1 && k.get(-2)?.length === 32 && k.get(-3)?.length === 32)
    return { alg: -7, jwk: { kty: 'EC', crv: 'P-256', x: b64u(k.get(-2)), y: b64u(k.get(-3)) } };
  if (kty === 3 && alg === -257 && k.get(-1)?.length >= 256 && k.get(-2)?.length)
    return { alg: -257, jwk: { kty: 'RSA', n: b64u(k.get(-1)), e: b64u(k.get(-2)) } };
  if (kty === 1 && alg === -8 && k.get(-1) === 6 && k.get(-2)?.length === 32)
    return { alg: -8, jwk: { kty: 'OKP', crv: 'Ed25519', x: b64u(k.get(-2)) } };
  return null;
}

/** An ECDSA signature from DER (what authenticators send) to the raw r || s WebCrypto checks. */
export function derToRaw(sig, size = 32) {
  let p = 0;
  const take = () => {
    if (sig[p++] !== 0x02) throw new Error('der');
    const n = sig[p++];
    let v = sig.subarray(p, (p += n));
    while (v.length > size && v[0] === 0) v = v.subarray(1);
    if (v.length > size) throw new Error('der');
    const out = new Uint8Array(size); out.set(v, size - v.length); return out;
  };
  if (sig[p++] !== 0x30) throw new Error('der');
  if (sig[p] & 0x80) p += 1 + (sig[p] & 0x7f); else p++;
  const r = take(), s = take();
  const raw = new Uint8Array(2 * size); raw.set(r); raw.set(s, size); return raw;
}

const ALGS = {
  [-7]: { imp: { name: 'ECDSA', namedCurve: 'P-256' }, ver: { name: 'ECDSA', hash: 'SHA-256' }, raw: (s) => derToRaw(s) },
  [-257]: { imp: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, ver: { name: 'RSASSA-PKCS1-v1_5' }, raw: (s) => s },
  [-8]: { imp: { name: 'Ed25519' }, ver: { name: 'Ed25519' }, raw: (s) => s },
};
export async function verifySig(alg, jwk, sig, data) {
  const a = ALGS[alg];
  if (!a) return false;
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, a.imp, false, ['verify']);
    return await crypto.subtle.verify(a.ver, key, a.raw(sig), data);
  } catch { return false; }
}

/** clientDataJSON checked against what this ceremony expects; the challenge it carries, or null. */
function clientData(bytes, type, origin) {
  let c;
  try { c = JSON.parse(dec.decode(bytes)); } catch { return null; }
  if (!c || c.type !== type || c.origin !== origin || typeof c.challenge !== 'string' || c.crossOrigin === true) return null;
  return c.challenge;
}

const bytesOf = (v) => (typeof v === 'string' && B64U.test(v) ? unb64u(v) : null);

// ---- the accounts over a small store (the Durable Object's SQL, or Maps in the tests and the local server) ---------
export class Club {
  constructor(db) { this.db = db; this.signups = new Map(); }

  account(id) {
    const a = this.db.account(id);
    return a && { id: a.id, name: a.name, character: a.character || '', owns: a.owns_at, created: a.created };
  }

  challenge(kind, account, now) {
    this.db.dropChallenges(now);
    if (this.db.challenges() >= MAX_CHALLENGES) return null;
    const c = random(32);
    this.db.putChallenge(c, kind, account || '', now + CHALLENGE_MS);
    return c;
  }
  take(c, kind, now) {
    if (typeof c !== 'string' || !B64U.test(c)) return null;
    const row = this.db.takeChallenge(c);
    return row && row.kind === kind && row.exp > now ? row : null;
  }
  async session(account, now) {
    const token = random(32);
    this.db.putSession(b64u(await sha256(token)), account, now + SESSION_MS);
    return token;
  }
  async who(token, now) {
    if (typeof token !== 'string' || !B64U.test(token)) return null;
    const s = this.db.session(b64u(await sha256(token)));
    return s && s.exp > now ? s.account : null;
  }

  registerBegin(ip, now) {
    const hour = Math.floor(now / 3600_000), k = ip || '?', r = this.signups.get(k);
    if (r && r.hour === hour && r.n >= SIGNUPS_PER_HOUR) return { status: 429, body: { err: 'too many new accounts from here; try later' } };
    const user = random(16), challenge = this.challenge('create', user, now);
    return challenge ? { body: { challenge, user } } : { status: 503, body: { err: 'busy' } };
  }

  async registerFinish(o, origin, rpId, ip, now) {
    const name = cleanName(o?.name), character = typeof o?.character === 'string' ? o.character.toLowerCase() : '';
    if (!name) return { status: 400, body: { err: 'a name is needed' } };
    if (o?.owns !== true) return { status: 400, body: { err: 'confirm you own the original game first' } };
    if (character && !CHARACTER.test(character)) return { status: 400, body: { err: 'bad character' } };
    const ch = this.take(o?.challenge, 'create', now);
    if (!ch) return { status: 400, body: { err: 'that took too long; try again' } };
    const cd = bytesOf(o?.cred?.clientDataJSON), ao = bytesOf(o?.cred?.attestationObject), id = o?.cred?.id;
    if (!cd || !ao || typeof id !== 'string' || !B64U.test(id)) return { status: 400, body: { err: 'bad credential' } };
    if (clientData(cd, 'webauthn.create', origin) !== o.challenge) return { status: 400, body: { err: 'the passkey answered for another page' } };
    let att, ad;
    try { [att] = cbor(ao); ad = parseAuthData(att.get('authData')); } catch { return { status: 400, body: { err: 'bad credential' } }; }
    if (!same(ad.rpIdHash, await sha256(rpId)) || !(ad.flags & 1) || !ad.credId || b64u(ad.credId) !== id) return { status: 400, body: { err: 'bad credential' } };
    const key = coseToJwk(ad.key);
    if (!key) return { status: 400, body: { err: 'this kind of passkey is not supported' } };
    if (this.db.cred(id)) return { status: 409, body: { err: 'that passkey already has an account' } };
    this.db.putAccount({ id: ch.account, name, character, owns_at: now, created: now });
    this.db.putCred({ id, account: ch.account, jwk: JSON.stringify(key.jwk), alg: key.alg, count: ad.count, created: now });
    const hour = Math.floor(now / 3600_000), k = ip || '?', r = this.signups.get(k);
    this.signups.set(k, r && r.hour === hour ? { hour, n: r.n + 1 } : { hour, n: 1 });
    if (this.signups.size > 10_000) this.signups.clear();
    return { body: { token: await this.session(ch.account, now), account: this.account(ch.account) } };
  }

  loginBegin(now) {
    const challenge = this.challenge('get', '', now);
    return challenge ? { body: { challenge } } : { status: 503, body: { err: 'busy' } };
  }

  async loginFinish(o, origin, rpId, now) {
    if (!this.take(o?.challenge, 'get', now)) return { status: 400, body: { err: 'that took too long; try again' } };
    const cd = bytesOf(o?.cred?.clientDataJSON), ad = bytesOf(o?.cred?.authenticatorData), sig = bytesOf(o?.cred?.signature), id = o?.cred?.id;
    if (!cd || !ad || !sig || typeof id !== 'string' || !B64U.test(id)) return { status: 400, body: { err: 'bad credential' } };
    const cred = this.db.cred(id);
    if (!cred) return { status: 404, body: { err: 'no account has that passkey' } };
    if (clientData(cd, 'webauthn.get', origin) !== o.challenge) return { status: 400, body: { err: 'the passkey answered for another page' } };
    let a;
    try { a = parseAuthData(ad); } catch { return { status: 400, body: { err: 'bad credential' } }; }
    if (!same(a.rpIdHash, await sha256(rpId)) || !(a.flags & 1)) return { status: 400, body: { err: 'bad credential' } };
    const data = new Uint8Array(ad.length + 32); data.set(ad); data.set(await sha256(cd), ad.length);
    if (!(await verifySig(cred.alg, JSON.parse(cred.jwk), sig, data))) return { status: 401, body: { err: 'the passkey did not check out' } };
    // a counter that did not go up means a copied authenticator (synced passkeys keep it at 0)
    if ((a.count || cred.count) && a.count <= cred.count) return { status: 401, body: { err: 'the passkey did not check out' } };
    this.db.usedCred(id, a.count, now);
    return { body: { token: await this.session(cred.account, now), account: this.account(cred.account) } };
  }

  update(account, o) {
    const a = this.db.account(account);
    if (!a) return { status: 404, body: { err: 'no such account' } };
    const name = o?.name === undefined ? a.name : cleanName(o.name);
    const character = o?.character === undefined ? a.character : typeof o.character === 'string' ? o.character.toLowerCase() : null;
    if (!name) return { status: 400, body: { err: 'a name is needed' } };
    if (character == null || (character && !CHARACTER.test(character))) return { status: 400, body: { err: 'bad character' } };
    this.db.setAccount(account, name, character);
    return { body: { account: this.account(account) } };
  }
}

/** The store over Durable Object SQLite (ctx.storage.sql). */
export function sqlStore(sql) {
  sql.exec('CREATE TABLE IF NOT EXISTS account (id TEXT PRIMARY KEY, name TEXT NOT NULL, character TEXT NOT NULL, owns_at INTEGER NOT NULL, created INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS cred (id TEXT PRIMARY KEY, account TEXT NOT NULL, jwk TEXT NOT NULL, alg INTEGER NOT NULL, count INTEGER NOT NULL, created INTEGER NOT NULL, used INTEGER)');
  sql.exec('CREATE INDEX IF NOT EXISTS cred_by_account ON cred (account)');
  sql.exec('CREATE TABLE IF NOT EXISTS session (hash TEXT PRIMARY KEY, account TEXT NOT NULL, exp INTEGER NOT NULL)');
  sql.exec('CREATE INDEX IF NOT EXISTS session_by_account ON session (account)');
  sql.exec('CREATE TABLE IF NOT EXISTS challenge (c TEXT PRIMARY KEY, kind TEXT NOT NULL, account TEXT NOT NULL, exp INTEGER NOT NULL)');
  const one = (cur) => cur.toArray()[0] || null;
  return {
    account: (id) => one(sql.exec('SELECT * FROM account WHERE id = ?', id)),
    putAccount: (a) => sql.exec('INSERT INTO account (id, name, character, owns_at, created) VALUES (?, ?, ?, ?, ?)', a.id, a.name, a.character, a.owns_at, a.created),
    setAccount: (id, name, character) => sql.exec('UPDATE account SET name = ?, character = ? WHERE id = ?', name, character, id),
    dropAccount: (id) => {
      sql.exec('DELETE FROM session WHERE account = ?', id);
      sql.exec('DELETE FROM cred WHERE account = ?', id);
      sql.exec('DELETE FROM account WHERE id = ?', id);
    },
    cred: (id) => one(sql.exec('SELECT * FROM cred WHERE id = ?', id)),
    putCred: (c) => sql.exec('INSERT INTO cred (id, account, jwk, alg, count, created) VALUES (?, ?, ?, ?, ?, ?)', c.id, c.account, c.jwk, c.alg, c.count, c.created),
    usedCred: (id, count, at) => sql.exec('UPDATE cred SET count = ?, used = ? WHERE id = ?', count, at, id),
    session: (hash) => one(sql.exec('SELECT account, exp FROM session WHERE hash = ?', hash)),
    putSession: (hash, account, exp) => {
      sql.exec('DELETE FROM session WHERE exp < ?', Date.now());
      sql.exec('INSERT INTO session (hash, account, exp) VALUES (?, ?, ?)', hash, account, exp);
    },
    dropSession: (hash) => sql.exec('DELETE FROM session WHERE hash = ?', hash),
    putChallenge: (c, kind, account, exp) => sql.exec('INSERT INTO challenge (c, kind, account, exp) VALUES (?, ?, ?, ?)', c, kind, account, exp),
    takeChallenge: (c) => { const r = one(sql.exec('SELECT kind, account, exp FROM challenge WHERE c = ?', c)); if (r) sql.exec('DELETE FROM challenge WHERE c = ?', c); return r; },
    dropChallenges: (now) => sql.exec('DELETE FROM challenge WHERE exp < ?', now),
    challenges: () => sql.exec('SELECT COUNT(*) AS n FROM challenge').one().n,
  };
}

/** The same store over Maps (the tests, the game repo's local server). */
export function mapStore() {
  const account = new Map(), cred = new Map(), session = new Map(), challenge = new Map();
  return {
    account: (id) => account.get(id) || null,
    putAccount: (a) => account.set(a.id, { ...a }),
    setAccount: (id, name, character) => Object.assign(account.get(id), { name, character }),
    dropAccount: (id) => {
      for (const [k, v] of session) if (v.account === id) session.delete(k);
      for (const [k, v] of cred) if (v.account === id) cred.delete(k);
      account.delete(id);
    },
    cred: (id) => cred.get(id) || null,
    putCred: (c) => cred.set(c.id, { ...c }),
    usedCred: (id, count, at) => Object.assign(cred.get(id), { count, used: at }),
    session: (hash) => session.get(hash) || null,
    putSession: (hash, account_, exp) => session.set(hash, { account: account_, exp }),
    dropSession: (hash) => session.delete(hash),
    putChallenge: (c, kind, account_, exp) => challenge.set(c, { kind, account: account_, exp }),
    takeChallenge: (c) => { const r = challenge.get(c) || null; challenge.delete(c); return r; },
    dropChallenges: (now) => { for (const [k, v] of challenge) if (v.exp < now) challenge.delete(k); },
    challenges: () => challenge.size,
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
const bearer = (req) => /^Bearer ([A-Za-z0-9_-]{1,100})$/.exec(req.headers.get('authorization') || '')?.[1] || '';

/** The requests of /club against a Club (inside the Durable Object); social: the friends, chat and matches (social.js). */
export async function clubRequest(req, club, now, social = null) {
  const url = new URL(req.url), path = url.pathname, origin = url.origin, rpId = url.hostname;
  const ip = req.headers.get('cf-connecting-ip') || '';
  const out = (r) => json(r.status || 200, r.body);
  if (path === '/club/me' && req.method === 'GET') {
    const who = await club.who(bearer(req), now);
    return who ? out(club.account(who) ? { body: { account: club.account(who) } } : { status: 401, body: { err: 'signed out' } }) : json(401, { err: 'signed out' });
  }
  if (req.method === 'GET' && social) {
    const who = await club.who(bearer(req), now);
    if (!who || !club.account(who)) return json(401, { err: 'signed out' });
    const r = await social.request(req, url, who, {});
    return r ? out(r) : json(404, { err: 'not found' });
  }
  if (req.method !== 'POST') return json(404, { err: 'not found' });
  const body = await readJson(req);
  if (body === undefined) return json(400, { err: 'bad request' });
  switch (path) {
    case '/club/register/begin': return out(club.registerBegin(ip, now));
    case '/club/register/finish': return out(await club.registerFinish(body, origin, rpId, ip, now));
    case '/club/login/begin': return out(club.loginBegin(now));
    case '/club/login/finish': return out(await club.loginFinish(body, origin, rpId, now));
  }
  const token = bearer(req), who = await club.who(token, now);
  if (!who) return json(401, { err: 'signed out' });
  switch (path) {
    case '/club/me': return out(club.update(who, body));
    case '/club/logout': club.db.dropSession(b64u(await sha256(token))); return json(200, {});
    case '/club/delete': social?.forget(who); club.db.dropAccount(who); return json(200, {});
  }
  const r = social && body && typeof body === 'object' ? await social.request(req, url, who, body) : null;
  return r ? out(r) : json(404, { err: 'not found' });
}
