import { DurableObject } from 'cloudflare:workers'
import { aggregate, MAX_VISIBLE_MS, type ClickRow, type PageEvent, type PageStats, type VisitRow } from '../lib/pages/stats'
import { migrate, type SqlLike } from './reactions-schema'

/**
 * Analytics for one private page (docs/private-pages.md): one Durable Object per page id, SQLite storage. Why a Durable Object
 * and not D1: the site already runs SQLite Durable Objects on the free plan (PresenceRoom, ReactionsRoom), so this needs no new
 * resource for the owner to create, no database id in wrangler.jsonc and no binding to provision by hand; per page the data is
 * tiny (a few thousand rows at most), every write for a page is serialised in one place, and a page that is never opened costs
 * nothing. Only the Worker can reach it: events through worker/pages.ts, reads through PageStatsApi (worker/index.ts).
 *
 *   visits(vid, token, visitor, started, last, ms, country, ref, device)   one row per page load. vid is random per load,
 *                                                                          visitor a salted hash that changes every UTC day.
 *   clicks(id, vid, token, href, at)                                       one row per click on a link in the page.
 *
 * Caps: MAX_VISITS and MAX_CLICKS rows per page (the oldest go first), MAX_CLICKS_PER_VISIT per load, and visible time never
 * more than the wall clock since the view plus a little slack, nor more than four hours.
 */
export const PAGE_MIGRATIONS: readonly { v: number; note: string; sql: readonly string[] }[] = [
  {
    v: 1,
    note: 'page analytics: one row per page load and one per click',
    sql: [
      'CREATE TABLE IF NOT EXISTS visits (vid TEXT PRIMARY KEY, token TEXT NOT NULL, visitor TEXT NOT NULL, started INTEGER NOT NULL, last INTEGER NOT NULL, ms INTEGER NOT NULL, country TEXT NOT NULL, ref TEXT NOT NULL, device TEXT NOT NULL) WITHOUT ROWID',
      'CREATE INDEX IF NOT EXISTS visits_started ON visits (started)',
      'CREATE TABLE IF NOT EXISTS clicks (id INTEGER PRIMARY KEY AUTOINCREMENT, vid TEXT NOT NULL, token TEXT NOT NULL, href TEXT NOT NULL, at INTEGER NOT NULL)',
      'CREATE INDEX IF NOT EXISTS clicks_vid ON clicks (vid)',
    ],
  },
]

export const MAX_VISITS = 20_000
export const MAX_CLICKS = 50_000
export const MAX_CLICKS_PER_VISIT = 200
/** A beat or hide may report a little more than the wall clock since the view (clock skew, the beacon racing the view). */
const SLACK_MS = 30_000

export type RecordInput = PageEvent & { visitor: string; country: string; device: string; now: number }

/** Apply one event to a page's tables. Pure over `sql`, so tests run it on an in-memory SQLite. Returns what it did. */
export function recordEvent(sql: SqlLike, ev: RecordInput): 'view' | 'time' | 'click' | 'ignored' {
  const row = sql.exec('SELECT token, started, ms FROM visits WHERE vid = ?', ev.v).toArray()[0] as { token: string; started: number; ms: number } | undefined
  if (ev.e === 'view') {
    if (row) return 'ignored'
    sql.exec(
      'INSERT INTO visits (vid, token, visitor, started, last, ms, country, ref, device) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)',
      ev.v,
      ev.t,
      ev.visitor,
      ev.now,
      ev.now,
      ev.country,
      ev.ref ?? '',
      ev.device
    )
    const n = Number(sql.exec('SELECT COUNT(*) AS n FROM visits').toArray()[0]?.n ?? 0)
    if (n > MAX_VISITS) {
      const old = sql.exec('SELECT vid FROM visits ORDER BY started ASC LIMIT ?', n - MAX_VISITS).toArray()
      for (const o of old) {
        sql.exec('DELETE FROM clicks WHERE vid = ?', o.vid)
        sql.exec('DELETE FROM visits WHERE vid = ?', o.vid)
      }
    }
    return 'view'
  }
  // Beats, hides and clicks belong to a view this object recorded, for the same link.
  if (!row || row.token !== ev.t) return 'ignored'
  if (ev.e === 'click') {
    const mine = Number(sql.exec('SELECT COUNT(*) AS n FROM clicks WHERE vid = ?', ev.v).toArray()[0]?.n ?? 0)
    if (mine >= MAX_CLICKS_PER_VISIT || !ev.href) return 'ignored'
    sql.exec('INSERT INTO clicks (vid, token, href, at) VALUES (?, ?, ?, ?)', ev.v, ev.t, ev.href, ev.now)
    sql.exec('UPDATE visits SET last = ? WHERE vid = ?', ev.now, ev.v)
    const n = Number(sql.exec('SELECT COUNT(*) AS n FROM clicks').toArray()[0]?.n ?? 0)
    if (n > MAX_CLICKS) sql.exec('DELETE FROM clicks WHERE id IN (SELECT id FROM clicks ORDER BY id ASC LIMIT ?)', n - MAX_CLICKS)
    return 'click'
  }
  if (ev.ms === undefined) return 'ignored'
  // Visible time only grows, and never past the time that has really passed since the view.
  const cap = Math.min(MAX_VISIBLE_MS, Math.max(0, ev.now - Number(row.started)) + SLACK_MS)
  const ms = Math.min(ev.ms, cap)
  if (ms <= Number(row.ms)) {
    sql.exec('UPDATE visits SET last = ? WHERE vid = ?', ev.now, ev.v)
    return 'time'
  }
  sql.exec('UPDATE visits SET ms = ?, last = ? WHERE vid = ?', ms, ev.now, ev.v)
  return 'time'
}

/** Read every row and summarise (lib/pages/stats.ts aggregate). */
export function readStats(sql: SqlLike, now: number): PageStats {
  const visits = sql.exec('SELECT vid, token, visitor, started, last, ms, country, ref, device FROM visits').toArray() as unknown as VisitRow[]
  const clicks = sql.exec('SELECT vid, token, href, at FROM clicks').toArray() as unknown as ClickRow[]
  return aggregate(
    visits.map((v) => ({ ...v, started: Number(v.started), last: Number(v.last), ms: Number(v.ms) })),
    clicks.map((c) => ({ ...c, at: Number(c.at) })),
    now
  )
}

export class PageStatsRoom extends DurableObject {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never)
    ctx.blockConcurrencyWhile(async () => {
      migrate(ctx.storage.sql, PAGE_MIGRATIONS)
    })
  }

  /** One event from worker/pages.ts (already checked: a live link of this page, not a bot). */
  async record(ev: RecordInput): Promise<string> {
    return recordEvent(this.ctx.storage.sql, ev)
  }

  async stats(now = Date.now()): Promise<PageStats> {
    return readStats(this.ctx.storage.sql, now)
  }
}
