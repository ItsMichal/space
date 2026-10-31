// Content rules: the one definition of what a post file and a media file may contain. Posts and media are untrusted input (they
// live in the ItsMichal/space-content repo, which the hosted editor can write to), so the same rules run in four places:
//   - space-content CI (its validate check runs scripts/content/validate.mjs from a checkout of ItsMichal/space main, so a pull
//     request there cannot change the rules it is checked against)
//   - the space build (prebuild runs scripts/content/validate.mjs), which refuses to build content that breaks them
//   - the renderer (lib/content/render.tsx drops anything unsafe that got this far)
//   - the hosted editor's Worker (space-content editor/write/worker/repo.ts, built on top of this app), before it commits or
//     opens a pull request
// Plain JavaScript with no dependencies, so it runs from scripts and from the Worker alike. Types: rules.d.mts.

/* ------------------------------------------------------------------ limits */

export const LIMITS = {
  postBytes: 256 * 1024,
  mediaBytes: 20 * 1024 * 1024,
  title: 200,
  description: 1000,
  shortText: 300,
  tags: 30,
  tag: 48,
  links: 20,
  gallery: 60,
  url: 2048,
}

/* ------------------------------------------------------------------- slugs */

/** The rules of scripts/check-slugs.mjs: lowercase ASCII words joined by single hyphens, at most 60 characters. */
export const STRICT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function slugProblem(slug) {
  if (typeof slug !== 'string' || !STRICT_SLUG_RE.test(slug)) return `slug "${slug}" must be lowercase a-z, 0-9 and single hyphens`
  if (slug.length > 60) return `slug "${slug}" is ${slug.length} characters (max 60)`
  return null
}

/* ------------------------------------------------------------------ dashes */

// The dash guard of scripts/check-dashes.mjs (a test keeps the two in step). Built from char codes so this file passes the guard itself.
const EM = String.fromCharCode(0x2014)
const EN = String.fromCharCode(0x2013)
const AMP = '&'
export const DASH_RE = new RegExp(`[${EN}${EM}]|${AMP}mdash;|${AMP}ndash;|${AMP}#8212;|${AMP}#8211;|\\\\u201[34]|\\\\u\\{201[34]\\}`, 'i')

/** Lines (1-based) that would fail `npm run check:dashes`. */
export function dashLines(text) {
  return text.split('\n').flatMap((t, i) => (DASH_RE.test(t) ? [{ line: i + 1, text: t.trim().slice(0, 120) }] : []))
}

/* -------------------------------------------------------------------- URLs */

// Browsers drop ASCII whitespace and control characters inside a scheme ("java\tscript:"), so they are removed before looking at it.
const strip = (url) => String(url).replace(/[\u0000- \u007f]+/g, '')
const schemeOf = (url) => /^([a-z][a-z0-9+.-]*):/i.exec(strip(url))?.[1]?.toLowerCase() ?? null

/** Link targets: http(s), mailto, or relative (a path, a fragment or a query). Never javascript:, data:, vbscript:, file: and friends. */
export function safeHref(url) {
  if (typeof url !== 'string' || !url.trim() || url.length > LIMITS.url) return false
  const scheme = schemeOf(url)
  if (scheme === null) return !strip(url).startsWith('\\') // "\\evil.com" is a host in some browsers
  return scheme === 'http' || scheme === 'https' || scheme === 'mailto'
}

/**
 * Image sources in a post body: a path on this site (media, or a site asset like /logo.svg; the media rules keep SVG out of
 * content) or http(s). No data: URIs (none are used, and they hide content from review).
 */
export function safeImageSrc(url) {
  if (typeof url !== 'string' || !url.trim() || url.length > LIMITS.url) return false
  if (url.startsWith('/media/')) return mediaPathOk(url)
  if (url.startsWith('/')) return /^\/[A-Za-z0-9_][A-Za-z0-9._/-]*$/.test(url) && !url.split('/').includes('..')
  const scheme = schemeOf(url)
  return scheme === 'http' || scheme === 'https'
}

/** A /media/... path with plain segments: no "..", no backslashes, no query, nothing hidden. */
export function mediaPathOk(p) {
  return typeof p === 'string' && /^\/media\/(?:[A-Za-z0-9_][A-Za-z0-9._-]*\/)*[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(p) && !p.split('/').includes('..')
}

/** Hosts an ::embed may frame. Everything else is dropped by the renderer and refused by the validator. */
export const EMBED_HOSTS = [
  'www.youtube-nocookie.com',
  'www.youtube.com',
  'player.vimeo.com',
  'codepen.io',
  'open.spotify.com',
  'embed.figma.com',
  'www.figma.com',
  // IANA reserved; the sample post (hello-paper) uses it.
  'example.com',
]

export function embedUrlOk(url) {
  if (typeof url !== 'string' || url.length > LIMITS.url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && EMBED_HOSTS.includes(u.hostname)
  } catch {
    return false
  }
}

export const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{6,20}$/
export const CALLOUT_TYPES = ['note', 'tip', 'warning', 'before', 'ask']
export const RATIO_RE = /^\d{1,3}(?:\.\d{1,3})?\s*\/\s*\d{1,3}(?:\.\d{1,3})?$/

/** The only directives a post may use, with the attributes each one keeps. */
export const DIRECTIVES = {
  youtube: ['id', 'title'],
  embed: ['url', 'title', 'ratio'],
  callout: ['type'],
  handwriting: ['src', 'alt', 'duration', 'blur', 'chroma', 'stagger', 'focus', 'ease', 'color'],
}

/**
 * ::handwriting{src alt ...}: the owner's pen strokes (a .ink.json media file, see parseInk) drawn on with a blur-to-sharp
 * chromatic focus. Numbers are clamped into these ranges; anything that is not a plain decimal is dropped (the player's default).
 * duration: seconds the pen takes to write everything (default: the recorded pace, clamped); blur and chroma: starting blur and
 * RGB split in px; stagger: multiplier on the recorded pauses between strokes; focus: seconds a stroke takes to sharpen.
 */
export const HANDWRITING = {
  duration: [0.3, 30],
  blur: [0, 24],
  chroma: [0, 16],
  stagger: [0, 2],
  focus: [0.1, 6],
  ease: ['out', 'in-out', 'linear', 'expo'],
  color: ['ink', 'accent'],
}
export const HANDWRITING_SRC_RE = /^\/media\/[a-z0-9]+(?:-[a-z0-9]+)*\/[A-Za-z0-9_][A-Za-z0-9_-]{0,100}\.ink\.json$/
const DECIMAL_RE = /^\s*-?\d{1,6}(?:\.\d{1,6})?\s*$/

/** A clamped handwriting number as a canonical string, or null when the value is not a plain decimal. */
export function handwritingNumber(key, value) {
  const range = HANDWRITING[key]
  if (!range || typeof value !== 'string' || !DECIMAL_RE.test(value)) return null
  const v = Math.min(range[1], Math.max(range[0], Number(value)))
  return String(Math.round(v * 100) / 100)
}

/** The attributes of one directive after the allowlist, or null when the directive must be dropped. */
export function directiveAttrs(name, attrs) {
  const keep = DIRECTIVES[name]
  if (!keep) return null
  const out = {}
  for (const k of keep) if (attrs && typeof attrs[k] === 'string') out[k] = attrs[k].slice(0, LIMITS.shortText)
  if (name === 'youtube' && !YOUTUBE_ID_RE.test(out.id ?? '')) return null
  if (name === 'embed') {
    if (!embedUrlOk(out.url)) return null
    if (out.ratio && !RATIO_RE.test(out.ratio)) delete out.ratio
  }
  if (name === 'callout' && out.type && !CALLOUT_TYPES.includes(out.type)) out.type = 'note'
  if (name === 'handwriting') {
    if (!HANDWRITING_SRC_RE.test(out.src ?? '') || !mediaPathOk(out.src)) return null
    out.alt = (out.alt ?? '').trim()
    if (!out.alt) return null
    for (const k of ['duration', 'blur', 'chroma', 'stagger', 'focus']) {
      if (out[k] === undefined) continue
      const n = handwritingNumber(k, out[k])
      if (n === null) delete out[k]
      else out[k] = n
    }
    if (out.ease !== undefined && !HANDWRITING.ease.includes(out.ease)) delete out.ease
    if (out.color !== undefined && !HANDWRITING.color.includes(out.color)) delete out.color
  }
  return out
}

/* -------------------------------------------------------------- ink files */

/**
 * A handwriting file, media/<slug>/<name>.ink.json. Plain numbers under fixed keys, nothing else:
 *   { "version": 1, "width": 640, "height": 240, "size": 3.5, "pressure": false, "strokes": [[x, y, t, ...], ...] }
 * width and height are the viewBox; size is the pen width in viewBox units; each stroke is a flat list of points, x y t
 * (t in whole ms since the first point, never going back) or x y t p when pressure is true (p from 0 to 1).
 */
export const INK = {
  bytes: 256 * 1024,
  side: [16, 4096],
  size: [0.25, 64],
  strokes: 400,
  points: 4000,
  totalPoints: 20000,
  time: 600000,
}
export const INK_NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,100}\.ink\.json$/
const INK_KEYS = new Set(['version', 'width', 'height', 'size', 'pressure', 'strokes'])
const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype
const inRange = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi

/** Parse and check an ink file. Returns { ink } (a fresh copy holding only the checked fields) or { problem }. */
export function parseInk(input) {
  let text = input
  if (input instanceof Uint8Array) {
    if (input.length > INK.bytes) return { problem: `larger than ${INK.bytes / 1024} KB` }
    // Printable ASCII and JSON whitespace only: numbers, the fixed keys and punctuation need nothing else.
    for (const b of input) if (!(b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e))) return { problem: 'not plain ASCII JSON' }
    text = new TextDecoder().decode(input)
  }
  if (typeof text !== 'string') return { problem: 'not text' }
  if (text.length > INK.bytes) return { problem: `larger than ${INK.bytes / 1024} KB` }
  let raw
  try {
    raw = JSON.parse(text)
  } catch {
    return { problem: 'not valid JSON' }
  }
  if (!isPlainObject(raw)) return { problem: 'must be a JSON object' }
  for (const k of Object.keys(raw)) if (!INK_KEYS.has(k)) return { problem: `unknown key "${k.slice(0, 20)}"` }
  if (raw.version !== 1) return { problem: 'version must be 1' }
  for (const k of ['width', 'height']) if (!Number.isInteger(raw[k]) || !inRange(raw[k], INK.side[0], INK.side[1])) return { problem: `${k} must be a whole number from ${INK.side[0]} to ${INK.side[1]}` }
  if (!inRange(raw.size, INK.size[0], INK.size[1])) return { problem: `size must be a number from ${INK.size[0]} to ${INK.size[1]}` }
  if (raw.pressure !== undefined && typeof raw.pressure !== 'boolean') return { problem: 'pressure must be true or false' }
  const pressure = raw.pressure === true
  const stride = pressure ? 4 : 3
  if (!Array.isArray(raw.strokes) || raw.strokes.length < 1 || raw.strokes.length > INK.strokes) return { problem: `strokes must be a list of 1 to ${INK.strokes} strokes` }
  const strokes = []
  let total = 0
  let last = 0
  for (const [si, s] of raw.strokes.entries()) {
    if (!Array.isArray(s) || s.length < stride || s.length % stride !== 0 || s.length / stride > INK.points) return { problem: `stroke ${si + 1} must be a flat list of 1 to ${INK.points} points of ${stride} numbers` }
    total += s.length / stride
    if (total > INK.totalPoints) return { problem: `more than ${INK.totalPoints} points` }
    for (let i = 0; i < s.length; i += stride) {
      if (!inRange(s[i], 0, raw.width) || !inRange(s[i + 1], 0, raw.height)) return { problem: `stroke ${si + 1} has a point outside the ${raw.width} x ${raw.height} box` }
      const t = s[i + 2]
      if (!Number.isInteger(t) || !inRange(t, last, INK.time)) return { problem: `stroke ${si + 1}: times must be whole ms from 0 to ${INK.time} that never go back` }
      last = t
      if (pressure && !inRange(s[i + 3], 0, 1)) return { problem: `stroke ${si + 1}: pressure must be from 0 to 1` }
    }
    strokes.push(s.slice())
  }
  return { ink: { version: 1, width: raw.width, height: raw.height, size: raw.size, pressure, strokes } }
}

/** Problem with an ink file's bytes or text, or null. */
export function inkProblem(input) {
  return parseInk(input).problem ?? null
}

/* ------------------------------------------------------------ front matter */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const isStr = (v) => typeof v === 'string'
const tooLong = (v, n) => isStr(v) && v.length > n

/**
 * Front matter of a post file named `<id>.md`, already normalised by frontmatterFromData (lib/content/serialize.ts).
 * Returns the first problem, or null. Whether `parent` exists is up to the caller.
 */
export function frontmatterProblem(id, fm) {
  if (!fm || typeof fm !== 'object') return 'front matter is missing'
  if (!isStr(fm.title)) return 'title is required'
  if (fm.slug !== id) return 'slug differs from the file; use rename to change it'
  if (fm.kind !== 'project' && fm.kind !== 'article') return 'kind must be project or article'
  if (!isStr(fm.date) || !ISO_DATE.test(fm.date)) return 'date must be yyyy-mm-dd'
  if (fm.updated && !ISO_DATE.test(fm.updated)) return 'updated must be yyyy-mm-dd'
  if (!Array.isArray(fm.tags)) return 'tags must be a list'
  if (fm.cover && !mediaPathOk(fm.cover)) return 'cover must live under /media/'
  if (fm.cardImage && fm.cardImage !== 'none' && !mediaPathOk(fm.cardImage)) return 'cardImage must live under /media/ (or be "none")'
  if (fm.parent && (!/^[a-z0-9-]+$/.test(fm.parent) || fm.parent === id)) return 'parent must be the slug of another project'
  for (const g of fm.gallery ?? []) if (!mediaPathOk(g.src)) return 'gallery images must live under /media/'
  if (tooLong(fm.title, LIMITS.title)) return `title is longer than ${LIMITS.title} characters`
  if (tooLong(fm.description, LIMITS.description)) return `description is longer than ${LIMITS.description} characters`
  if (fm.tags.length > LIMITS.tags || fm.tags.some((t) => !isStr(t) || t.length > LIMITS.tag)) return `at most ${LIMITS.tags} tags of ${LIMITS.tag} characters`
  for (const k of ['coverAlt', 'coverFocus', 'cardImageAlt', 'series', 'role', 'years', 'hook']) if (tooLong(fm[k], LIMITS.shortText)) return `${k} is too long`
  if (fm.coverFocus && !/^[0-9.%a-z ]+$/i.test(fm.coverFocus)) return 'coverFocus must be a CSS position like "50% 30%"'
  if ((fm.links ?? []).length > LIMITS.links) return `at most ${LIMITS.links} links`
  for (const l of fm.links ?? []) {
    if (!safeHref(l.href)) return `link "${String(l.label).slice(0, 40)}" must be http(s), mailto or a site path`
    if (tooLong(l.label, LIMITS.shortText)) return 'link label is too long'
  }
  if ((fm.gallery ?? []).length > LIMITS.gallery) return `at most ${LIMITS.gallery} gallery images`
  for (const k of ['canonical', 'originalUrl']) {
    if (fm[k] && !['http', 'https'].includes(schemeOf(fm[k]))) return `${k} must be an http(s) URL`
    if (tooLong(fm[k], LIMITS.url)) return `${k} is too long`
  }
  for (const p of fm.publications ?? []) if (!/^[a-z0-9-]{1,80}$/.test(p)) return 'publications must be ids'
  return null
}

/* -------------------------------------------------------------------- body */

/** Each line of a markdown body outside fenced code, with its 1-based number. */
function proseLines(body) {
  const out = []
  let fence = null
  body.split('\n').forEach((line, i) => {
    const f = /^\s*(`{3,}|~{3,})/.exec(line)
    if (f) {
      if (!fence) fence = f[1][0]
      else if (f[1][0] === fence) fence = null
      return
    }
    if (!fence) out.push({ line, n: i + 1 })
  })
  return out
}

/** A leaf or container directive at the start of a line: its name and attributes (quoted or bare values). */
function directiveOf(line) {
  const d = /^\s*:{2,}([A-Za-z][\w-]*)(?:\[[^\]]*\])?(?:\{([^}]*)\})?/.exec(line)
  if (!d) return null
  const attrs = Object.fromEntries([...(d[2] ?? '').matchAll(/([\w-]+)=(?:"([^"]*)"|'([^']*)'|([^\s"'}]+))/g)].map((m) => [m[1], m[2] ?? m[3] ?? m[4]]))
  return { name: d[1], attrs }
}

const MISSING = { embed: 'url (https on an allowed host)', handwriting: 'src (/media/<slug>/<name>.ink.json) or alt text', youtube: 'id' }

/**
 * Problems in a markdown body that the renderer would silently drop: unknown or broken directives and unsafe link or image targets.
 * Line based and conservative (fenced code is skipped); the renderer is the backstop.
 */
export function bodyProblems(body) {
  const out = []
  for (const { line, n } of proseLines(body)) {
    const at = `line ${n}`
    const d = directiveOf(line)
    if (d) {
      if (!DIRECTIVES[d.name]) out.push(`${at}: unknown directive ::${d.name} (allowed: ${Object.keys(DIRECTIVES).join(', ')})`)
      else if (!directiveAttrs(d.name, d.attrs)) out.push(`${at}: ::${d.name} has a missing or disallowed ${MISSING[d.name] ?? 'attribute'}`)
    }
    for (const m of line.matchAll(/(!?)\[[^\]]*\]\(\s*<?([^)\s>]+)/g)) {
      const ok = m[1] ? safeImageSrc(m[2]) : safeHref(m[2])
      if (!ok) out.push(`${at}: unsafe ${m[1] ? 'image source' : 'link'} "${m[2].slice(0, 60)}"`)
    }
    for (const m of line.matchAll(/^\s*\[[^\]]+\]:\s*<?(\S+?)>?(?:\s|$)/g)) if (!safeHref(m[1])) out.push(`${at}: unsafe link definition "${m[1].slice(0, 60)}"`)
  }
  return out
}

/** The ink files a body's ::handwriting directives point at (valid ones only), with their line numbers. */
export function handwritingSources(body) {
  const out = []
  for (const { line, n } of proseLines(body)) {
    const d = directiveOf(line)
    const attrs = d?.name === 'handwriting' ? directiveAttrs('handwriting', d.attrs) : null
    if (attrs) out.push({ line: n, src: attrs.src })
  }
  return out
}

/* ------------------------------------------------------------------- media */

/** Accepted media types, by extension, each checked against the file's first bytes. No SVG: it can carry script. */
export const MEDIA_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  mp4: 'video/mp4',
  webm: 'video/webm',
}

/** Type of a media file from its first bytes (never from its name). */
export function sniffMedia(b) {
  const ascii = (from, to) => String.fromCharCode(...b.subarray(from, to))
  if (b.length < 12) return null
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (ascii(0, 4) === 'GIF8') return 'gif'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp'
  if (ascii(4, 8) === 'ftyp') return /^avi[fs]$/.test(ascii(8, 12)) ? 'avif' : 'mp4'
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm'
  return null
}

export const MEDIA_NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,120}$/

/** Problem with one media file at media/<dir>/<name>, or null. */
export function mediaProblem(dir, name, bytes) {
  if (!/^[a-z0-9-]+$/.test(dir)) return `media folder "${dir}" is not a slug`
  if (!MEDIA_NAME_RE.test(name) || name.includes('..')) return `media file name "${name}" has characters outside A-Z, a-z, 0-9, dot, dash and underscore`
  if (/\.ink\.json$/i.test(name)) {
    if (!INK_NAME_RE.test(name)) return `handwriting file "${name}" must be named <name>.ink.json`
    const p = inkProblem(bytes)
    return p ? `handwriting file "${name}": ${p}` : null
  }
  const ext = name.split('.').pop().toLowerCase()
  if (!MEDIA_TYPES[ext]) return `media file "${name}": .${ext} is not an accepted type (${Object.keys(MEDIA_TYPES).join(', ')})`
  if (bytes.length > LIMITS.mediaBytes) return `media file "${name}" is larger than ${LIMITS.mediaBytes / 1024 / 1024} MB`
  const sniffed = sniffMedia(bytes)
  const norm = (e) => (e === 'jpeg' ? 'jpg' : e)
  if (!sniffed || norm(ext) !== sniffed) return `media file "${name}" is not a real .${ext} (its bytes say ${sniffed ?? 'unknown'})`
  return null
}

/* ---------------------------------------------------------------- raw text */

/** gray-matter options that only ever parse YAML: its JavaScript engine evals the front matter ("---js"), which content must never reach. */
const refuse = () => {
  throw new Error('only YAML front matter is accepted')
}
export const SAFE_MATTER = { engines: { javascript: refuse, js: refuse, coffee: refuse, coffeescript: refuse, cson: refuse } }

/** Raw post text checks that come before parsing: size and the front matter language. */
export function rawPostProblem(raw) {
  if (typeof raw !== 'string') return 'not text'
  if (new TextEncoder().encode(raw).length > LIMITS.postBytes) return `post is larger than ${LIMITS.postBytes / 1024} KB`
  if (/^﻿?---[^\S\n]*\S/.test(raw)) return 'front matter must be plain YAML ("---" on its own line)'
  if (raw.includes('\u0000')) return 'post contains a NUL byte'
  return null
}

/* ------------------------------------------------------------- site layout */

/**
 * The site layout file (`site/layout.json` in space-content, `content/layout.json` here): card order and presentation on the
 * home page and /projects, set from the editor's Arrange screen. Untrusted like a post. Exactly these keys, nothing else:
 *   version  1
 *   work     project slugs, in order: they lead Projects (home) and /projects; other projects follow in the usual order
 *   writing  article slugs, in order: they lead the home Writing list
 *   hooks    slugs of posts with a `hook`, in order: they lead the hero's rotating "I've built ..." line
 *   cards    { <project slug>: { size, variant, focus, home } }, every field optional:
 *              size     "feature" (full width, image beside the text) or "regular"; unset: the first card is the feature
 *              variant  regular cards: "newsroom" (image on top), "fill" (text above, image fills) or "cap" (image with a
 *                       caption over it); the feature card has its own look
 *              focus    the card image's focal point, "<x>% <y>%" with whole numbers from 0 to 100
 *              home     false keeps the project off the home page (it stays on /projects)
 */
export const LAYOUT = {
  bytes: 32 * 1024,
  list: 200,
  cards: 300,
  size: ['feature', 'regular'],
  variant: ['newsroom', 'fill', 'cap'],
}
const LAYOUT_KEYS = new Set(['version', 'work', 'writing', 'hooks', 'cards'])
const CARD_KEYS = new Set(['size', 'variant', 'focus', 'home'])
export const FOCUS_RE = /^(?:100|[1-9]?[0-9])% (?:100|[1-9]?[0-9])%$/
const layoutSlug = (v) => typeof v === 'string' && v.length <= 80 && STRICT_SLUG_RE.test(v)
const quoted = (v) => JSON.stringify(String(v).slice(0, 40))

/** Parse and check a layout file. Returns { layout } (a fresh copy holding only the checked fields) or { problem }. */
export function parseLayout(input) {
  let text = input
  if (input instanceof Uint8Array) {
    if (input.length > LAYOUT.bytes) return { problem: `larger than ${LAYOUT.bytes / 1024} KB` }
    text = new TextDecoder().decode(input)
  }
  if (typeof text !== 'string') return { problem: 'not text' }
  if (text.length > LAYOUT.bytes) return { problem: `larger than ${LAYOUT.bytes / 1024} KB` }
  // Slugs, enums, numbers and punctuation need nothing beyond printable ASCII.
  if (/[^\t\n\r\x20-\x7e]/.test(text)) return { problem: 'not plain ASCII JSON' }
  let raw
  try {
    raw = JSON.parse(text)
  } catch {
    return { problem: 'not valid JSON' }
  }
  if (!isPlainObject(raw)) return { problem: 'must be a JSON object' }
  for (const k of Object.keys(raw)) if (!LAYOUT_KEYS.has(k)) return { problem: `unknown key ${quoted(k)}` }
  if (raw.version !== 1) return { problem: 'version must be 1' }
  const layout = { version: 1 }
  for (const k of ['work', 'writing', 'hooks']) {
    if (raw[k] === undefined) continue
    const list = raw[k]
    if (!Array.isArray(list) || list.length > LAYOUT.list) return { problem: `${k} must be a list of at most ${LAYOUT.list} slugs` }
    const seen = new Set()
    for (const s of list) {
      if (!layoutSlug(s)) return { problem: `${k}: ${quoted(s)} is not a slug` }
      if (seen.has(s)) return { problem: `${k}: "${s}" is listed twice` }
      seen.add(s)
    }
    layout[k] = list.slice()
  }
  if (raw.cards !== undefined) {
    if (!isPlainObject(raw.cards)) return { problem: 'cards must be an object keyed by project slug' }
    const keys = Object.keys(raw.cards)
    if (keys.length > LAYOUT.cards) return { problem: `at most ${LAYOUT.cards} cards` }
    const cards = {}
    for (const slug of keys) {
      if (!layoutSlug(slug)) return { problem: `cards: ${quoted(slug)} is not a slug` }
      const c = raw.cards[slug]
      if (!isPlainObject(c)) return { problem: `cards.${slug} must be an object` }
      for (const k of Object.keys(c)) if (!CARD_KEYS.has(k)) return { problem: `cards.${slug}: unknown key ${quoted(k)}` }
      const card = {}
      if (c.size !== undefined) {
        if (!LAYOUT.size.includes(c.size)) return { problem: `cards.${slug}.size must be one of ${LAYOUT.size.join(', ')}` }
        card.size = c.size
      }
      if (c.variant !== undefined) {
        if (!LAYOUT.variant.includes(c.variant)) return { problem: `cards.${slug}.variant must be one of ${LAYOUT.variant.join(', ')}` }
        card.variant = c.variant
      }
      if (c.focus !== undefined) {
        if (typeof c.focus !== 'string' || !FOCUS_RE.test(c.focus)) return { problem: `cards.${slug}.focus must look like "50% 30%" (whole numbers 0 to 100)` }
        card.focus = c.focus
      }
      if (c.home !== undefined) {
        if (typeof c.home !== 'boolean') return { problem: `cards.${slug}.home must be true or false` }
        card.home = c.home
      }
      cards[slug] = card
    }
    layout.cards = cards
  }
  return { layout }
}

/** Problem with a layout file's bytes or text, or null. */
export function layoutProblem(input) {
  return parseLayout(input).problem ?? null
}

/**
 * Problems with what a parsed layout points at, given every post as { slug, kind, parent, hook }: `work` and `cards` name
 * top-level projects, `writing` top-level articles, `hooks` posts that set a hook. A stale slug (a post renamed or removed)
 * is a problem, so the layout is fixed in the same pull request.
 */
export function layoutRefProblems(layout, posts) {
  const by = new Map(posts.map((p) => [p.slug, p]))
  const problems = []
  const want = (key, slug, ok, what) => {
    const p = by.get(slug)
    if (!p) problems.push(`${key}: no post "${slug}"`)
    else if (!ok(p)) problems.push(`${key}: "${slug}" is not ${what}`)
  }
  const topProject = (p) => p.kind === 'project' && !p.parent
  for (const s of layout.work ?? []) want('work', s, topProject, 'a top-level project')
  for (const s of layout.writing ?? []) want('writing', s, (p) => p.kind === 'article' && !p.parent, 'a top-level article')
  for (const s of layout.hooks ?? []) want('hooks', s, (p) => Boolean(p.hook), 'a post with a hook')
  for (const s of Object.keys(layout.cards ?? {})) want('cards', s, topProject, 'a top-level project')
  return problems
}
