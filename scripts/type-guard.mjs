// Type-scale guard for michal.ai: running UI and content use the four text sizes (title, heading, body, small) and the hero
// display size, all defined once as tokens (apps/michal-ai/docs/design-system/tokens.json -> app/styles/tokens.css). Nothing
// else may set a font size. This module finds the offenders; scripts/check-type.mjs runs it over the app.
//
// Flagged:
//   CSS / <style> text   font-size: <anything but var(--type-*-size), inherit, initial, unset>
//                        font: <shorthand> whose size part is not var(--type-*-size) (system keywords and `inherit` pass)
//   Tailwind (tsx/ts)    text-[<length or clamp()>] arbitrary sizes, and text-xs|sm|base|lg|xl|2xl..9xl at any breakpoint
//   Inline styles        fontSize: ... and font: '<size>/...' in style objects
// Not flagged: `pt` sizes (print stylesheets keep their own), custom-property definitions (--type-body-size: 18px), the
// generated tokens.css, and anything listed in scripts/type-allowlist.txt (see that file for the format).
import fs from 'node:fs'
import path from 'node:path'

const TOKEN_SIZE = /^var\(--type-[a-z-]+-size\)$/
const KEYWORD = /^(inherit|initial|unset|revert)$/
const SYSTEM_FONT = /^(caption|icon|menu|message-box|small-caption|status-bar|inherit|initial|unset)$/

/** Splits a CSS shorthand `font` value into tokens, keeping function calls like var(--a) / calc(1 + 2) whole. */
function tokenize(value) {
  const out = []
  let cur = ''
  let depth = 0
  for (const ch of value.trim()) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur) out.push(cur)
  return out
}

/** The size part of a `font` shorthand: the token before a `/` or the first length-ish token. */
function shorthandSize(value) {
  const t = tokenize(value.replace(/\s*\/\s*/g, ' / '))
  const slash = t.indexOf('/')
  if (slash > 0) return t[slash - 1]
  return t.find((x) => /^(\d|\.\d|calc\(|clamp\(|min\(|max\(|var\(--type-)/.test(x) && !/^\d{3}$/.test(x) && x !== '1' && x !== '0')
}

const isPt = (v) => /^[\d.]+pt$/.test(v.trim())

/**
 * @param {string} text file contents
 * @returns {{ line: number, text: string, why: string }[]}
 */
export function findViolations(text, { ext = '.css' } = {}) {
  const hits = []
  const lines = text.split('\n')
  lines.forEach((raw, i) => {
    const line = raw.trim()
    const add = (why) => hits.push({ line: i + 1, text: line.slice(0, 140), why })

    // font-size: X
    for (const m of raw.matchAll(/(?:^|[;{\s'"`])font-size\s*:\s*['"`]?([^;}'"`]+)/g)) {
      const v = m[1].replace(/!important/, '').trim()
      if (TOKEN_SIZE.test(v) || KEYWORD.test(v) || isPt(v)) continue
      add(`font-size: ${v}`)
    }
    // font: shorthand (CSS and style strings), not custom properties
    for (const m of raw.matchAll(/(?:^|[;{\s'"`])font\s*:\s*['"`]?([^;}'"`]+)/g)) {
      const v = m[1].replace(/!important/, '').trim()
      if (SYSTEM_FONT.test(v) || !v) continue
      const size = shorthandSize(v)
      if (!size) continue
      if (TOKEN_SIZE.test(size) || isPt(size)) continue
      add(`font: ${v}`)
    }
    if (ext === '.css') return
    // style objects: fontSize: 18 / '18px'
    if (/\bfontSize\s*:/.test(raw)) add('fontSize in a style object')
    // Tailwind arbitrary size and named size utilities
    for (const m of raw.matchAll(/(?:^|[\s"'`{(])((?:[\w-]+:)*)text-\[([^\]]+)\]/g)) {
      const body = m[2]
      if (/^(length|percentage):/.test(body) || /^[\d.]+(px|rem|em|vw|vh|%|pt)?$/.test(body) || /(clamp|calc|min|max)\(/.test(body) || /^\d/.test(body)) add(`text-[${body}]`)
    }
    for (const m of raw.matchAll(/(?:^|[\s"'`{(])((?:[\w-]+:)*)text-(xs|sm|base|lg|xl|[2-9]xl)(?![\w-])/g)) add(`${m[1]}text-${m[2]}`)
  })
  return hits
}

const SKIP_DIRS = new Set(['node_modules', '.next', '.open-next', '.wrangler', '.cache', '.turbo', '.claude', 'dist'])
const EXTS = new Set(['.css', '.ts', '.tsx', '.js', '.jsx', '.mjs'])

/** Parses scripts/type-allowlist.txt: `<path or dir prefix, from repo root>` or `<path> :: <text that must appear on the line>`. */
export function parseAllowlist(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [p, needle] = l.split('::').map((s) => s.trim())
      return { path: p, needle: needle || null }
    })
}

export function isAllowed(rel, lineText, allow) {
  return allow.some((a) => (a.path.endsWith('/') ? rel.startsWith(a.path) : rel === a.path) && (!a.needle || lineText.includes(a.needle)))
}

/** Walks the app source and returns {file, line, text, why}[] for every size outside the scale that is not allowlisted. */
export function scanRepo(root, allow = parseAllowlist(fs.readFileSync(path.join(root, 'scripts', 'type-allowlist.txt'), 'utf8'))) {
  const out = []
  const base = path.join(root, 'apps', 'michal-ai')
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(p)
        continue
      }
      const ext = path.extname(e.name)
      if (!EXTS.has(ext)) continue
      const rel = path.relative(root, p).split(path.sep).join('/')
      const text = fs.readFileSync(p, 'utf8')
      if (text.startsWith('/* GENERATED')) continue
      const lines = text.split('\n')
      for (const h of findViolations(text, { ext })) {
        if (isAllowed(rel, lines[h.line - 1], allow)) continue
        out.push({ file: rel, ...h })
      }
    }
  }
  for (const d of ['app', 'components', 'lib']) if (fs.existsSync(path.join(base, d))) walk(path.join(base, d))
  return out
}
