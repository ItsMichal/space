#!/usr/bin/env node
// Dash guard for michal.ai: no em dash (U+2014) and no en dash (U+2013), written literally, as an HTML entity or as a \u escape,
// anywhere in what the portfolio ships (source strings, metadata, JSON-LD, feeds, content/profile.ts, content/posts/*.md,
// public text files). Separators are the middle dot; ranges are "to" or a plain hyphen.
// Exceptions (citation page ranges the publisher prints with an en dash) are listed in scripts/dash-allowlist.txt as
//   <path relative to repo root> :: <text that must appear on the offending line>
// Run from anywhere: node scripts/check-dashes.mjs   (also: npm run check:dashes, part of npm run check)
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const app = path.join(root, 'apps', 'michal-ai')
const SCAN = ['app', 'components', 'lib', 'content', 'worker', 'public', 'site.config.ts']
const SKIP_DIRS = new Set(['node_modules', '.next', 'build', '.react-router', '.parity', '.open-next', '.wrangler', 'dist', '_v', 'medium-src', 'botanical', 'globe', 'textures', 'icons'])
const TEXT = /\.(html?|css|js|mjs|cjs|jsx|ts|tsx|json|md|mdx|txt|xml|svg|webmanifest|csv)$/i
const SKIP_FILES = new Set(['lib/media/manifest.json'])
const DASH = /[–—]|&mdash;|&ndash;|&#8212;|&#8211;|\\u201[34]|\\u\{201[34]\}/i

const allow = fs
  .readFileSync(path.join(root, 'scripts', 'dash-allowlist.txt'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => l.split('::').map((s) => s.trim()))

function* walk(p) {
  if (!fs.existsSync(p)) return
  const st = fs.statSync(p)
  if (st.isFile()) {
    if (TEXT.test(p)) yield p
    return
  }
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    if (e.isDirectory() && SKIP_DIRS.has(e.name)) continue
    yield* walk(path.join(p, e.name))
  }
}

let bad = 0
for (const s of SCAN) {
  for (const f of walk(path.join(app, s))) {
    const rel = path.relative(root, f).split(path.sep).join('/')
    if (SKIP_FILES.has(path.relative(app, f).split(path.sep).join('/'))) continue
    fs.readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (!DASH.test(line)) return
        if (allow.some(([p, text]) => p === rel && line.includes(text))) return
        bad++
        console.error(`${rel}:${i + 1}: dash: ${line.trim().slice(0, 120)}`)
      })
  }
}
if (bad) {
  console.error(`\n${bad} line(s) with an em or en dash. Use a comma, colon, period, "to", a hyphen or the middle dot; or list a citation range in scripts/dash-allowlist.txt.`)
  process.exit(1)
}
console.log('check-dashes: ok')
