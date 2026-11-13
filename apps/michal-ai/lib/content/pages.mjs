// Content rules for private pages: link-only pages for one reader (an employer, say), served at /p/<token> and never listed.
// They live in the private ItsMichal/space-content repo as pages/<id>.md, are written by the editor's Pages screen, and are
// checked with the post rules for their body (rules.mjs bodyProblems, dashes, raw text) plus the front matter schema below.
// Same places as the post rules: space-content CI, the space build (scripts/content/validate.mjs), the editor's Worker.
// Plain JavaScript with no dependencies. Types: pages.d.mts. How the site serves them: docs/private-pages.md.
//
// Front matter, exactly these keys:
//   title        required, shown as the page heading and the tab title
//   description  optional lede under the heading
//   date         optional yyyy-mm-dd shown under the heading
//   expires      optional yyyy-mm-dd: the page answers 404 after that day (UTC), whatever its links say
//   disabled     optional true: every link answers 404
//   links        one or more { token, label, expires?, revoked? }: each is its own URL, /p/<token>, so the stats tell recipients apart
//                  token    22 to 64 characters of A-Z a-z 0-9 _ - (the editor makes 22: 132 random bits)
//                  label    who the link is for, only ever shown in the editor
//                  expires  optional yyyy-mm-dd for this link alone
//                  revoked  optional true: this link answers 404
import { STRICT_SLUG_RE, bodyProblems, dashLines, rawPostProblem } from './rules.mjs'

export const PAGES = {
  bytes: 256 * 1024,
  title: 200,
  description: 1000,
  label: 120,
  links: 50,
  idLength: 60,
}

export const PAGE_TOKEN_RE = /^[A-Za-z0-9_-]{22,64}$/
const ISO_DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/
const PAGE_KEYS = new Set(['title', 'description', 'date', 'expires', 'disabled', 'links'])
const LINK_KEYS = new Set(['token', 'label', 'expires', 'revoked'])
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const isoDate = (v) => (v instanceof Date && !Number.isNaN(v.getTime()) ? v.toISOString().slice(0, 10) : typeof v === 'string' ? v : undefined)
const printable = (s) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s)

export function pageIdProblem(id) {
  if (typeof id !== 'string' || !STRICT_SLUG_RE.test(id)) return 'page file name must be lowercase a-z, 0-9 and single hyphens'
  if (id.length > PAGES.idLength) return `page file name is longer than ${PAGES.idLength} characters`
  return null
}

/**
 * Check front matter as gray-matter parsed it (YAML dates may arrive as Date). Returns { page } (a fresh copy holding only the
 * checked fields, dates as yyyy-mm-dd strings) or { problem }. Problems never quote the page's text, so a public build log can print them.
 */
export function parsePageData(data) {
  if (!isObj(data)) return { problem: 'front matter is missing' }
  for (const k of Object.keys(data)) if (!PAGE_KEYS.has(k)) return { problem: `unknown front matter key "${String(k).slice(0, 30)}" (allowed: ${[...PAGE_KEYS].join(', ')})` }
  const page = { title: '', links: [] }
  if (typeof data.title !== 'string' || !data.title.trim()) return { problem: 'title is required' }
  if (data.title.length > PAGES.title || !printable(data.title)) return { problem: `title must be plain text of at most ${PAGES.title} characters` }
  page.title = data.title
  if (data.description !== undefined && data.description !== null && data.description !== '') {
    if (typeof data.description !== 'string' || data.description.length > PAGES.description || !printable(data.description)) return { problem: `description must be plain text of at most ${PAGES.description} characters` }
    page.description = data.description
  }
  for (const k of ['date', 'expires']) {
    if (data[k] === undefined || data[k] === null || data[k] === '') continue
    const d = isoDate(data[k])
    if (!d || !ISO_DATE_RE.test(d)) return { problem: `${k} must be yyyy-mm-dd` }
    page[k] = d
  }
  if (data.disabled !== undefined && data.disabled !== null) {
    if (typeof data.disabled !== 'boolean') return { problem: 'disabled must be true or false' }
    if (data.disabled) page.disabled = true
  }
  if (!Array.isArray(data.links) || data.links.length === 0) return { problem: 'links must list at least one link' }
  if (data.links.length > PAGES.links) return { problem: `at most ${PAGES.links} links` }
  const seen = new Set()
  for (const [i, l] of data.links.entries()) {
    const at = `link ${i + 1}`
    if (!isObj(l)) return { problem: `${at} must be { token, label }` }
    for (const k of Object.keys(l)) if (!LINK_KEYS.has(k)) return { problem: `${at}: unknown key "${String(k).slice(0, 30)}" (allowed: ${[...LINK_KEYS].join(', ')})` }
    if (typeof l.token !== 'string' || !PAGE_TOKEN_RE.test(l.token)) return { problem: `${at}: token must be 22 to 64 characters of A-Z, a-z, 0-9, _ and -` }
    if (seen.has(l.token)) return { problem: `${at}: token is used twice` }
    seen.add(l.token)
    if (typeof l.label !== 'string' || l.label.length > PAGES.label || !printable(l.label)) return { problem: `${at}: label must be plain text of at most ${PAGES.label} characters` }
    const link = { token: l.token, label: l.label }
    if (l.expires !== undefined && l.expires !== null && l.expires !== '') {
      const d = isoDate(l.expires)
      if (!d || !ISO_DATE_RE.test(d)) return { problem: `${at}: expires must be yyyy-mm-dd` }
      link.expires = d
    }
    if (l.revoked !== undefined && l.revoked !== null) {
      if (typeof l.revoked !== 'boolean') return { problem: `${at}: revoked must be true or false` }
      if (l.revoked) link.revoked = true
    }
    page.links.push(link)
  }
  return { page }
}

/** Every problem with one page file's raw text and its parsed parts: size, front matter schema, body directives and links, dashes. */
export function pageProblems(raw, data, body) {
  const rp = rawPostProblem(raw)
  if (rp) return [rp.replace(/^post/, 'page')]
  const out = []
  const r = parsePageData(data)
  if (r.problem) out.push(r.problem)
  // bodyProblems quotes at most a URL fragment of the page; the caller decides whether its log may show them.
  out.push(...bodyProblems(body))
  const dashes = dashLines(raw)
  if (dashes.length) out.push(`em or en dash on line${dashes.length > 1 ? 's' : ''} ${dashes.slice(0, 8).map((d) => d.line).join(', ')}`)
  return out
}

/** Tokens used by more than one page (every token must open exactly one page). Input: [{ id, page }]. */
export function pageTokenClashes(pages) {
  const owner = new Map()
  const out = []
  for (const { id, page } of pages) {
    for (const l of page.links) {
      if (owner.has(l.token) && owner.get(l.token) !== id) out.push(`a token of ${id} is also used by ${owner.get(l.token)}`)
      else owner.set(l.token, id)
    }
  }
  return out
}

/**
 * The last day (yyyy-mm-dd, UTC, inclusive) a link opens its page, '' for no end, or null when it never opens (page disabled,
 * link revoked). The earlier of the page's and the link's expiry wins.
 */
export function linkUntil(page, link) {
  if (page.disabled || link.revoked) return null
  const ends = [page.expires, link.expires].filter(Boolean).sort()
  return ends[0] ?? ''
}

/** Whether a link with `until` (from linkUntil) opens at `now`. */
export function linkOpen(until, now = new Date()) {
  if (until === null || until === undefined) return false
  return until === '' || now.toISOString().slice(0, 10) <= until
}
