import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { LIVE_LIMITS } from '../constants'
import { cleanLabel, jitter, placeFromCf, publicPoint, snap } from '../geo'
import { addVisit, markSeen, utcDay, type PastVisit } from '../history'
import { createLimiter, ipKey } from '../ratelimit'
import { MemoryReactionStore, topReaction } from '../reactions-core'
import { LIVE_SLUGS } from '../slugs.generated'
import { originAllowed, parseClientMsg, parseReactionBody } from '../validate'
import { blockIds } from '../blocks'

const SID = 'abcdefghijklmnop1234'

describe('geo', () => {
  it('snaps to the 0.5 degree grid', () => {
    expect(snap(33.9164, -118.3526)).toEqual({ lat: 34, lon: -118.5 })
    expect(snap(51.5074, -0.1278)).toEqual({ lat: 51.5, lon: 0 })
  })
  it('rejects non-finite and out-of-range input', () => {
    expect(snap(NaN, 0)).toBeNull()
    expect(snap(91, 0)).toBeNull()
    expect(snap(0, 181)).toBeNull()
  })
  it('jitter is deterministic, bounded, and keyed by the opaque id only', () => {
    const a = jitter('abc')
    expect(jitter('abc')).toEqual(a)
    expect(jitter('abd')).not.toEqual(a)
    for (let i = 0; i < 200; i++) {
      const j = jitter('k' + i)
      expect(Math.abs(j.dlat)).toBeLessThanOrEqual(LIVE_LIMITS.jitterDeg)
      expect(Math.abs(j.dlon)).toBeLessThanOrEqual(LIVE_LIMITS.jitterDeg)
    }
  })
  it('public points stay inside the snapped cell and never reveal the true point', () => {
    const p = publicPoint(33.9164, -118.3526, 'id1')!
    expect(Math.abs(p.lat - 34)).toBeLessThanOrEqual(0.25)
    expect(Math.abs(p.lon + 118.5)).toBeLessThanOrEqual(0.25)
    // decimals are capped
    expect(String(p.lat).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2)
  })
  it('different visitors in one city do not stack', () => {
    const pts = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(publicPoint(40.71, -74.0, 'v' + i))))
    expect(pts.size).toBeGreaterThan(25)
  })
  it('clean labels and cf parsing', () => {
    expect(cleanLabel("São Paulo<script>")).toBe('São Pauloscript')
    expect(cleanLabel(5)).toBe('')
    expect(cleanLabel('x'.repeat(200)).length).toBe(48)
    const p = placeFromCf({ latitude: '34.05', longitude: '-118.24', city: 'Los Angeles', region: 'California', country: 'US', ip: '1.2.3.4' })!
    expect(p).toEqual({ lat: 34, lon: -118, city: 'Los Angeles', region: 'California', country: 'US' })
    expect(placeFromCf({ city: 'x' })).toBeNull()
    expect(placeFromCf(undefined)).toBeNull()
  })
})

describe('validation', () => {
  it('client messages', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'hi', sid: SID, emoji: 'moon' }))).toEqual({ t: 'hi', sid: SID, emoji: 'moon' })
    expect(parseClientMsg(JSON.stringify({ t: 'em', emoji: 'tea' }))).toEqual({ t: 'em', emoji: 'tea' })
    expect(parseClientMsg('{"t":"ping"}')).toEqual({ t: 'ping' })
    expect(parseClientMsg(JSON.stringify({ t: 'em', emoji: '💩' }))).toBeNull()
    expect(parseClientMsg(JSON.stringify({ t: 'hi', sid: 'short', emoji: 'moon' }))).toBeNull()
    expect(parseClientMsg(JSON.stringify({ t: 'em', emoji: 'tea', extra: 1 }))).toBeNull()
    expect(parseClientMsg('not json')).toBeNull()
    expect(parseClientMsg('[]')).toBeNull()
    expect(parseClientMsg('x'.repeat(LIVE_LIMITS.maxMsgBytes + 1))).toBeNull()
  })
  it('reaction bodies', () => {
    const ok = { slug: 'hello-paper', target: 'post', emoji: 'clap', sid: SID, on: true }
    expect(parseReactionBody(ok)).toEqual(ok)
    expect(parseReactionBody({ ...ok, target: 'a1b2c' })).not.toBeNull()
    expect(parseReactionBody({ ...ok, target: 'a1b2c-2' })).not.toBeNull()
    expect(parseReactionBody({ ...ok, target: '../x' })).toBeNull()
    expect(parseReactionBody({ ...ok, emoji: 'poop' })).toBeNull()
    expect(parseReactionBody({ ...ok, on: 'yes' })).toBeNull()
    expect(parseReactionBody({ ...ok, slug: 'Hello Paper' })).toBeNull()
    expect(parseReactionBody({ ...ok, junk: 1 })).toBeNull()
    expect(parseReactionBody(ok, new Set(['other']))).toBeNull()
    expect(parseReactionBody(null)).toBeNull()
  })
  it('origin allowlist', () => {
    expect(originAllowed('https://michal.ai')).toBe(true)
    expect(originAllowed('http://localhost:3000')).toBe(true)
    expect(originAllowed('https://space.x.workers.dev')).toBe(true)
    expect(originAllowed('https://evil.example')).toBe(false)
    expect(originAllowed('https://michal.ai.evil.example')).toBe(false)
    expect(originAllowed(null)).toBe(false)
    expect(originAllowed('nonsense')).toBe(false)
  })
})

describe('rate limiter', () => {
  it('allows up to the limit, then blocks until the window rolls', () => {
    const l = createLimiter(3, 1000)
    expect([1, 2, 3].map(() => l.hit('a', 0).ok)).toEqual([true, true, true])
    const blocked = l.hit('a', 10)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfter).toBe(1)
    expect(l.hit('b', 10).ok).toBe(true)
    expect(l.hit('a', 1000).ok).toBe(true)
  })
  it('bounds memory', () => {
    const l = createLimiter(1, 1000, 10)
    for (let i = 0; i < 100; i++) l.hit('k' + i, 0)
    expect(l.size()).toBeLessThanOrEqual(10)
  })
  it('ip hashes are salted, daily, and do not contain the ip', async () => {
    const day1 = Date.UTC(2026, 9, 1)
    const a = await ipKey('203.0.113.7', 's', day1)
    expect(a).toMatch(/^[0-9a-f]{16}$/)
    expect(await ipKey('203.0.113.7', 's', day1)).toBe(a)
    expect(await ipKey('203.0.113.7', 's', day1 + 86_400_000)).not.toBe(a)
    expect(await ipKey('203.0.113.7', 't', day1)).not.toBe(a)
    expect(await ipKey('203.0.113.8', 's', day1)).not.toBe(a)
  })
})

describe('reactions', () => {
  it('toggles on and off, idempotently', () => {
    const s = new MemoryReactionStore()
    expect(s.set('post', 'clap', 'a', true)).toBe(true)
    expect(s.set('post', 'clap', 'a', true)).toBe(false)
    expect(s.counts().post.clap).toBe(1)
    expect(s.set('post', 'clap', 'b', true)).toBe(true)
    expect(s.counts().post.clap).toBe(2)
    expect(s.set('post', 'clap', 'a', false)).toBe(true)
    expect(s.set('post', 'clap', 'a', false)).toBe(false)
    expect(s.counts().post.clap).toBe(1)
    expect(s.mine('b')).toEqual({ post: ['clap'] })
    expect(s.mine('a')).toEqual({})
  })
  it('one of each emoji per session per target', () => {
    const s = new MemoryReactionStore()
    s.set('abcde', 'fire', 'a', true)
    s.set('abcde', 'heart', 'a', true)
    s.set('zzzzz', 'fire', 'a', true)
    expect(s.counts()).toEqual({ abcde: { fire: 1, heart: 1 }, zzzzz: { fire: 1 } })
  })
  it('enforces row and block caps', () => {
    const s = new MemoryReactionStore(3, 2)
    expect(s.set('a1111', 'fire', 'a', true)).toBe(true)
    expect(s.set('b2222', 'fire', 'a', true)).toBe(true)
    expect(s.set('c3333', 'fire', 'a', true)).toBe(false)
    expect(s.set('post', 'fire', 'a', true)).toBe(true)
    expect(s.set('post', 'heart', 'a', true)).toBe(false)
  })
  it('picks the top reaction in preset order on ties', () => {
    expect(topReaction({ heart: 2, clap: 2 })).toEqual({ id: 'clap', n: 2 })
    expect(topReaction({ fire: 3, clap: 1 })).toEqual({ id: 'fire', n: 3 })
    expect(topReaction({})).toBeNull()
  })
})

describe('history', () => {
  const v = (day: string, i = 0): PastVisit => ({ lat: i, lon: 0, city: 'x', country: 'US', emoji: 'tea', day })
  it('caps by count', () => {
    let h: PastVisit[] = []
    const now = Date.UTC(2026, 9, 11)
    for (let i = 0; i < 260; i++) h = addVisit(h, v('2026-10-11', i), now)
    expect(h.length).toBe(LIVE_LIMITS.historyMax)
    expect(h[h.length - 1].lat).toBe(259)
  })
  it('drops entries older than the window', () => {
    const now = Date.UTC(2026, 9, 11)
    const h = addVisit([v('2026-08-01'), v('2026-09-20')], v('2026-10-11'), now)
    expect(h.map((x) => x.day)).toEqual(['2026-09-20', '2026-10-11'])
  })
  it('dedupes per session per day and resets on a new day', () => {
    let seen = { day: '2026-10-11', ids: [] as string[] }
    let r = markSeen(seen, 'h1', '2026-10-11')
    expect(r.first).toBe(true)
    r = markSeen(r.seen, 'h1', '2026-10-11')
    expect(r.first).toBe(false)
    r = markSeen(r.seen, 'h1', '2026-10-12')
    expect(r.first).toBe(true)
    expect(r.seen.ids).toEqual(['h1'])
    expect(utcDay(Date.UTC(2026, 9, 11, 23, 59))).toBe('2026-10-11')
    seen = markSeen(seen, 'a', '2026-10-11', 2).seen
    seen = markSeen(seen, 'b', '2026-10-11', 2).seen
    seen = markSeen(seen, 'c', '2026-10-11', 2).seen
    expect(seen.ids).toEqual(['b', 'c'])
  })
})

describe('block ids', () => {
  it('are stable, content-derived, and disambiguate duplicates', () => {
    const ids = blockIds(['Hello world.', 'Second paragraph here.', 'Hello world.'])
    expect(ids[0]).toMatch(/^[0-9a-z]{5}$/)
    expect(ids[2]).toBe(ids[0] + '-1')
    expect(blockIds(['Second paragraph here.'])[0]).toBe(ids[1])
    // inserting a paragraph elsewhere does not change the others
    expect(blockIds(['New one.', 'Hello world.', 'Second paragraph here.'])[2]).toBe(ids[1])
    // whitespace and case do not matter
    expect(blockIds(['  hello   WORLD. '])[0]).toBe(ids[0])
  })
})

describe('generated slugs', () => {
  it('match the published posts in content/posts', async () => {
    const matter = (await import('gray-matter')).default
    const dir = path.resolve(__dirname, '../../../content/posts')
    const slugs: string[] = []
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
      const { data } = matter(fs.readFileSync(path.join(dir, f), 'utf8'))
      if (data.draft) continue
      slugs.push(String(data.slug ?? f.replace(/\.md$/, '')))
    }
    expect([...LIVE_SLUGS]).toEqual(slugs.sort())
  })
})
