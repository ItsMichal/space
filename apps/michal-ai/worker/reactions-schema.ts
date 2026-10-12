// Schema of one ReactionsRoom (one SQLite database per post id), as an append-only list of migrations.
//
// Never edit or reorder an entry that has shipped: add a new one with the next version number. The current version is kept in
// `meta`, so a room created before versioning existed (it has `r` and `c` but no `meta`) simply replays v1, which is
// idempotent (IF NOT EXISTS), and then continues. This is separate from wrangler.jsonc `migrations`, which only register
// Durable Object classes (v1 PresenceRoom, v2 ReactionsRoom): no new class was added, so no new wrangler tag is needed.

export interface SqlLike {
  exec(query: string, ...bindings: unknown[]): Iterable<Record<string, unknown>> & { toArray(): Record<string, unknown>[] }
}

export const MIGRATIONS: readonly { v: number; note: string; sql: readonly string[] }[] = [
  {
    v: 1,
    note: 'reactions: one row per (target, session, emoji) and aggregate counts per (target, emoji)',
    sql: [
      'CREATE TABLE IF NOT EXISTS r (target TEXT NOT NULL, sid TEXT NOT NULL, emoji TEXT NOT NULL, PRIMARY KEY (target, sid, emoji)) WITHOUT ROWID',
      'CREATE TABLE IF NOT EXISTS c (target TEXT NOT NULL, emoji TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (target, emoji)) WITHOUT ROWID',
    ],
  },
  {
    v: 2,
    note: 'views: visitors already counted today (rows older than today are deleted on write); the running total lives in c as (~, views)',
    sql: ['CREATE TABLE IF NOT EXISTS vseen (day TEXT NOT NULL, vid TEXT NOT NULL, PRIMARY KEY (day, vid)) WITHOUT ROWID'],
  },
]

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].v

/** Bring a room's database up to SCHEMA_VERSION. Returns the version it ended at. Safe to call on every start. */
export function migrate(sql: SqlLike): number {
  sql.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL) WITHOUT ROWID')
  let cur = Number(sql.exec("SELECT v FROM meta WHERE k = 'schema'").toArray()[0]?.v ?? 0)
  for (const m of MIGRATIONS) {
    if (m.v <= cur) continue
    for (const stmt of m.sql) sql.exec(stmt)
    sql.exec("INSERT INTO meta (k, v) VALUES ('schema', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v", String(m.v))
    cur = m.v
  }
  return cur
}
