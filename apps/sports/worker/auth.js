// Passkey gate: one shared passkey (the Worker secret SPORTS_PASSKEY) opens a signed cookie.
// The cookie is "<expiry unix seconds>.<base64url HMAC-SHA256>", keyed with the passkey itself, so changing the passkey
// signs everyone out. Nothing is stored server side.
export const COOKIE = 'hs_pass';
export const MAX_AGE = 30 * 24 * 3600;
const enc = new TextEncoder();

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const hmacKey = (secret) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const mac = async (secret, msg) => new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(msg)));

/** The usable passkey from the environment, or '' when none is set (then the Worker refuses everything). */
export const passkeyOf = (env) => (typeof env?.SPORTS_PASSKEY === 'string' ? env.SPORTS_PASSKEY.trim() : '');

/** Constant-time check of a submitted passkey: both sides are MACed to 32 bytes first, then compared without early exit. */
export async function passkeyMatches(secret, given) {
  if (!secret || typeof given !== 'string' || given.length > 256) return false;
  const a = await mac(secret, `sports.passkey.${given.trim()}`);
  const b = await mac(secret, `sports.passkey.${secret}`);
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

/** A cookie value valid for MAX_AGE seconds from `now` (ms). */
export async function makeCookieValue(secret, now = Date.now()) {
  const exp = Math.floor(now / 1000) + MAX_AGE;
  return `${exp}.${b64u(await mac(secret, `sports.cookie.${exp}`))}`;
}

/** True when `value` is a cookie this passkey signed and it has not expired. crypto.subtle.verify compares in constant time. */
export async function verifyCookieValue(secret, value, now = Date.now()) {
  const m = /^(\d{1,12})\.([A-Za-z0-9_-]{43})$/.exec(value || '');
  if (!secret || !m) return false;
  const exp = Number(m[1]);
  if (!(exp > now / 1000)) return false;
  try {
    return await crypto.subtle.verify('HMAC', await hmacKey(secret), unb64u(m[2]), enc.encode(`sports.cookie.${exp}`));
  } catch {
    return false;
  }
}

export function readCookie(req, name = COOKIE) {
  for (const part of (req.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

export const setCookieHeader = (value) => `${COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;

export const isAuthed = (req, secret, now = Date.now()) => verifyCookieValue(secret, readCookie(req), now);
