import { describe, expect, it } from 'vitest'
import { aggregate, clickTarget, deviceOf, emptyStats, formatMs, median, MAX_VISIBLE_MS, parsePageEvent, refHost, type ClickRow, type VisitRow } from '../stats'
import { tokenFromPath, visibleClock } from '../beacon'

const T1 = 'AAAAAAAAAAAAAAAAAAAAAA'
const T2 = 'BBBBBBBBBBBBBBBBBBBBBB'
const DAY = 86_400_000
const NOW = Date.UTC(2026, 10, 13, 12)
const visit = (over: Partial<VisitRow>): VisitRow => ({ vid: 'v', token: T1, visitor: 'x', started: NOW, last: NOW, ms: 0, country: 'US', ref: '', device: 'desktop', ...over })

describe('aggregate', () => {
  const visits = [
    visit({ vid: 'a', visitor: 'p', started: NOW - 2 * DAY, ms: 60_000 }),
    visit({ vid: 'b', visitor: 'p', started: NOW - 2 * DAY + 1000, ms: 0 }),
    visit({ vid: 'c', visitor: 'p', started: NOW - DAY, ms: 30_000, country: 'PL', ref: 'linkedin.com', device: 'mobile' }),
    visit({ vid: 'd', token: T2, visitor: 'q', started: NOW, ms: 120_000 }),
  ]
  const clicks: ClickRow[] = [
    { vid: 'a', token: T1, href: '/resume', at: NOW - 2 * DAY },
    { vid: 'a', token: T1, href: 'github.com/x', at: NOW - 2 * DAY },
    { vid: 'd', token: T2, href: '/resume', at: NOW },
  ]
  const s = aggregate(visits, clicks, NOW)

  it('counts views, per-day visitors, and time over visits that reported any', () => {
    expect(s.views).toBe(4)
    // p on two different days counts twice: visitor hashes rotate daily.
    expect(s.uniques).toBe(3)
    expect(s.timed).toBe(3)
    expect(s.avgMs).toBe(70_000)
    expect(s.medianMs).toBe(60_000)
    expect(s.lastOpened).toBe(NOW)
  })

  it('fills a 30-day series, oldest first, zeros included', () => {
    expect(s.days).toHaveLength(30)
    expect(s.days.at(-1)).toEqual({ day: '2026-11-13', views: 1 })
    expect(s.days.at(-3)).toEqual({ day: '2026-11-11', views: 2 })
    expect(s.days[0].views).toBe(0)
  })

  it('splits by link', () => {
    expect(s.links[T1]).toEqual({ views: 3, uniques: 1, clicks: 2, avgMs: 45_000, lastOpened: NOW - DAY })
    expect(s.links[T2]).toEqual({ views: 1, uniques: 1, clicks: 1, avgMs: 120_000, lastOpened: NOW })
  })

  it('tallies clicks, countries, referrers and devices, most first', () => {
    expect(s.clicks[0]).toEqual({ key: '/resume', n: 2 })
    expect(s.countries).toEqual([
      { key: 'US', n: 3 },
      { key: 'PL', n: 1 },
    ])
    expect(s.referrers[0]).toEqual({ key: '(direct)', n: 3 })
    expect(s.devices.find((d) => d.key === 'mobile')?.n).toBe(1)
  })

  it('lists recent visits newest first with their click counts', () => {
    expect(s.recent.map((r) => r.clicks)).toEqual([1, 0, 0, 2])
  })

  it('is all zeros for no data', () => {
    const e = emptyStats(NOW)
    expect(e.views).toBe(0)
    expect(e.lastOpened).toBeNull()
    expect(e.days.every((d) => d.views === 0)).toBe(true)
  })

  it('median and formatMs', () => {
    expect(median([])).toBe(0)
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(3)
    expect(formatMs(38_000)).toBe('38s')
    expect(formatMs(245_000)).toBe('4m 05s')
    expect(formatMs(3_720_000)).toBe('1h 02m')
  })
})

describe('beacon events', () => {
  const V = 'abcdefghijklmnop'
  it('accepts the four events and cleans their fields', () => {
    expect(parsePageEvent({ t: T1, v: V, e: 'view', ref: 'https://www.linkedin.com/feed/?x=1' })).toEqual({ t: T1, v: V, e: 'view', ref: 'linkedin.com' })
    expect(parsePageEvent({ t: T1, v: V, e: 'beat', ms: 15_000.4 })).toEqual({ t: T1, v: V, e: 'beat', ms: 15_000 })
    expect(parsePageEvent({ t: T1, v: V, e: 'hide', ms: 1e12 })?.ms).toBe(MAX_VISIBLE_MS)
    expect(parsePageEvent({ t: T1, v: V, e: 'click', href: 'https://github.com/ItsMichal?tab=repos#x' })).toEqual({ t: T1, v: V, e: 'click', href: 'github.com/ItsMichal' })
  })

  it.each([null, [], { t: 'short', v: V, e: 'view' }, { t: T1, v: 'x', e: 'view' }, { t: T1, v: V, e: 'scroll' }, { t: T1, v: V, e: 'beat', ms: -1 }, { t: T1, v: V, e: 'beat', ms: 'NaN' }, { t: T1, v: V, e: 'click' }, { t: T1, v: V, e: 'click', href: 'javascript:alert(1)' }])('rejects %j', (b) => {
    expect(parsePageEvent(b)).toBeNull()
  })

  it('reduces referrers to a host and drops this site', () => {
    expect(refHost('https://michal.ai/writing')).toBe('')
    expect(refHost('android-app://com.slack')).toBe('')
    expect(refHost('')).toBe('')
    expect(refHost('https://mail.google.com/mail/u/0')).toBe('mail.google.com')
  })

  it('stores click targets without queries', () => {
    expect(clickTarget('/resume?x=1')).toBe('/resume')
    expect(clickTarget('https://michal.ai/projects/x#a')).toBe('/projects/x')
    expect(clickTarget('mailto:someone@example.com')).toBe('mailto:')
    expect(clickTarget('https://example.com/')).toBe('example.com')
  })

  it('classifies devices from the user agent', () => {
    expect(deviceOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148')).toBe('mobile')
    expect(deviceOf('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36')).toBe('mobile')
    expect(deviceOf('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('tablet')
    expect(deviceOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('desktop')
  })

  it('reads the token from the address bar only', () => {
    expect(tokenFromPath(`/p/${T1}`)).toBe(T1)
    expect(tokenFromPath(`/p/${T1}.data`)).toBeNull()
    expect(tokenFromPath('/p/short')).toBeNull()
    expect(tokenFromPath('/writing/x')).toBeNull()
  })

  it('counts visible time only while running', () => {
    let t = 0
    const c = visibleClock(() => t)
    c.start()
    t = 1000
    c.stop()
    t = 5000
    expect(c.ms()).toBe(1000)
    c.start()
    c.start()
    t = 5500
    expect(c.ms()).toBe(1500)
  })
})
