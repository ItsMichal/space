// halmic Worker: static assets plus GET /api/live (is halmictv live on Twitch?). Plain module, no dependencies.
// Secrets (wrangler secret put): TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET. Without them the endpoint answers "unknown" (never an error).
// Only /api/* reaches this Worker (assets.run_worker_first); everything else is served straight from ./public.
const CHANNEL = 'halmictv';
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const HELIX_URL = `https://api.twitch.tv/helix/streams?user_login=${CHANNEL}`;
const TOKEN_KEY = 'https://halmic.internal/twitch-token';   // synthetic cache key, never fetched
const FRESH = 45, STALE = 300, UNKNOWN_MISSING = 300, UNKNOWN_ERROR = 60;

const mem = { token: null, exp: 0 };   // module-level token cache (per isolate)

// Pure: Helix /streams payload -> the status the page needs. No viewer counts on purpose.
export function mapStreams(payload) {
  const s = payload?.data?.[0];
  if (!s) return { live: false };
  return { live: true, title: s.title ?? '', game: s.game_name ?? '', startedAt: s.started_at ?? undefined };
}

// Pure: status + time -> { body, maxAge }.
export function buildResponse(status, now, maxAge = FRESH) {
  return { body: { ...status, checkedAt: new Date(now).toISOString() }, maxAge };
}
const unknown = (now, maxAge) => buildResponse({ live: false, unknown: true }, now, maxAge);

async function getToken(env, deps, force) {
  const { fetchFn, cache, now, state } = deps;
  if (!force) {
    if (state.token && state.exp > now) return state.token;
    if (cache) {
      const hit = await cache.match(TOKEN_KEY).catch(() => null);
      const t = hit && (await hit.json().catch(() => null));
      if (t?.token && t.exp > now) { state.token = t.token; state.exp = t.exp; return t.token; }
    }
  }
  const r = await fetchFn(TOKEN_URL, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.TWITCH_CLIENT_ID, client_secret: env.TWITCH_CLIENT_SECRET, grant_type: 'client_credentials' }),
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`token ${r.status}`);
  const j = await r.json();
  if (!j.access_token) throw new Error('token missing');
  const ttl = Math.max(60, (j.expires_in ?? 3600) - 300);
  state.token = j.access_token; state.exp = now + ttl * 1000;
  if (cache) await cache.put(TOKEN_KEY, new Response(JSON.stringify({ token: state.token, exp: state.exp }), { headers: { 'cache-control': `max-age=${ttl}` } })).catch(() => {});
  return state.token;
}

// deps: { fetchFn, cache, now, state } are injectable for tests.
export async function getLive(env, deps = {}) {
  const d = { fetchFn: deps.fetchFn ?? fetch, cache: deps.cache ?? globalThis.caches?.default, now: deps.now ?? Date.now(), state: deps.state ?? mem };
  if (!env?.TWITCH_CLIENT_ID || !env?.TWITCH_CLIENT_SECRET) return unknown(d.now, UNKNOWN_MISSING);
  try {
    const helix = (token) => d.fetchFn(HELIX_URL, { headers: { authorization: `Bearer ${token}`, 'client-id': env.TWITCH_CLIENT_ID }, signal: AbortSignal.timeout(5000) });
    let r = await helix(await getToken(env, d, false));
    if (r.status === 401) r = await helix(await getToken(env, d, true));   // token revoked or expired early: refresh once
    if (!r.ok) throw new Error(`helix ${r.status}`);
    return buildResponse(mapStreams(await r.json()), d.now);
  } catch {
    return unknown(d.now, UNKNOWN_ERROR);
  }
}

const SEC = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' };
const json = (body, status, cc, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cc, ...SEC, ...extra } });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname !== '/api/live') return json({ error: 'not found' }, 404, 'no-store');
    if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405, 'no-store', { allow: 'GET' });
    const cache = globalThis.caches?.default;
    const key = new Request(`${url.origin}/api/live`);   // query strings do not bust the cache
    const hit = cache && (await cache.match(key).catch(() => null));
    if (hit) return hit;
    const { body, maxAge } = await getLive(env, { cache });
    const res = json(body, 200, maxAge === FRESH ? `public, max-age=${FRESH}, stale-while-revalidate=${STALE}` : `public, max-age=${maxAge}`);
    if (cache) ctx?.waitUntil(cache.put(key, res.clone()).catch(() => {}));
    return res;
  },
};
