import { DurableObject } from 'cloudflare:workers'
import { LIVE_LIMITS } from '../lib/presence/constants'
import type { ReactionResult, ReactionTotals } from '../lib/presence/protocol'
import { createLimiter } from '../lib/presence/ratelimit'
import { POST_TARGET } from '../lib/presence/reactions-core'
import { parseReactionBody } from '../lib/presence/validate'

/**
 * One Durable Object per post slug (SQLite-backed storage).
 *
 *   r(target, sid, emoji)  one row per reaction. sid is the browser's anonymous session id; no IP, no location.
 *   c(target, emoji, n)    aggregate counts, updated in the same transaction, so reads never scan r.
 *
 * `target` is 'post' or a highlight block id. Counts are readable with one GET per page.
 */
export class ReactionsRoom extends DurableObject {
  private writes = createLimiter(LIVE_LIMITS.reactWritesPerMin, 60_000)
  private reads = createLimiter(LIVE_LIMITS.reactReadsPerMin, 60_000)
  private bySid = createLimiter(20, 60_000)

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never)
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS r (target TEXT NOT NULL, sid TEXT NOT NULL, emoji TEXT NOT NULL, PRIMARY KEY (target, sid, emoji)) WITHOUT ROWID',
      )
      ctx.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS c (target TEXT NOT NULL, emoji TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (target, emoji)) WITHOUT ROWID',
      )
      // One-row blob store used by the Starlink snapshot (worker/starlink.ts keeps it under the fixed object name "~starlink").
      ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS blob (k TEXT PRIMARY KEY, v BLOB NOT NULL, at INTEGER NOT NULL) WITHOUT ROWID')
    })
  }

  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === '/blob') return this.blob(request)
    const ipk = request.headers.get('x-live-ipk') ?? 'none'
    if (request.method === 'GET') {
      const lim = this.reads.hit(ipk)
      if (!lim.ok) return json({ error: 'rate_limited' }, 429, lim.retryAfter)
      const slug = new URL(request.url).searchParams.get('slug') ?? ''
      return json(this.totals(slug), 200)
    }
    if (request.method !== 'POST') return json({ error: 'method' }, 405)

    const lim = this.writes.hit(ipk)
    if (!lim.ok) return json({ error: 'rate_limited' }, 429, lim.retryAfter)
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return json({ error: 'bad_request' }, 400)
    }
    const b = parseReactionBody(body)
    if (!b) return json({ error: 'bad_request' }, 400)
    const s = this.bySid.hit(b.sid)
    if (!s.ok) return json({ error: 'rate_limited' }, 429, s.retryAfter)

    const changed = this.set(b.target, b.sid, b.emoji, b.on)
    if (changed === 'full') return json({ error: 'full' }, 409)
    return json(this.result(b.target, b.sid), 200)
  }

  /** GET /blob?k=name -> bytes (404 when empty, `x-updated` = unix seconds); PUT /blob?k=name with the bytes (max 1 MB). Internal: only the Worker calls it. */
  private async blob(request: Request): Promise<Response> {
    const sql = this.ctx.storage.sql
    const k = new URL(request.url).searchParams.get('k') ?? ''
    if (!/^[a-z0-9-]{1,32}$/.test(k)) return json({ error: 'bad_request' }, 400)
    if (request.method === 'PUT') {
      const body = await request.arrayBuffer()
      if (body.byteLength === 0 || body.byteLength > 1_000_000) return json({ error: 'bad_request' }, 400)
      sql.exec('INSERT INTO blob (k, v, at) VALUES (?, ?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v, at = excluded.at', k, body, Math.floor(Date.now() / 1000))
      return json({ ok: true }, 200)
    }
    if (request.method !== 'GET') return json({ error: 'method' }, 405)
    const row = sql.exec('SELECT v, at FROM blob WHERE k = ?', k).toArray()[0]
    if (!row) return json({ error: 'empty' }, 404)
    return new Response(row.v as ArrayBuffer, { headers: { 'Content-Type': 'application/octet-stream', 'x-updated': String(row.at) } })
  }

  private set(target: string, sid: string, emoji: string, on: boolean): boolean | 'full' {
    const sql = this.ctx.storage.sql
    return this.ctx.storage.transactionSync(() => {
      const has = sql.exec('SELECT 1 FROM r WHERE target = ? AND sid = ? AND emoji = ?', target, sid, emoji).toArray().length > 0
      if (on === has) return false
      if (!on) {
        sql.exec('DELETE FROM r WHERE target = ? AND sid = ? AND emoji = ?', target, sid, emoji)
        sql.exec('UPDATE c SET n = MAX(0, n - 1) WHERE target = ? AND emoji = ?', target, emoji)
        sql.exec('UPDATE c SET n = MAX(0, n - 1) WHERE target = ? AND emoji = ?', '~', 'total')
        return true
      }
      const total = Number(sql.exec("SELECT n FROM c WHERE target = '~' AND emoji = 'total'").toArray()[0]?.n ?? 0)
      if (total >= LIVE_LIMITS.reactRowsMax) return 'full'
      if (target !== POST_TARGET) {
        const known = sql.exec('SELECT 1 FROM c WHERE target = ? LIMIT 1', target).toArray().length > 0
        if (!known) {
          const blocks = Number(sql.exec("SELECT COUNT(DISTINCT target) AS k FROM c WHERE target != '~' AND target != 'post'").toArray()[0]?.k ?? 0)
          if (blocks >= LIVE_LIMITS.reactBlocksMax) return 'full'
        }
      }
      sql.exec('INSERT INTO r (target, sid, emoji) VALUES (?, ?, ?)', target, sid, emoji)
      sql.exec('INSERT INTO c (target, emoji, n) VALUES (?, ?, 1) ON CONFLICT (target, emoji) DO UPDATE SET n = n + 1', target, emoji)
      sql.exec("INSERT INTO c (target, emoji, n) VALUES ('~', 'total', 1) ON CONFLICT (target, emoji) DO UPDATE SET n = n + 1")
      return true
    })
  }

  private result(target: string, sid: string): ReactionResult {
    const sql = this.ctx.storage.sql
    const counts: Record<string, number> = {}
    for (const r of sql.exec('SELECT emoji, n FROM c WHERE target = ? AND n > 0', target)) counts[String(r.emoji)] = Number(r.n)
    const mine = sql.exec('SELECT emoji FROM r WHERE target = ? AND sid = ?', target, sid).toArray().map((r) => String(r.emoji))
    return { v: 1, target, counts, mine }
  }

  private totals(slug: string): ReactionTotals {
    const post: Record<string, number> = {}
    const blocks: Record<string, Record<string, number>> = {}
    for (const r of this.ctx.storage.sql.exec("SELECT target, emoji, n FROM c WHERE n > 0 AND target != '~'")) {
      const t = String(r.target)
      if (t === POST_TARGET) post[String(r.emoji)] = Number(r.n)
      else (blocks[t] ??= {})[String(r.emoji)] = Number(r.n)
    }
    return { v: 1, slug, post, blocks }
  }
}

function json(body: unknown, status: number, retryAfter?: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) },
  })
}
