// Strict hand-written validators: unknown in, typed value out, null on anything unexpected.
import { LIVE_LIMITS, REACTION_IDS, VISIT_EMOJI_IDS } from './constants'
import { POST_TARGET } from './reactions-core'

export type ClientMsg = { t: 'hi'; sid: string; emoji: string } | { t: 'em'; emoji: string } | { t: 'ping' }

export const SID_RE = /^[A-Za-z0-9_-]{16,32}$/
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/
/** A stable post id (frontmatter `id`, defaults to the slug). Same alphabet as a slug. */
export const ID_RE = SLUG_RE
/** A highlight block id: five base36 chars (content hash), optional duplicate counter. */
export const BLOCK_RE = /^[0-9a-z]{5}(-\d{1,2})?$/

export function parseClientMsg(text: unknown): ClientMsg | null {
  if (typeof text !== 'string' || text.length > LIVE_LIMITS.maxMsgBytes) return null
  let d: unknown
  try {
    d = JSON.parse(text)
  } catch {
    return null
  }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null
  const o = d as Record<string, unknown>
  const n = Object.keys(o).length
  if (o.t === 'ping' && n === 1) return { t: 'ping' }
  if (o.t === 'em' && n === 2 && typeof o.emoji === 'string' && VISIT_EMOJI_IDS.includes(o.emoji)) {
    return { t: 'em', emoji: o.emoji }
  }
  if (
    o.t === 'hi' &&
    n === 3 &&
    typeof o.sid === 'string' &&
    SID_RE.test(o.sid) &&
    typeof o.emoji === 'string' &&
    VISIT_EMOJI_IDS.includes(o.emoji)
  ) {
    return { t: 'hi', sid: o.sid, emoji: o.emoji }
  }
  return null
}

export interface ReactionBody {
  id: string
  /** 'post' or a block id. */
  target: string
  emoji: string
  sid: string
  on: boolean
}

export function parseReactionBody(d: unknown, knownIds?: ReadonlySet<string>): ReactionBody | null {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null
  const o = d as Record<string, unknown>
  const allowed = new Set(['id', 'target', 'emoji', 'sid', 'on'])
  if (Object.keys(o).some((k) => !allowed.has(k))) return null
  const { id, target, emoji, sid, on } = o
  if (typeof id !== 'string' || !ID_RE.test(id)) return null
  if (knownIds && !knownIds.has(id)) return null
  if (typeof target !== 'string' || !(target === POST_TARGET || BLOCK_RE.test(target))) return null
  if (typeof emoji !== 'string' || !REACTION_IDS.includes(emoji)) return null
  if (typeof sid !== 'string' || !SID_RE.test(sid)) return null
  if (typeof on !== 'boolean') return null
  return { id, target, emoji, sid, on }
}

/** Origins allowed to open sockets or write: the request's own host, michal.ai, workers.dev previews and local development. */
const HOSTS = new Set(['michal.ai', 'localhost', '127.0.0.1', '[::1]'])
export function originAllowed(origin: string | null, requestHost?: string): boolean {
  if (!origin) return false
  let u: URL
  try {
    u = new URL(origin)
  } catch {
    return false
  }
  if (requestHost && u.host === requestHost) return true
  return HOSTS.has(u.hostname) || u.hostname.endsWith('.workers.dev')
}

export interface ViewBody {
  id: string
  /** Random visitor id kept in the browser's localStorage (same shape as a reaction `sid`). */
  vid: string
}

/** `{ id, vid }` and nothing else. */
export function parseViewBody(d: unknown, knownIds?: ReadonlySet<string>): ViewBody | null {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null
  const o = d as Record<string, unknown>
  if (Object.keys(o).length !== 2) return null
  const { id, vid } = o
  if (typeof id !== 'string' || !ID_RE.test(id)) return null
  if (knownIds && !knownIds.has(id)) return null
  if (typeof vid !== 'string' || !SID_RE.test(vid)) return null
  return { id, vid }
}

const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|headless|lighthouse|pagespeed|prerender|preview|fetch|monitor|uptime|pingdom|curl|wget|python|axios|httpclient|java\/|go-http|libwww|scrapy|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|skype|vkshare|quora|ahrefs|semrush|mj12|petalbot|gtmetrix|phantomjs|playwright|puppeteer/i

/** True for crawlers, link unfurlers and automation, and for a missing user agent. Views are not counted for them. */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  return !ua || ua.length < 12 || BOT_UA.test(ua)
}

/** Speculative loads (prefetch / prerender) are not visits. `get` reads a header by name. */
export function isSpeculative(get: (name: string) => string | null): boolean {
  const p = `${get('Sec-Purpose') ?? ''} ${get('Purpose') ?? ''} ${get('X-Purpose') ?? ''}`.toLowerCase()
  return /prefetch|prerender|preview/.test(p)
}
