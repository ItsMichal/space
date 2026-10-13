import { describe, expect, it } from 'vitest'
import { migrate, MIGRATIONS, SCHEMA_VERSION, type SqlLike } from './reactions-schema'

// A recording stand-in for ctx.storage.sql: it keeps `meta` like SQLite would and logs every statement.
function fakeSql(initial: { meta?: number; tables?: string[] } = {}) {
  const log: string[] = []
  const tables = new Set(initial.tables ?? [])
  let version = initial.meta
  const sql: SqlLike = {
    exec(q: string, ...b: unknown[]) {
      log.push(q)
      let rows: Record<string, unknown>[] = []
      if (q.startsWith('SELECT v FROM meta')) rows = version === undefined ? [] : [{ v: String(version) }]
      if (q.startsWith('INSERT INTO meta')) version = Number(b[0])
      const m = /CREATE TABLE IF NOT EXISTS (\w+)/.exec(q)
      if (m) tables.add(m[1])
      return Object.assign(rows, { toArray: () => rows }) as never
    },
  }
  return { sql, log, tables, version: () => version }
}

describe('reactions schema migrations', () => {
  it('versions are consecutive from 1, so the list can only be appended to', () => {
    expect(MIGRATIONS.map((m) => m.v)).toEqual(MIGRATIONS.map((_, i) => i + 1))
    expect(SCHEMA_VERSION).toBe(MIGRATIONS.length)
  })

  it('a new room gets every table, and the version is recorded', () => {
    const f = fakeSql()
    expect(migrate(f.sql)).toBe(SCHEMA_VERSION)
    expect([...f.tables].sort()).toEqual(['blob', 'c', 'meta', 'r', 'vseen'])
    expect(f.version()).toBe(SCHEMA_VERSION)
  })

  it('a room created before versioning (r and c, no meta) replays v1 harmlessly and gains the views table', () => {
    const f = fakeSql({ tables: ['r', 'c'] })
    migrate(f.sql)
    expect(f.tables.has('vseen')).toBe(true)
    expect(f.log.filter((q) => q.startsWith('DROP') || q.startsWith('DELETE'))).toEqual([])
  })

  it('is a no-op once current', () => {
    const f = fakeSql({ meta: SCHEMA_VERSION, tables: ['r', 'c', 'vseen', 'blob', 'meta'] })
    migrate(f.sql)
    expect(f.log.filter((q) => q.startsWith('CREATE TABLE IF NOT EXISTS') && !q.includes('meta'))).toEqual([])
  })

  it('runs only the migrations above the stored version', () => {
    const f = fakeSql({ meta: 1, tables: ['r', 'c', 'meta'] })
    migrate(f.sql)
    expect(f.log.some((q) => q.includes('TABLE IF NOT EXISTS r '))).toBe(false)
    expect(f.tables.has('vseen')).toBe(true)
  })

  it('v3 adds the Starlink blob table to a v2 room without touching anything else', () => {
    const f = fakeSql({ meta: 2, tables: ['r', 'c', 'vseen', 'meta'] })
    expect(migrate(f.sql)).toBe(3)
    expect(f.tables.has('blob')).toBe(true)
    const ran = f.log.filter((q) => q.startsWith('CREATE TABLE IF NOT EXISTS') && !q.includes('meta'))
    expect(ran).toHaveLength(1)
    expect(ran[0]).toContain('blob')
    expect(f.log.filter((q) => q.startsWith('DROP') || q.startsWith('DELETE'))).toEqual([])
  })
})
