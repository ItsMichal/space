// The club's social side (the game repo's docs/club.md stages 5 and 6), in the same `Club` Durable Object as the
// accounts (club.js): friends, presence, chat, invites and matchmaking. Every call needs a signed-in account
// (Authorization: Bearer <token>).
//
//   GET  /club/events?since=N&venue=V   long-poll (<= 20 s) -> {seq, events: [...]}; being in it is being online (in venue V)
//   GET  /club/friends                  -> {tag, rating, friends: [{id, name, character, tag, state, online, venue}], blocked: [{id, name}]}
//                                          state: 'friend', 'in' (asked you), 'out' (you asked)
//   POST /club/friends/add    {tag}     -> {}   ask, or accept when they asked you
//   POST /club/friends/remove {id}      -> {}   unfriend, decline or take back
//   POST /club/block          {id, block} -> {}
//   POST /club/report         {id, reason, text?} -> {}
//   GET  /club/chat                     -> {messages}  the club room's recent messages
//   POST /club/chat           {text, to?} -> {}   to: a friend's id (direct), or the club room
//   POST /club/invite         {to, sport, code} -> {}   a friend gets {k: 'invite'}
//   POST /club/match          {sport}   -> {}   queue for a quick match; {k: 'match'} when paired
//   POST /club/match/cancel   {}        -> {}
//   POST /club/match/lobby    {match, code} -> {}   the host's lobby code for the matched guest ({k: 'match-lobby'})
//   POST /club/result         {match, won}  -> {rating?}  both sides report; the ratings move when they agree
// Events: {k: 'presence', id, online, venue}, {k: 'friends'} (the list changed: fetch it), {k: 'chat', from, name, text,
// at, to?}, {k: 'invite', from, name, sport, code}, {k: 'match', match, sport, host, peer: {name, character, rating}},
// {k: 'match-lobby', match, code}, {k: 'match-gone', match}.
//
// Friends, blocks, reports and ratings are stored; presence, chat, invites and the queues live in memory (a restart of the
// object loses them, which costs at most a message or a queue place). This file, like club.js, has no Worker-only imports.
export const POLL_MS = 20_000;
export const GONE_MS = 45_000;
const ROOM_KEEP = 50, QUEUE_MAX = 100, TEXT_MAX = 200;
const CHAT_BURST = 5, CHAT_WINDOW_MS = 10_000;
const BAND = 200, WIDEN_MS = 15_000, RATING0 = 1000, ELO_K = 32;
const MATCH_MS = 10 * 60_000;
const SPORTS = new Set(['baseball', 'bowling', 'tennis', 'golf', 'boxing']);
const TAG_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', TAG_LEN = 6;
const VENUE = /^[a-z-]{1,24}$/;
const LOBBY_CODE = /^[A-Z2-9]{4,8}$/;
const REASONS = new Set(['name', 'chat', 'cheating', 'other']);

// A small word filter: whole words (and plain leetspeak) are starred out. Not a moderation system; reports are.
const WORDS = ['fuck', 'fucker', 'fucking', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'asshole', 'bastard', 'whore', 'slut',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'spic', 'kike', 'chink', 'tranny', 'rape', 'rapist', 'nazi'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };
const BAD = new Set(WORDS);
export function filterText(s) {
  return s.replace(/[\p{L}\p{N}@$!]+/gu, (w) => {
    const plain = w.toLowerCase().replace(/[013457@$!]/g, (c) => LEET[c]).replace(/(.)\1{2,}/g, '$1$1');
    const bare = plain.replace(/(.)\1+/g, '$1');
    return BAD.has(plain) || BAD.has(bare) || BAD.has(plain.replace(/(e?s|ed|er|ing)$/, '')) ? '*'.repeat([...w].length) : w;
  });
}
/** Chat text as kept: printable, one line, at most TEXT_MAX characters, filtered; '' when nothing is left. */
export function cleanText(v) {
  if (typeof v !== 'string') return '';
  return filterText([...v.replace(/[\p{C}]/gu, ' ').replace(/\s+/g, ' ').trim()].slice(0, TEXT_MAX).join(''));
}

const tagOf = () => { let s = ''; for (const x of crypto.getRandomValues(new Uint32Array(TAG_LEN))) s += TAG_ALPHA[x % TAG_ALPHA.length]; return s; };
const rnd = () => { let s = ''; for (const x of crypto.getRandomValues(new Uint32Array(10))) s += TAG_ALPHA[x % TAG_ALPHA.length]; return s; };

export class Social {
  /** club: the accounts (club.js Club); db: its store (with the social tables); now(): the clock; pollMs for the tests. */
  constructor(club, { now = () => Date.now(), pollMs = POLL_MS } = {}) {
    this.club = club; this.db = club.db; this.now = now; this.pollMs = pollMs;
    this.on = new Map();       // id -> {seen, venue, seq, events: [], wait}
    this.room = [];            // the club room's recent messages
    this.said = new Map();     // id -> times of the last messages (rate limit)
    this.queue = new Map();    // sport -> [{id, rating, since}]
    this.matches = new Map();  // match -> {sport, host, guest, at, code, results: {}}
  }

  // ---- players ------------------------------------------------------------------------------------------------------
  player(id) {
    let p = this.db.player(id);
    if (!p) {
      let tag; do tag = tagOf(); while (this.db.playerByTag(tag));
      p = { id, tag, rating: RATING0, games: 0 };
      this.db.putPlayer(p);
    }
    return p;
  }
  blocked(a, b) { return this.db.blocked(a, b) || this.db.blocked(b, a); }
  friends(id) { return this.db.friendsOf(id).filter((r) => r.state === 'ok').map((r) => (r.a === id ? r.b : r.a)); }
  isFriend(a, b) { const r = this.db.friend(a, b); return !!r && r.state === 'ok'; }

  // ---- presence and events ------------------------------------------------------------------------------------------
  online(id) { const o = this.on.get(id); return !!o && (!!o.wait || this.now() - o.seen < GONE_MS); }
  push(id, ev) {
    const o = this.on.get(id);
    if (!o) return;
    o.events.push({ ...ev, seq: ++o.seq });
    if (o.events.length > QUEUE_MAX) o.events.splice(0, o.events.length - QUEUE_MAX);
    if (o.wait) o.wait();
  }
  tellFriends(id, ev) { for (const f of this.friends(id)) this.push(f, ev); }
  /** marks who went away (no poll for GONE_MS): their friends hear it, their queue place and pending matches go */
  sweep() {
    const t = this.now();
    for (const [id, o] of this.on) {
      if (o.wait || t - o.seen < GONE_MS) continue;
      this.on.delete(id);
      this.leaveQueue(id);
      this.tellFriends(id, { k: 'presence', id, online: false, venue: '' });
    }
    for (const [m, x] of this.matches) if (t - x.at > MATCH_MS) this.matches.delete(m);
  }
  async events(id, since, venue) {
    this.sweep();
    let o = this.on.get(id);
    const v = typeof venue === 'string' && VENUE.test(venue) ? venue : '';
    if (!o) {
      o = { seen: this.now(), venue: v, seq: 0, events: [], wait: null };
      this.on.set(id, o);
      this.player(id);
      this.tellFriends(id, { k: 'presence', id, online: true, venue: v });
    } else if (o.venue !== v) { o.venue = v; this.tellFriends(id, { k: 'presence', id, online: true, venue: v }); }
    o.seen = this.now();
    this.pair();
    if (since > o.seq) since = 0;   // the object restarted: start over
    const fresh = () => o.events.filter((e) => e.seq > since);
    if (fresh().length) return { body: { seq: o.seq, events: fresh() } };
    o.wait?.();   // one poll per account
    return new Promise((resolve) => {
      const done = () => { clearTimeout(to); if (o.wait === done) o.wait = null; o.seen = this.now(); resolve({ body: { seq: o.seq, events: fresh() } }); };
      const to = setTimeout(done, this.pollMs);
      o.wait = done;
    });
  }

  // ---- friends ------------------------------------------------------------------------------------------------------
  list(id) {
    const me = this.player(id), out = [];
    for (const r of this.db.friendsOf(id)) {
      const other = r.a === id ? r.b : r.a, a = this.club.account(other);
      if (!a) continue;
      const state = r.state === 'ok' ? 'friend' : r.a === id ? 'out' : 'in';
      const on = state === 'friend' && this.online(other);
      out.push({ id: other, name: a.name, character: a.character, tag: this.player(other).tag, state, online: on, venue: on ? this.on.get(other).venue : '' });
    }
    out.sort((x, y) => (y.online - x.online) || x.name.localeCompare(y.name));
    const blocked = this.db.blocksBy(id).map((b) => ({ id: b, name: this.club.account(b)?.name || '' }));
    return { body: { tag: me.tag, rating: me.rating, friends: out, blocked } };
  }
  add(id, tag) {
    const t = typeof tag === 'string' ? tag.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
    const p = t && this.db.playerByTag(t);
    if (!p || !this.club.account(p.id)) return { status: 404, body: { err: 'no player has that friend code' } };
    if (p.id === id) return { status: 400, body: { err: 'that is your own code' } };
    if (this.blocked(id, p.id)) return { status: 403, body: { err: 'you cannot add that player' } };
    const r = this.db.friend(id, p.id);
    if (r?.state === 'ok') return { body: {} };
    if (r && r.a === p.id) this.db.putFriend(p.id, id, 'ok', this.now());   // they asked: accepted
    else if (!r) {
      if (this.db.friendsOf(id).length >= 200) return { status: 409, body: { err: 'too many friends and requests' } };
      this.db.putFriend(id, p.id, 'req', this.now());
    }
    this.push(id, { k: 'friends' }); this.push(p.id, { k: 'friends' });
    return { body: {} };
  }
  remove(id, other) {
    if (typeof other !== 'string' || !this.db.friend(id, other)) return { body: {} };
    this.db.dropFriend(id, other);
    this.push(id, { k: 'friends' }); this.push(other, { k: 'friends' });
    return { body: {} };
  }
  block(id, other, on) {
    if (typeof other !== 'string' || other === id || !this.club.account(other)) return { status: 404, body: { err: 'no such player' } };
    if (on === false) this.db.dropBlock(id, other);
    else { this.db.putBlock(id, other, this.now()); this.db.dropFriend(id, other); this.push(other, { k: 'friends' }); }
    this.push(id, { k: 'friends' });
    return { body: {} };
  }
  report(id, o) {
    if (typeof o?.id !== 'string' || !this.club.account(o.id) || o.id === id) return { status: 404, body: { err: 'no such player' } };
    const reason = REASONS.has(o.reason) ? o.reason : 'other';
    if (this.db.reportsBy(id, this.now() - 24 * 3600_000) >= 20) return { status: 429, body: { err: 'too many reports today' } };
    this.db.putReport({ by: id, who: o.id, reason, text: cleanText(o.text), at: this.now() });
    return { body: {} };
  }

  // ---- chat and invites ---------------------------------------------------------------------------------------------
  chat(id, o) {
    const text = cleanText(o?.text);
    if (!text) return { status: 400, body: { err: 'nothing to say' } };
    const t = this.now(), times = (this.said.get(id) || []).filter((x) => t - x < CHAT_WINDOW_MS);
    if (times.length >= CHAT_BURST) return { status: 429, body: { err: 'slow down' } };
    times.push(t); this.said.set(id, times);
    if (this.said.size > 10_000) this.said.clear();
    const name = this.club.account(id)?.name || '';
    if (o.to !== undefined) {
      if (!this.isFriend(id, o.to)) return { status: 403, body: { err: 'only friends can be messaged' } };
      const m = { k: 'chat', from: id, name, text, at: t, to: o.to };
      this.push(o.to, m); this.push(id, m);
      return { body: {} };
    }
    const m = { k: 'chat', from: id, name, text, at: t };
    this.room.push(m);
    if (this.room.length > ROOM_KEEP) this.room.splice(0, this.room.length - ROOM_KEEP);
    for (const other of this.on.keys()) if (other === id || !this.blocked(id, other)) this.push(other, m);
    return { body: {} };
  }
  roomFor(id) { return { body: { messages: this.room.filter((m) => m.from === id || !this.blocked(id, m.from)) } }; }
  invite(id, o) {
    if (!this.isFriend(id, o?.to)) return { status: 403, body: { err: 'only friends can be invited' } };
    if (!SPORTS.has(o.sport) || typeof o.code !== 'string' || !LOBBY_CODE.test(o.code)) return { status: 400, body: { err: 'bad invite' } };
    if (!this.online(o.to)) return { status: 409, body: { err: 'they are not online' } };
    this.push(o.to, { k: 'invite', from: id, name: this.club.account(id)?.name || '', sport: o.sport, code: o.code });
    return { body: {} };
  }

  // ---- matchmaking --------------------------------------------------------------------------------------------------
  leaveQueue(id) { for (const q of this.queue.values()) { const i = q.findIndex((x) => x.id === id); if (i >= 0) q.splice(i, 1); } }
  enqueue(id, sport) {
    if (!SPORTS.has(sport)) return { status: 400, body: { err: 'that sport cannot be played online' } };
    if (!this.on.has(id)) return { status: 409, body: { err: 'not connected' } };
    this.leaveQueue(id);
    const q = this.queue.get(sport) || [];
    if (q.length >= 500) return { status: 503, body: { err: 'the queue is full' } };
    q.push({ id, rating: this.player(id).rating, since: this.now() });
    this.queue.set(sport, q);
    this.pair();
    return { body: {} };
  }
  /** pairs the queue's players whose bands meet: a band of BAND rating each side, widened by one per WIDEN_MS waited */
  pair() {
    const t = this.now();
    for (const [sport, q] of this.queue) {
      for (let i = 0; i < q.length; i++) {
        const a = q[i];
        if (!this.online(a.id)) { q.splice(i--, 1); continue; }
        const wa = BAND * (1 + Math.floor((t - a.since) / WIDEN_MS));
        let best = -1;
        for (let j = i + 1; j < q.length; j++) {
          const b = q[j], wb = BAND * (1 + Math.floor((t - b.since) / WIDEN_MS)), d = Math.abs(a.rating - b.rating);
          if (d <= Math.min(wa, wb) && this.online(b.id) && !this.blocked(a.id, b.id) && (best < 0 || d < Math.abs(a.rating - q[best].rating))) best = j;
        }
        if (best < 0) continue;
        const b = q[best];
        q.splice(best, 1); q.splice(i--, 1);
        const match = rnd(), host = a.since <= b.since ? a : b, guest = host === a ? b : a;
        this.matches.set(match, { sport, host: host.id, guest: guest.id, at: t, code: '', results: {} });
        const peer = (x) => { const c = this.club.account(x.id); return { name: c?.name || '', character: c?.character || '', rating: x.rating }; };
        this.push(host.id, { k: 'match', match, sport, host: true, peer: peer(guest) });
        this.push(guest.id, { k: 'match', match, sport, host: false, peer: peer(host) });
      }
    }
  }
  matchLobby(id, o) {
    const m = this.matches.get(o?.match);
    if (!m || m.host !== id) return { status: 404, body: { err: 'no such match' } };
    if (typeof o.code !== 'string' || !LOBBY_CODE.test(o.code)) return { status: 400, body: { err: 'bad code' } };
    m.code = o.code;
    this.push(m.guest, { k: 'match-lobby', match: o.match, code: o.code });
    return { body: {} };
  }
  cancel(id) {
    this.leaveQueue(id);
    for (const [k, m] of this.matches) if (!m.code && (m.host === id || m.guest === id)) {
      this.matches.delete(k);
      this.push(m.host === id ? m.guest : m.host, { k: 'match-gone', match: k });
    }
    return { body: {} };
  }
  /** both report; when one says won and the other lost, the ratings move (Elo); anything else counts as nothing */
  result(id, o) {
    const m = this.matches.get(o?.match);
    if (!m || (m.host !== id && m.guest !== id) || typeof o.won !== 'boolean') return { status: 404, body: { err: 'no such match' } };
    m.results[id] = o.won;
    const h = m.results[m.host], g = m.results[m.guest];
    if (h === undefined || g === undefined) return { body: {} };
    this.matches.delete(o.match);
    if (h === g) return { body: { rating: this.player(id).rating } };
    const ph = this.player(m.host), pg = this.player(m.guest);
    const eh = 1 / (1 + 10 ** ((pg.rating - ph.rating) / 400)), sh = h ? 1 : 0;
    const dh = Math.round(ELO_K * (sh - eh));
    this.db.setRating(m.host, ph.rating + dh, ph.games + 1);
    this.db.setRating(m.guest, pg.rating - dh, pg.games + 1);
    return { body: { rating: this.player(id).rating } };
  }

  /** the account went: everything social with it */
  forget(id) {
    for (const f of this.db.friendsOf(id)) this.push(f.a === id ? f.b : f.a, { k: 'friends' });
    this.db.dropSocial(id);
    this.leaveQueue(id);
    this.on.get(id)?.wait?.();
    this.on.delete(id);
  }

  /** the social requests of /club for a signed-in account, or null when the path is not one of them */
  async request(req, url, who, body) {
    const path = url.pathname;
    if (req.method === 'GET') {
      if (path === '/club/events') return this.events(who, Number(url.searchParams.get('since')) || 0, url.searchParams.get('venue') || '');
      if (path === '/club/friends') return this.list(who);
      if (path === '/club/chat') return this.roomFor(who);
      return null;
    }
    switch (path) {
      case '/club/friends/add': return this.add(who, body.tag);
      case '/club/friends/remove': return this.remove(who, body.id);
      case '/club/block': return this.block(who, body.id, body.block);
      case '/club/report': return this.report(who, body);
      case '/club/chat': return this.chat(who, body);
      case '/club/invite': return this.invite(who, body);
      case '/club/match': return this.enqueue(who, body.sport);
      case '/club/match/cancel': return this.cancel(who);
      case '/club/match/lobby': return this.matchLobby(who, body);
      case '/club/result': return this.result(who, body);
    }
    return null;
  }
}

/** The social tables over Durable Object SQLite, added to club.js's sqlStore. */
export function socialSql(sql, store) {
  sql.exec('CREATE TABLE IF NOT EXISTS player (id TEXT PRIMARY KEY, tag TEXT NOT NULL UNIQUE, rating INTEGER NOT NULL, games INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS friend (a TEXT NOT NULL, b TEXT NOT NULL, state TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (a, b))');
  sql.exec('CREATE INDEX IF NOT EXISTS friend_by_b ON friend (b)');
  sql.exec('CREATE TABLE IF NOT EXISTS block (a TEXT NOT NULL, b TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (a, b))');
  sql.exec('CREATE TABLE IF NOT EXISTS report (n INTEGER PRIMARY KEY AUTOINCREMENT, by TEXT NOT NULL, who TEXT NOT NULL, reason TEXT NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL)');
  const one = (cur) => cur.toArray()[0] || null;
  return Object.assign(store, {
    player: (id) => one(sql.exec('SELECT * FROM player WHERE id = ?', id)),
    playerByTag: (tag) => one(sql.exec('SELECT * FROM player WHERE tag = ?', tag)),
    putPlayer: (p) => sql.exec('INSERT INTO player (id, tag, rating, games) VALUES (?, ?, ?, ?)', p.id, p.tag, p.rating, p.games),
    setRating: (id, rating, games) => sql.exec('UPDATE player SET rating = ?, games = ? WHERE id = ?', rating, games, id),
    friend: (x, y) => one(sql.exec('SELECT * FROM friend WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', x, y, y, x)),
    friendsOf: (id) => sql.exec('SELECT * FROM friend WHERE a = ? OR b = ?', id, id).toArray(),
    putFriend: (a, b, state, at) => { sql.exec('DELETE FROM friend WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', a, b, b, a); sql.exec('INSERT INTO friend (a, b, state, at) VALUES (?, ?, ?, ?)', a, b, state, at); },
    dropFriend: (x, y) => sql.exec('DELETE FROM friend WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)', x, y, y, x),
    blocked: (a, b) => !!one(sql.exec('SELECT 1 AS x FROM block WHERE a = ? AND b = ?', a, b)),
    blocksBy: (a) => sql.exec('SELECT b FROM block WHERE a = ?', a).toArray().map((r) => r.b),
    putBlock: (a, b, at) => sql.exec('INSERT OR REPLACE INTO block (a, b, at) VALUES (?, ?, ?)', a, b, at),
    dropBlock: (a, b) => sql.exec('DELETE FROM block WHERE a = ? AND b = ?', a, b),
    putReport: (r) => sql.exec('INSERT INTO report (by, who, reason, text, at) VALUES (?, ?, ?, ?, ?)', r.by, r.who, r.reason, r.text, r.at),
    reportsBy: (id, since) => sql.exec('SELECT COUNT(*) AS n FROM report WHERE by = ? AND at > ?', id, since).one().n,
    dropSocial: (id) => {
      sql.exec('DELETE FROM friend WHERE a = ? OR b = ?', id, id);
      sql.exec('DELETE FROM block WHERE a = ? OR b = ?', id, id);
      sql.exec('DELETE FROM player WHERE id = ?', id);
    },
  });
}

/** The same over Maps (the tests, the game repo's local server). */
export function socialMap(store) {
  const player = new Map(), friend = [], block = [], report = [];
  const pair = (r, x, y) => (r.a === x && r.b === y) || (r.a === y && r.b === x);
  const drop = (arr, f) => { for (let i = arr.length - 1; i >= 0; i--) if (f(arr[i])) arr.splice(i, 1); };
  return Object.assign(store, {
    player: (id) => player.get(id) || null,
    playerByTag: (tag) => [...player.values()].find((p) => p.tag === tag) || null,
    putPlayer: (p) => player.set(p.id, { ...p }),
    setRating: (id, rating, games) => Object.assign(player.get(id), { rating, games }),
    friend: (x, y) => friend.find((r) => pair(r, x, y)) || null,
    friendsOf: (id) => friend.filter((r) => r.a === id || r.b === id),
    putFriend: (a, b, state, at) => { drop(friend, (r) => pair(r, a, b)); friend.push({ a, b, state, at }); },
    dropFriend: (x, y) => drop(friend, (r) => pair(r, x, y)),
    blocked: (a, b) => block.some((r) => r.a === a && r.b === b),
    blocksBy: (a) => block.filter((r) => r.a === a).map((r) => r.b),
    putBlock: (a, b, at) => { if (!block.some((r) => r.a === a && r.b === b)) block.push({ a, b, at }); },
    dropBlock: (a, b) => drop(block, (r) => r.a === a && r.b === b),
    putReport: (r) => report.push(r),
    reportsBy: (id, since) => report.filter((r) => r.by === id && r.at > since).length,
    dropSocial: (id) => { drop(friend, (r) => r.a === id || r.b === id); drop(block, (r) => r.a === id || r.b === id); player.delete(id); },
  });
}
