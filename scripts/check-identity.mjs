#!/usr/bin/env node
// Content-identity guard.
//
//   HARD (exit 1): nothing that ships on halmic.com may contain the owner's real name or the portfolio domain.
//     Scanned: everything under apps/halmic (source, content, public files, build output such as dist/ and
//     .open-next/) EXCEPT docs/, README*, node_modules, .wrangler, caches. Patterns: scripts/identity-denylist.txt.
//     Exception, by construction: the logo switcher and the paired-content links (packages/crosslinks) may print the portfolio
//     domain, only in the exact strings, files and counts built by scripts/identity-lib.mjs. Anything else still fails.
//   SOFT (warning only): the portfolio's shipped copy/metadata mentioning "halmic". Allowlist:
//     scripts/identity-allowlist.txt. The tie between the two identities is accepted; this just keeps the
//     portfolio from advertising it by accident.
//
// Run from anywhere: node scripts/check-identity.mjs   (also: npm run check:identity)
import fs from 'node:fs'
import path from 'node:path'
import { readMichalPosts } from '../packages/crosslinks/src/node.mjs'
import { halmicAllowances, scanContent } from './identity-lib.mjs'

const root = path.resolve(import.meta.dirname, '..')
const rel = (p) => path.relative(root, p).split(path.sep).join('/')

const readLines = (f) =>
  fs
    .readFileSync(path.join(root, 'scripts', f), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))

const SKIP_DIRS = new Set(['node_modules', '.git', '.wrangler', '.next', '.turbo', '.cache', 'docs'])
const TEXT_EXT = /\.(html?|css|js|mjs|cjs|jsx|ts|tsx|json|jsonc|md|mdx|txt|xml|svg|webmanifest|toml|ya?ml|map|csv)$/i

function* walk(dir, { skip = SKIP_DIRS, skipFile = () => false } = {}) {
  if (!fs.existsSync(dir)) return
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!skip.has(e.name)) yield* walk(p, { skip, skipFile })
    } else if (e.isFile() && TEXT_EXT.test(e.name) && !skipFile(p)) yield p
  }
}

const globToRe = (g) =>
  new RegExp(
    '^' +
      g
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*\//g, '\u0000')
        .replace(/\*\*/g, '\u0001')
        .replace(/\*/g, '[^/]*')
        .replace(/\u0000/g, '(?:.*/)?')
        .replace(/\u0001/g, '.*') +
      '$'
  )

function scan(files, patterns, allowancesFor = () => []) {
  const hits = []
  for (const f of files) {
    for (const h of scanContent(fs.readFileSync(f, 'utf8'), patterns, allowancesFor(rel(f)))) hits.push({ file: rel(f), ...h })
  }
  return hits
}

let failed = false

// --- hard check: apps/halmic ---
const halmicDir = path.join(root, 'apps', 'halmic')
const deny = readLines('identity-denylist.txt').map((p) => new RegExp(p, 'i'))
const isReadme = (p) => /^README(\..*)?$/i.test(path.basename(p))
// The halmic sync script keeps its own copy of the denylist (it must contain the patterns it blocks); it is never served.
const EXEMPT = new Set(['apps/halmic/content/identity-denylist.txt'])
const posts = readMichalPosts(root)
const hard = scan(walk(halmicDir, { skipFile: (p) => isReadme(p) || EXEMPT.has(rel(p)) }), deny, (r) => halmicAllowances(r, posts))
if (hard.length) {
  failed = true
  console.error(`FAIL: ${hard.length} real-name/portfolio reference(s) in apps/halmic:`)
  for (const h of hard.slice(0, 50)) console.error(`  ${h.file}:${h.line}  matched "${h.match}"`)
} else {
  console.log(`ok: apps/halmic is clean (${fs.existsSync(halmicDir) ? 'scanned' : 'not present yet'})`)
}

// --- soft check: portfolio mentions of the handle ---
const portfolio = path.join(root, 'apps', 'michal-ai')
const allow = readLines('identity-allowlist.txt').map(globToRe)
const shippedRoots = ['app', 'components', 'content', 'lib', 'public', 'site.config.ts']
const files = []
for (const r of shippedRoots) {
  const p = path.join(portfolio, r)
  if (!fs.existsSync(p)) continue
  if (fs.statSync(p).isDirectory()) files.push(...walk(p, { skip: new Set([...SKIP_DIRS].filter((d) => d !== 'docs')) }))
  else files.push(p)
}
const soft = scan(
  files.filter((f) => !allow.some((re) => re.test(rel(f)))),
  [/halmic/i]
)
if (soft.length) {
  console.warn(`warn: ${soft.length} mention(s) of "halmic" in apps/michal-ai shipped files (not allowlisted):`)
  for (const h of soft.slice(0, 20)) console.warn(`  ${h.file}:${h.line}`)
} else {
  console.log('ok: apps/michal-ai does not advertise the handle')
}

process.exit(failed ? 1 : 0)
