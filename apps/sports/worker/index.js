// sports.halmic.com: a private host for the browser build of the game, behind one shared passkey.
//
// Serves what scripts/serve-web.mjs serves for build/web (the game repo), from the R2 bucket bound as BUCKET:
//   - static files by path (directories answer with index.html), MIME types and `Cache-Control: no-cache` as there;
//   - /chunks/<hash>/<i>: chunk i of a preload.json file, from the precompressed object z/<hash>.<i>.br or .gz with
//     Content-Encoding (the Worker never recompresses: encodeBody "manual"). The raw wasm, data and disc files are not
//     uploaded: the page only ever reads them through these chunks (web/preload.js).
// Dev-only endpoints of serve-web are not exposed: /__stats and the debug log POST answer 404. The online lobby and
// netplay mailbox (/lobby, /netplay) are not built here yet and answer 501.
//
// Every path except /gate needs the cookie from a correct passkey. Without the SPORTS_PASSKEY secret everything answers 503.
import { isAuthed, makeCookieValue, passkeyMatches, passkeyOf, setCookieHeader } from './auth.js';
import { gatePage } from './gate-page.js';

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};
const ROBOTS = 'User-agent: *\nDisallow: /\n';
const FAIL_DELAY_MS = 500;

const base = () => ({ 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' });
const text = (status, body, extra = {}) =>
  new Response(body, { status, headers: { ...base(), 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });
const html = (status, body) =>
  new Response(body, {
    status,
    headers: {
      ...base(),
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });

/** A same-site path to return to after the gate; anything else becomes "/". */
export function safeNext(v) {
  if (typeof v !== 'string' || v.length > 2048 || !v.startsWith('/') || v.startsWith('//') || v.includes('\\') || /[\r\n]/.test(v)) return '/';
  return v === '/gate' || v.startsWith('/gate?') || v.startsWith('/gate/') ? '/' : v;
}

async function gate(req, url, secret, opts, authed) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (authed) return new Response(null, { status: 303, headers: { ...base(), Location: safeNext(url.searchParams.get('next')), 'Cache-Control': 'no-store' } });
    return html(200, gatePage({ next: safeNext(url.searchParams.get('next')) }));
  }
  if (req.method !== 'POST') return text(405, 'method not allowed', { Allow: 'GET, HEAD, POST' });
  if (!(req.headers.get('content-type') || '').startsWith('application/x-www-form-urlencoded')) return text(415, 'unsupported media type');
  if (Number(req.headers.get('content-length') || 0) > 2048) return text(413, 'too large');
  const body = await req.text();
  if (body.length > 2048) return text(413, 'too large');
  const form = new URLSearchParams(body);
  const next = safeNext(form.get('next'));
  if (await passkeyMatches(secret, form.get('passkey') || '')) {
    return new Response(null, { status: 303, headers: { ...base(), Location: next, 'Set-Cookie': setCookieHeader(await makeCookieValue(secret, opts.now)), 'Cache-Control': 'no-store' } });
  }
  await new Promise((r) => setTimeout(r, opts.failDelayMs ?? FAIL_DELAY_MS));
  return html(401, gatePage({ next, error: 'That passkey is not right.' }));
}

const etagMatch = (req, obj) => {
  const inm = req.headers.get('if-none-match');
  return !!inm && !!obj.httpEtag && inm.split(',').some((t) => t.trim().replace(/^W\//, '') === obj.httpEtag);
};

async function serveChunk(req, env, h, i) {
  const ae = req.headers.get('accept-encoding') || '';
  const enc = /\bbr\b/.test(ae) ? 'br' : /\bgzip\b/.test(ae) ? 'gz' : '';
  // serve-web falls back to slicing the raw file for a client that takes neither; the raw files are not here
  if (!enc) return text(406, 'this host serves compressed chunks only', { Vary: 'Accept-Encoding' });
  const obj = await env.BUCKET.get(`z/${h}.${i}.${enc}`);
  if (!obj) return text(404, 'no such chunk');
  const headers = {
    ...base(),
    'Content-Type': 'application/octet-stream',
    'Cache-Control': 'private, no-cache',
    Vary: 'Accept-Encoding',
    'Content-Encoding': enc === 'br' ? 'br' : 'gzip',
    'Content-Length': String(obj.size),
    ...(obj.httpEtag ? { ETag: obj.httpEtag } : {}),
  };
  if (etagMatch(req, obj)) { obj.body?.cancel?.(); return new Response(null, { status: 304, headers }); }
  return new Response(req.method === 'HEAD' ? null : obj.body, { status: 200, headers, encodeBody: 'manual' });
}

/** The R2 key for a request path, or null when the path is not one the game may read. */
export function keyOf(pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch { return null; }
  if (p.includes('\0') || p.includes('\\')) return null;
  const parts = p.split('/').slice(1);
  if (parts[parts.length - 1] === '') parts[parts.length - 1] = 'index.html';
  // no empty, dot or dot-dot segments (also keeps the bucket's own bookkeeping, ".publish-state.json", unreachable);
  // z/ holds the compressed chunks and is only reachable through /chunks
  if (parts.some((s) => s === '' || s.startsWith('.')) || parts[0] === 'z') return null;
  return parts.join('/');
}

async function serveStatic(req, env, pathname) {
  const key = keyOf(pathname);
  const obj = key && (await env.BUCKET.get(key));
  if (!obj) return text(404, 'not found');
  const ext = key.includes('.') ? key.slice(key.lastIndexOf('.')) : '';
  const headers = { ...base(), 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'private, no-cache', ...(obj.httpEtag ? { ETag: obj.httpEtag } : {}) };
  if (etagMatch(req, obj)) { obj.body?.cancel?.(); return new Response(null, { status: 304, headers }); }
  return new Response(req.method === 'HEAD' ? null : obj.body, { status: 200, headers });
}

export async function handle(req, env, opts = {}) {
  const secret = passkeyOf(env);
  if (!secret) return text(503, 'not configured');
  const url = new URL(req.url);
  const path = url.pathname;
  const authed = await isAuthed(req, secret, opts.now);

  if (path === '/gate') return gate(req, url, secret, opts, authed);

  if (!authed) {
    if (path === '/robots.txt' && (req.method === 'GET' || req.method === 'HEAD')) {
      return text(200, req.method === 'HEAD' ? null : ROBOTS, { 'Cache-Control': 'public, max-age=3600' });
    }
    const nav = (req.method === 'GET' || req.method === 'HEAD') && (req.headers.get('accept') || '').includes('text/html');
    if (nav) return new Response(null, { status: 303, headers: { ...base(), Location: `/gate?next=${encodeURIComponent(safeNext(path + url.search))}`, 'Cache-Control': 'no-store' } });
    return text(401, 'passkey required');
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return text(405, 'method not allowed', { Allow: 'GET, HEAD' });
  if (path === '/robots.txt') return text(200, req.method === 'HEAD' ? null : ROBOTS, { 'Cache-Control': 'public, max-age=3600' });
  if (path === '/__stats' || path === '/log') return text(404, 'not found');
  if (path.startsWith('/lobby') || path.startsWith('/netplay')) {
    return new Response(JSON.stringify({ err: 'online play is not available on this host yet' }), { status: 501, headers: { ...base(), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
  const cm = /^\/chunks\/([0-9a-f]{1,64})\/(\d{1,6})$/.exec(path);
  if (cm) return serveChunk(req, env, cm[1], Number(cm[2]));
  return serveStatic(req, env, path);
}

export default { fetch: (req, env) => handle(req, env) };
