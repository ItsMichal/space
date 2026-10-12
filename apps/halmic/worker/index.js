// halmic Worker: static assets plus GET /api/live (is halmictv live on Twitch?) and GET /api/clips (top clips). Plain module, no dependencies.
// Secrets (wrangler secret put): TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET. Without them the endpoint answers "unknown" (never an error).
// Only /api/* reaches this Worker (assets.run_worker_first); everything else is served straight from ./public.
const CHANNEL = 'halmictv';
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const HELIX_URL = `https://api.twitch.tv/helix/streams?user_login=${CHANNEL}`;
const TOKEN_KEY = 'https://halmic.internal/twitch-token';   // synthetic cache key, never fetched
const ID_KEY = 'https://halmic.internal/twitch-broadcaster-id';
const FRESH = 45, STALE = 300, UNKNOWN_MISSING = 300, UNKNOWN_ERROR = 60, CLIPS_FRESH = 3600, CLIPS_STALE = 86400, DAY = 86400, MAX_CLIPS = 6;
const CLIP_ID = /^[A-Za-z0-9_-]+$/;

const mem = { token: null, exp: 0 };   // module-level token cache (per isolate)
const idMem = { id: null, exp: 0 };    // broadcaster id, same idea

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

const deps_ = (deps) => ({ fetchFn: deps.fetchFn ?? fetch, cache: deps.cache ?? globalThis.caches?.default, now: deps.now ?? Date.now(), state: deps.state ?? mem, ids: deps.ids ?? idMem });
const hasSecrets = (env) => !!(env?.TWITCH_CLIENT_ID && env?.TWITCH_CLIENT_SECRET);

// One Helix GET with the app token; a 401 (token revoked or expired early) refreshes the token once and retries.
async function helixGet(url, env, d) {
  const go = (token) => d.fetchFn(url, { headers: { authorization: `Bearer ${token}`, 'client-id': env.TWITCH_CLIENT_ID }, signal: AbortSignal.timeout(5000) });
  let r = await go(await getToken(env, d, false));
  if (r.status === 401) r = await go(await getToken(env, d, true));
  return r;
}

// deps: { fetchFn, cache, now, state } are injectable for tests.
export async function getLive(env, deps = {}) {
  const d = deps_(deps);
  if (!hasSecrets(env)) return unknown(d.now, UNKNOWN_MISSING);
  try {
    const r = await helixGet(HELIX_URL, env, d);
    if (!r.ok) throw new Error(`helix ${r.status}`);
    return buildResponse(mapStreams(await r.json()), d.now);
  } catch {
    return unknown(d.now, UNKNOWN_ERROR);
  }
}

// Pure: Helix /clips payload (+ game id -> name map) -> the top 6 clips. Only these fields leave the Worker: no views, creators or thumbnails.
export function mapClips(payload, games = {}) {
  const out = [];
  for (const c of payload?.data ?? []) {
    if (typeof c?.id !== 'string' || !CLIP_ID.test(c.id)) continue;
    out.push({ id: c.id, title: String(c.title ?? ''), game: games[c.game_id] ?? '', duration: Math.max(0, Math.round(Number(c.duration) || 0)), url: typeof c.url === 'string' && c.url.startsWith('https://') ? c.url : `https://clips.twitch.tv/${c.id}`, createdAt: c.created_at ?? undefined });
    if (out.length === MAX_CLIPS) break;
  }
  return out;
}

const clipsUnknown = (now, maxAge) => ({ body: { clips: [], unknown: true, checkedAt: new Date(now).toISOString() }, maxAge });

async function getBroadcasterId(env, d) {
  if (d.ids.id && d.ids.exp > d.now) return d.ids.id;
  const hit = d.cache && (await d.cache.match(ID_KEY).catch(() => null));
  const j = hit && (await hit.json().catch(() => null));
  if (j?.id) { d.ids.id = j.id; d.ids.exp = d.now + DAY * 1000; return j.id; }
  const r = await helixGet(`https://api.twitch.tv/helix/users?login=${CHANNEL}`, env, d);
  if (!r.ok) throw new Error(`users ${r.status}`);
  const id = (await r.json())?.data?.[0]?.id;
  if (typeof id !== 'string' || !CLIP_ID.test(id)) throw new Error('no broadcaster');
  d.ids.id = id; d.ids.exp = d.now + DAY * 1000;
  if (d.cache) await d.cache.put(ID_KEY, new Response(JSON.stringify({ id }), { headers: { 'cache-control': `max-age=${DAY}` } })).catch(() => {});
  return id;
}

export async function getClips(env, deps = {}) {
  const d = deps_(deps);
  if (!hasSecrets(env)) return clipsUnknown(d.now, UNKNOWN_MISSING);
  try {
    const id = await getBroadcasterId(env, d);
    const r = await helixGet(`https://api.twitch.tv/helix/clips?broadcaster_id=${encodeURIComponent(id)}&first=20`, env, d);
    if (!r.ok) throw new Error(`clips ${r.status}`);
    const payload = await r.json();
    const top = mapClips(payload);
    const gids = [...new Set((payload?.data ?? []).filter((c) => top.some((t) => t.id === c.id)).map((c) => c.game_id).filter((g) => typeof g === 'string' && /^\d+$/.test(g)))];
    let games = {};
    if (gids.length) {
      try {   // names are a nicety: any failure here just leaves the game blank
        const gr = await helixGet(`https://api.twitch.tv/helix/games?${gids.map((g) => `id=${g}`).join('&')}`, env, d);
        if (gr.ok) games = Object.fromEntries(((await gr.json())?.data ?? []).map((g) => [g.id, String(g.name ?? '')]));
      } catch { /* ignore */ }
    }
    return { body: { clips: mapClips(payload, games), checkedAt: new Date(d.now).toISOString() }, maxAge: CLIPS_FRESH };
  } catch {
    return clipsUnknown(d.now, UNKNOWN_ERROR);
  }
}

const SEC = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' };
const json = (body, status, cc, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cc, ...SEC, ...extra } });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const route = url.pathname === '/api/live' ? ['live', getLive, FRESH, STALE] : url.pathname === '/api/clips' ? ['clips', getClips, CLIPS_FRESH, CLIPS_STALE] : null;
    if (!route) return json({ error: 'not found' }, 404, 'no-store');
    if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405, 'no-store', { allow: 'GET' });
    const [name, get, fresh, stale] = route;
    const cache = globalThis.caches?.default;
    const key = new Request(`${url.origin}/api/${name}`);   // query strings do not bust the cache
    const hit = cache && (await cache.match(key).catch(() => null));
    if (hit) return hit;
    const { body, maxAge } = await get(env, { cache });
    const res = json(body, 200, maxAge === fresh ? `public, max-age=${fresh}, stale-while-revalidate=${stale}` : `public, max-age=${maxAge}`);
    if (cache) ctx?.waitUntil(cache.put(key, res.clone()).catch(() => {}));
    return res;
  },
};
