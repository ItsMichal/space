import { DurableObject } from 'cloudflare:workers'
import { LIVE_LIMITS } from '../lib/presence/constants'
import type { ReactionResult, ReactionTotals } from '../lib/presence/protocol'
import { createLimiter } from '../lib/presence/ratelimit'
import { POST_TARGET } from '../lib/presence/reactions-core'
import { parseReactionBody, SID_RE } from '../lib/presence/validate'
import { migrate } from './reactions-schema'

/**
 * One Durable Object per post id (SQLite-backed storage). Per post, not one global object: each post's writes are
 * serialised on their own, a busy post cannot slow the others, row and rate caps apply per post, and a post that is never
 * read never costs anything. Ids must be in the build-time list (lib/presence/slugs.generated.ts), so objects cannot be
 * created by arbitrary keys. Schema and its migrations: worker/reactions-schema.ts.
 *
 *   r(target, sid, emoji)  one row per reaction. sid is the browser's anonymous random id; no IP, no location.
 *   c(target, emoji, n)    aggregate counts, updated in the same transaction, so reads never scan r.
 *                          Also ('~', 'total') = reaction rows (cap) and ('~', 'views') = visits counted.
 *   vseen(day, vid)        visitors counted today. Rows from earlier days are deleted on the next write.
 *
 * `target` is 'post' or a highlight block id. Counts are readable with one GET per page.
 */
export class ReactionsRoom extends DurableObject {
  private writes = createLimiter(LIVE_LIMITS.reactWritesPerMin, 60_000)
  private reads = createLimiter(LIVE_LIMITS.reactReadsPerMin, 60_000)
  private bySid = createLimiter(20, 60_000)
  private postWrites = createLimiter(LIVE_LIMITS.reactPostWritesPerMin, 60_000, 2)
  private viewByClient = createLimiter(LIVE_LIMITS.viewWritesPerMin, 60_000)
  private viewPost = createLimiter(LIVE_LIMITS.viewPostWritesPerMin, 60_000, 2)

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never)
    ctx.blockConcurrencyWhile(async () => {
      migrate(ctx.storage.sql)
    })
  }

  async fetch(request: Request): Promise<Response> {
    const ipk = request.headers.get('x-live-ipk') ?? 'none'
    const url = new URL(request.url)
    if (request.method === 'GET') {
      const lim = this.reads.hit(ipk)
      if (!lim.ok) return json({ error: 'rate_limited' }, 429, lim.retryAfter)
      return json(this.totals(url.searchParams.get('id') ?? ''), 200)
    }
    if (request.method !== 'POST') return json({ error: 'method' }, 405)

    if (url.pathname === '/view') {
      const lim = this.viewByClient.hit(ipk)
      if (!lim.ok || !this.viewPost.hit('all').ok) return json({ error: 'rate_limited' }, 429, lim.retryAfter || 30)
      let b: unknown
      try {
        b = await request.json()
      } catch {
        return json({ error: 'bad_request' }, 400)
      }
      const vid = b && typeof b === 'object' ? (b as { vid?: unknown }).vid : undefined
      if (typeof vid !== 'string' || !SID_RE.test(vid)) return json({ error: 'bad_request' }, 400)
      return json({ counted: this.view(vid, new Date().toISOString().slice(0, 10)) }, 200)
    }

    const lim = this.writes.hit(ipk)
    if (!lim.ok || !this.postWrites.hit('all').ok) return json({ error: 'rate_limited' }, 429, lim.retryAfter || 30)
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

  /** Count one visit unless this visitor was already counted today. Returns whether it was counted. */
  private view(vid: string, day: string): boolean {
    const sql = this.ctx.storage.sql
    return this.ctx.storage.transactionSync(() => {
      if (sql.exec('SELECT 1 FROM vseen WHERE day = ? AND vid = ?', day, vid).toArray().length > 0) return false
      sql.exec('DELETE FROM vseen WHERE day < ?', day)
      const today = Number(sql.exec('SELECT COUNT(*) AS k FROM vseen WHERE day = ?', day).toArray()[0]?.k ?? 0)
      if (today >= LIVE_LIMITS.viewRowsPerDay) return false
      sql.exec('INSERT INTO vseen (day, vid) VALUES (?, ?)', day, vid)
      sql.exec("INSERT INTO c (target, emoji, n) VALUES ('~', 'views', 1) ON CONFLICT (target, emoji) DO UPDATE SET n = n + 1")
      return true
    })
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

  private totals(id: string): ReactionTotals {
    const post: Record<string, number> = {}
    const blocks: Record<string, Record<string, number>> = {}
    for (const r of this.ctx.storage.sql.exec("SELECT target, emoji, n FROM c WHERE n > 0 AND target != '~'")) {
      const t = String(r.target)
      if (t === POST_TARGET) post[String(r.emoji)] = Number(r.n)
      else (blocks[t] ??= {})[String(r.emoji)] = Number(r.n)
    }
    const views = Number(this.ctx.storage.sql.exec("SELECT n FROM c WHERE target = '~' AND emoji = 'views'").toArray()[0]?.n ?? 0)
    return { v: 1, id, views, post, blocks }
  }
}

function json(body: unknown, status: number, retryAfter?: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) },
  })
}
