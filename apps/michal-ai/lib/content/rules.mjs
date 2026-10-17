// Content rules: the one definition of what a post file and a media file may contain. Posts and media are untrusted input (they
// live in the ItsMichal/space-content repo, which the hosted editor can write to), so the same rules run in four places:
//   - space-content CI (scripts/validate.mjs there, a copy of scripts/content/validate.mjs here, see scripts/content/make-seed.mjs)
//   - the space build (prebuild runs scripts/content/validate.mjs), which refuses to build content that breaks them
//   - the renderer (lib/content/render.tsx drops anything unsafe that got this far)
//   - the hosted editor's Worker (write/worker/repo.ts), before it commits or opens a pull request
// Plain JavaScript with no dependencies so the content repo can run it without the rest of this app. Types: rules.d.mts.

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
// eslint-disable-next-line no-control-regex
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
export const CALLOUT_TYPES = ['note', 'tip', 'warning']
export const RATIO_RE = /^\d{1,3}(?:\.\d{1,3})?\s*\/\s*\d{1,3}(?:\.\d{1,3})?$/

/** The only directives a post may use, with the attributes each one keeps. */
export const DIRECTIVES = { youtube: ['id', 'title'], embed: ['url', 'title', 'ratio'], callout: ['type'] }

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
  return out
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

/**
 * Problems in a markdown body that the renderer would silently drop: unknown or broken directives and unsafe link or image targets.
 * Line based and conservative (fenced code is skipped); the renderer is the backstop.
 */
export function bodyProblems(body) {
  const out = []
  let fence = null
  body.split('\n').forEach((line, i) => {
    const f = /^\s*(`{3,}|~{3,})/.exec(line)
    if (f) {
      if (!fence) fence = f[1][0]
      else if (f[1][0] === fence) fence = null
      return
    }
    if (fence) return
    const at = `line ${i + 1}`
    const d = /^\s*:{2,}([A-Za-z][\w-]*)(?:\[[^\]]*\])?(?:\{([^}]*)\})?/.exec(line)
    if (d) {
      const attrs = Object.fromEntries([...(d[2] ?? '').matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]))
      if (!DIRECTIVES[d[1]]) out.push(`${at}: unknown directive ::${d[1]} (allowed: ${Object.keys(DIRECTIVES).join(', ')})`)
      else if (!directiveAttrs(d[1], attrs)) out.push(`${at}: ::${d[1]} has a missing or disallowed ${d[1] === 'embed' ? 'url (https on an allowed host)' : 'id'}`)
    }
    for (const m of line.matchAll(/(!?)\[[^\]]*\]\(\s*<?([^)\s>]+)/g)) {
      const ok = m[1] ? safeImageSrc(m[2]) : safeHref(m[2])
      if (!ok) out.push(`${at}: unsafe ${m[1] ? 'image source' : 'link'} "${m[2].slice(0, 60)}"`)
    }
    for (const m of line.matchAll(/^\s*\[[^\]]+\]:\s*<?(\S+?)>?(?:\s|$)/g)) if (!safeHref(m[1])) out.push(`${at}: unsafe link definition "${m[1].slice(0, 60)}"`)
  })
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
