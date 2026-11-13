// Private page analytics: the rows the Worker keeps (worker/page-stats-room.ts) and the summary the editor shows. Pure, so the
// aggregation is unit tested here and shared with the editor through the overlay build. Nothing here holds an IP or a cookie:
// `visitor` is a salted hash that changes every UTC day (see worker/pages.ts), `vid` is a random id one page load makes up.

/** One page load. ms is visible time (the tab in front), as the page last reported it, capped by the wall clock. */
export type VisitRow = {
  vid: string
  token: string
  visitor: string
  started: number
  last: number
  ms: number
  country: string
  ref: string
  device: string
}
/** One click on a link in the page. */
export type ClickRow = { vid: string; token: string; href: string; at: number }

export type Count = { key: string; n: number }
export type LinkStats = { views: number; uniques: number; clicks: number; avgMs: number; lastOpened: number | null }
export type PageStats = {
  views: number
  uniques: number
  /** Visits that reported any visible time. Average and median are over these. */
  timed: number
  avgMs: number
  medianMs: number
  lastOpened: number | null
  /** The last `days` UTC days, oldest first, zeros included. */
  days: { day: string; views: number }[]
  links: Record<string, LinkStats>
  clicks: Count[]
  countries: Count[]
  referrers: Count[]
  devices: Count[]
  recent: { at: number; token: string; ms: number; country: string; ref: string; device: string; clicks: number }[]
}

const DAY = 86_400_000
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

function tally(keys: string[], top: number): Count[] {
  const m = new Map<string, number>()
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
  return [...m].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key)).slice(0, top)
}

export const emptyStats = (now = Date.now(), days = 30): PageStats => aggregate([], [], now, days)

/** Summarise a page's visits and clicks as of `now`. */
export function aggregate(visits: VisitRow[], clicks: ClickRow[], now = Date.now(), days = 30): PageStats {
  const timedMs = visits.map((v) => v.ms).filter((ms) => ms > 0)
  const byDay = new Map<string, number>()
  for (const v of visits) byDay.set(dayOf(v.started), (byDay.get(dayOf(v.started)) ?? 0) + 1)
  const start = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate()) - (days - 1) * DAY
  const series = Array.from({ length: days }, (_, i) => {
    const day = dayOf(start + i * DAY)
    return { day, views: byDay.get(day) ?? 0 }
  })

  const links: Record<string, LinkStats> = {}
  const clicksByVid = new Map<string, number>()
  for (const c of clicks) clicksByVid.set(c.vid, (clicksByVid.get(c.vid) ?? 0) + 1)
  const tokens = new Set([...visits.map((v) => v.token), ...clicks.map((c) => c.token)])
  for (const t of tokens) {
    const vs = visits.filter((v) => v.token === t)
    const ms = vs.map((v) => v.ms).filter((x) => x > 0)
    links[t] = {
      views: vs.length,
      uniques: new Set(vs.map((v) => v.visitor)).size,
      clicks: clicks.filter((c) => c.token === t).length,
      avgMs: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : 0,
      lastOpened: vs.length ? Math.max(...vs.map((v) => v.started)) : null,
    }
  }

  return {
    views: visits.length,
    // A visitor hash changes every day, so this counts distinct visitors per day, summed: an upper bound across days.
    uniques: new Set(visits.map((v) => `${dayOf(v.started)}|${v.visitor}`)).size,
    timed: timedMs.length,
    avgMs: timedMs.length ? Math.round(timedMs.reduce((a, b) => a + b, 0) / timedMs.length) : 0,
    medianMs: median(timedMs),
    lastOpened: visits.length ? Math.max(...visits.map((v) => v.started)) : null,
    days: series,
    links,
    clicks: tally(
      clicks.map((c) => c.href),
      20
    ),
    countries: tally(
      visits.map((v) => v.country || '??'),
      12
    ),
    referrers: tally(
      visits.map((v) => v.ref || '(direct)'),
      12
    ),
    devices: tally(
      visits.map((v) => v.device || 'other'),
      4
    ),
    recent: [...visits]
      .sort((a, b) => b.started - a.started)
      .slice(0, 25)
      .map((v) => ({ at: v.started, token: v.token, ms: v.ms, country: v.country, ref: v.ref, device: v.device, clicks: clicksByVid.get(v.vid) ?? 0 })),
  }
}

/** "4m 05s", "38s", "1h 02m": a duration for the stats screen. */
export function formatMs(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

/* ------------------------------------------------------------- the beacon */

/** What the page sends to /api/pages/event. */
export type PageEvent = { t: string; v: string; e: 'view' | 'beat' | 'hide' | 'click'; ms?: number; href?: string; ref?: string }

export const VID_RE = /^[A-Za-z0-9_-]{16,32}$/
export const MAX_VISIBLE_MS = 4 * 60 * 60 * 1000
const EVENTS = new Set(['view', 'beat', 'hide', 'click'])

/** Reduce a referrer URL to its host, or '' (none, unparsable, or this site). */
export function refHost(ref: unknown, self = 'michal.ai'): string {
  if (typeof ref !== 'string' || !ref) return ''
  try {
    const u = new URL(ref)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    const h = u.hostname.toLowerCase().replace(/^www\./, '')
    return h === self ? '' : h.slice(0, 80)
  } catch {
    return /^[a-z0-9.-]{1,80}$/i.test(ref) ? ref.toLowerCase().replace(/^www\./, '') : ''
  }
}

/** A click target as stored: a site path, or an outbound URL's origin and path (no query, no fragment), at most 200 characters. */
export function clickTarget(href: unknown): string {
  if (typeof href !== 'string' || !href) return ''
  try {
    const u = new URL(href, 'https://michal.ai')
    if (u.protocol === 'mailto:') return 'mailto:'
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    const s = u.host === 'michal.ai' ? u.pathname : `${u.host}${u.pathname === '/' ? '' : u.pathname}`
    return s.slice(0, 200)
  } catch {
    return ''
  }
}

/** The kind of device from a user agent: no version, no model. */
export function deviceOf(ua: string | null | undefined): 'mobile' | 'tablet' | 'desktop' {
  if (!ua) return 'desktop'
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return 'tablet'
  if (/Mobi|iPhone|Android/i.test(ua)) return 'mobile'
  return 'desktop'
}

/** Check a beacon body. Returns the event with its fields cleaned, or null. The token is checked against the live links elsewhere. */
export function parsePageEvent(input: unknown): PageEvent | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const b = input as Record<string, unknown>
  if (typeof b.t !== 'string' || !/^[A-Za-z0-9_-]{22,64}$/.test(b.t)) return null
  if (typeof b.v !== 'string' || !VID_RE.test(b.v)) return null
  if (typeof b.e !== 'string' || !EVENTS.has(b.e)) return null
  const out: PageEvent = { t: b.t, v: b.v, e: b.e as PageEvent['e'] }
  if (b.ms !== undefined) {
    if (typeof b.ms !== 'number' || !Number.isFinite(b.ms) || b.ms < 0) return null
    out.ms = Math.min(Math.round(b.ms), MAX_VISIBLE_MS)
  }
  if (out.e === 'click') {
    const href = clickTarget(b.href)
    if (!href) return null
    out.href = href
  }
  if (out.e === 'view') out.ref = refHost(b.ref)
  return out
}
