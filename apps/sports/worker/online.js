// Online play: the lobby (/lobby) and the netplay signaling mailbox (/netplay) of the game's own LAN server
// (tools/lan/lobby.mjs and tools/lan/signal.mjs in the game repo), ported to Request/Response. Both live in memory in one
// Durable Object (Online, "global" in index.js) so every page talks to the same lobbies; nothing is logged or stored.
//
// Lobby (bodies and replies JSON):
//   POST /lobby/new              {name, avatar?}         -> {code, token, me: 0, state}
//   POST /lobby/<code>/join      {name, avatar?, token?} -> {token, me, state}   (token: rejoin the same seat)
//   POST /lobby/<code>/set       {token, ready?, sport?, name?, avatar?} -> state         (sport: host only; resets ready)
//   POST /lobby/<code>/start     {token}                 -> state                (host only; every guest ready)
//   POST /lobby/<code>/leave     {token}                 -> 204                  (host leaving closes the lobby)
//   GET  /lobby/<code>?v=N&token=T  long-poll (<= 20 s) until the state's version passes N -> state
// Netplay mailbox:
//   POST /netplay/new              -> {room}
//   POST /netplay/<room>/<h|j>     JSON body: a message for that side's box -> 204
//   GET  /netplay/<room>/<h|j>     long-poll (<= 20 s): the box's messages as a JSON array, emptied
export const CODE_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I L O 0 1: read aloud or typed on a phone
const CODE_LEN = 5;
const PLAYABLE_ONLINE = new Set(['baseball', 'bowling', 'tennis', 'golf', 'boxing']);
const MAX_PLAYERS = 2, LOBBY_IDLE_MS = 2 * 60 * 60 * 1000, GONE_MS = 30000, MAX_LOBBIES = 200, MAX_LOBBY_BODY = 4096;
const ROOM_IDLE_MS = 2 * 60 * 60 * 1000, MAX_ROOMS = 200, MAX_SIGNAL_BODY = 64 * 1024, BOX_MAX = 64;
// a room lives as long as a lobby: a player who reloads mid-game rejoins through it (the game's web/netplay.js)
export const POLL_MS = 20000;

const json = (status, v) =>
  new Response(v === undefined ? null : JSON.stringify(v), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' },
  });
const rnd = (n) => { let s = ''; const b = new Uint32Array(n); crypto.getRandomValues(b); for (const x of b) s += CODE_ALPHA[x % CODE_ALPHA.length]; return s; };
const clean = (s) => String(s || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16);
const avatar = (s) => (typeof s === 'string' && /^[0-9a-fA-F]{148}$/.test(s) ? s.toLowerCase() : '');

async function readJson(req, max) {
  if (Number(req.headers.get('content-length') || 0) > max) return null;
  const b = await req.text();
  if (b.length > max) return null;
  try { return b ? JSON.parse(b) : {}; } catch { return null; }
}

/** The handler for /lobby and /netplay: (req) => Promise<Response>. opts.now and opts.pollMs are for the tests. */
export function createOnline({ now = () => Date.now(), pollMs = POLL_MS } = {}) {
  const lobbies = new Map(); // code -> {code, t, v, sport, seats: [{token, name, ready, avatar, seen, inGame}], started, closed, waits: Set}
  const rooms = new Map(); // code -> {t, box: {h: [], j: []}, wait: {h, j}}

  const view = (L) => ({
    code: L.code, v: L.v, sport: L.sport, closed: !!L.closed, started: L.started,
    players: L.seats.map((s, i) => ({ name: s.name, ready: s.ready, host: i === 0, avatar: s.avatar, here: s.inGame || now() - s.seen < GONE_MS })),
  });
  const bump = (L) => { L.v++; L.t = now(); for (const w of [...L.waits]) w(); };
  const sweep = () => {
    const t = now();
    for (const [k, L] of lobbies) {
      // a closed lobby stays a while so the other page's poll still reads `closed`
      if (t - L.t > LOBBY_IDLE_MS || L.closed) { if ((!L.waits.size && t - L.t > GONE_MS) || t - L.t > LOBBY_IDLE_MS) lobbies.delete(k); continue; }
      const before = L.seats.length;
      L.seats = L.seats.filter((s, i) => i === 0 || s.inGame || t - s.seen < GONE_MS);
      if (L.seats.length !== before) bump(L);
    }
    for (const [k, r] of rooms) if (t - r.t > ROOM_IDLE_MS) { for (const w of Object.values(r.wait)) w?.([]); rooms.delete(k); }
  };
  const freshRoom = () => ({ t: now(), box: { h: [], j: [] }, wait: { h: null, j: null } });
  /** an empty room under a given code, replacing an older one (a rematch starts clean) */
  const openRoom = (c) => { const old = rooms.get(c); if (old) for (const w of Object.values(old.wait)) w?.([]); rooms.set(c, freshRoom()); };
  const seatOf = (L, token) => (token ? L.seats.findIndex((s) => s.token === token) : -1);

  function lobbyPost(L, op, q) {
    const i = seatOf(L, q.token);
    if (op === 'join') {
      if (L.closed) return json(410, { err: 'this lobby has closed' });
      if (i >= 0) {
        Object.assign(L.seats[i], { seen: now(), inGame: false });
        if (q.avatar !== undefined) L.seats[i].avatar = avatar(q.avatar);
        bump(L);
        return json(200, { token: q.token, me: i, state: view(L) });
      }
      if (L.seats.length >= MAX_PLAYERS) return json(409, { err: 'this lobby is full' });
      const s = { token: rnd(16), name: clean(q.name) || `Player ${L.seats.length + 1}`, ready: false, avatar: avatar(q.avatar), seen: now(), inGame: false };
      L.seats.push(s); bump(L);
      return json(200, { token: s.token, me: L.seats.length - 1, state: view(L) });
    }
    if (i < 0) return json(403, { err: 'not in this lobby' });
    const s = L.seats[i];
    s.seen = now(); s.inGame = false;
    if (op === 'set') {
      if (q.name !== undefined) s.name = clean(q.name) || s.name;
      if (q.ready !== undefined) s.ready = !!q.ready;
      if (q.avatar !== undefined) s.avatar = avatar(q.avatar);
      if (q.sport !== undefined) {
        if (i !== 0) return json(403, { err: 'only the host picks the sport' });
        if (!PLAYABLE_ONLINE.has(q.sport)) return json(400, { err: 'that sport cannot be played online yet' });
        if (q.sport !== L.sport) { L.sport = q.sport; for (const x of L.seats) x.ready = false; }
      }
      bump(L);
      return json(200, view(L));
    }
    if (op === 'start') {
      if (i !== 0) return json(403, { err: 'only the host starts' });
      if (L.seats.length < 2) return json(409, { err: 'waiting for a second player' });
      if (!L.seats.slice(1).every((x) => x.ready)) return json(409, { err: 'waiting for everyone to be ready' });
      openRoom(L.code); // a fresh signaling room under the lobby's code
      L.started = { seq: (L.started?.seq || 0) + 1, room: L.code, sport: L.sport };
      for (const x of L.seats) { x.ready = false; x.inGame = true; }
      bump(L);
      return json(200, view(L));
    }
    if (op === 'leave') {
      if (i === 0) L.closed = true; else L.seats.splice(i, 1);
      bump(L);
      return json(204);
    }
    return json(404, { err: 'no such call' });
  }

  async function lobby(req, url, rest) {
    const [code, op] = rest.split('/');
    if (req.method === 'POST' && code === 'new') {
      const q = await readJson(req, MAX_LOBBY_BODY);
      if (!q) return json(400, { err: 'bad request' });
      sweep();
      if (lobbies.size >= MAX_LOBBIES) return json(503, { err: 'too many lobbies' });
      let c; do c = rnd(CODE_LEN); while (lobbies.has(c) || rooms.has(c));
      const s = { token: rnd(16), name: clean(q.name) || 'Player 1', ready: true, avatar: avatar(q.avatar), seen: now(), inGame: false };
      const L = { code: c, t: now(), v: 1, sport: PLAYABLE_ONLINE.has(q.sport) ? q.sport : 'bowling', seats: [s], started: null, closed: false, waits: new Set() };
      lobbies.set(c, L);
      return json(200, { code: c, token: s.token, me: 0, state: view(L) });
    }
    sweep();
    const L = lobbies.get(String(code || '').toUpperCase());
    if (!L) return json(404, { err: 'no lobby with that code' });
    if (req.method === 'POST') {
      const q = await readJson(req, MAX_LOBBY_BODY);
      if (!q) return json(400, { err: 'bad request' });
      return lobbyPost(L, op, q);
    }
    if (req.method === 'GET' && !op) {
      const since = +url.searchParams.get('v') || 0, i = seatOf(L, url.searchParams.get('token'));
      if (i >= 0) { const s = L.seats[i], was = now() - s.seen >= GONE_MS && !s.inGame; s.seen = now(); if (was) bump(L); }
      if (L.v > since || L.closed) return json(200, view(L));
      return new Promise((resolve) => {
        const finish = () => { clearTimeout(to); L.waits.delete(finish); resolve(json(200, view(L))); };
        const to = setTimeout(finish, pollMs);
        L.waits.add(finish);
      });
    }
    return json(405, { err: 'method' });
  }

  async function netplay(req, rest) {
    const parts = rest.split('/');
    if (parts[0] === 'new' && req.method === 'POST') {
      sweep();
      if (rooms.size >= MAX_ROOMS) return json(503, { err: 'too many rooms' });
      let c; do c = rnd(CODE_LEN); while (rooms.has(c) || lobbies.has(c));
      rooms.set(c, freshRoom());
      return json(200, { room: c });
    }
    const room = rooms.get((parts[0] || '').toUpperCase()), side = parts[1];
    if (!room || (side !== 'h' && side !== 'j')) return json(404, { err: 'no such room' });
    room.t = now();
    if (req.method === 'POST') {
      const m = await readJson(req, MAX_SIGNAL_BODY);
      if (m === null) return json(400, { err: 'bad json' });
      if (room.box[side].length < BOX_MAX) room.box[side].push(m);
      const w = room.wait[side];
      if (w) { room.wait[side] = null; w(room.box[side].splice(0)); }
      return json(204);
    }
    if (req.method === 'GET') {
      if (room.box[side].length) return json(200, room.box[side].splice(0));
      room.wait[side]?.([]); // one poller per side
      return new Promise((resolve) => {
        const finish = (v) => { clearTimeout(to); if (room.wait[side] === finish) room.wait[side] = null; resolve(json(200, v)); };
        const to = setTimeout(() => finish([]), pollMs);
        room.wait[side] = finish;
      });
    }
    return json(405, { err: 'method' });
  }

  return async function handle(req) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } });
    if (p.startsWith('/lobby/')) return lobby(req, url, p.slice('/lobby/'.length));
    if (p.startsWith('/netplay/')) return netplay(req, p.slice('/netplay/'.length));
    return json(404, { err: 'not found' });
  };
}
