// Compares two snapshots (scripts/parity/snapshot.mjs) and writes a report.
//   node scripts/parity/diff.mjs <golden-dir> <candidate-dir> [--out report.md] [--allow allow.json]
// Differences listed in the allow file (url pattern + field) are reported as "intentional" with their reason instead of failing.
import fs from 'node:fs'
import path from 'node:path'
import { readJson } from './lib.mjs'

const args = process.argv.slice(2)
const [goldDir, candDir] = args
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const out = opt('--out')
const allowFile = opt('--allow')
const allow = allowFile && fs.existsSync(allowFile) ? readJson(allowFile) : []
const gold = readJson(path.join(goldDir, 'index.json')).index
const cand = readJson(path.join(candDir, 'index.json')).index

const diffs = [] // { url, field, gold, cand }
const add = (url, field, g, c) => diffs.push({ url, field, gold: g, cand: c })
const j = (v) => JSON.stringify(v)
const same = (a, b) => j(a) === j(b)

function setDiff(url, field, a, b) {
  const sa = new Set(a), sb = new Set(b)
  const only = (x, y) => [...x].filter((v) => !y.has(v))
  const oa = only(sa, sb), ob = only(sb, sa)
  if (oa.length || ob.length) add(url, field, oa, ob)
}
function listDiff(url, field, a, b) {
  if (a.length !== b.length || a.some((v, i) => j(v) !== j(b[i]))) {
    const n = Math.max(a.length, b.length)
    for (let i = 0; i < n; i++) if (j(a[i]) !== j(b[i])) return add(url, `${field}[${i}] (len ${a.length} vs ${b.length})`, a[i], b[i])
  }
}

for (const url of Object.keys(gold)) {
  const g = gold[url], c = cand[url]
  if (!c) { add(url, 'missing in candidate', g.status, undefined); continue }
  if (g.error || c.error) { if (g.error !== c.error) add(url, 'error', g.error, c.error); continue }
  if (g.status !== c.status) add(url, 'status', g.status, c.status)
  for (const h of ['content-type', 'location', 'x-robots-tag', 'cache-class']) {
    if (g.headers[h] !== c.headers[h]) add(url, `header ${h}`, g.headers[h], c.headers[h])
  }
  if (g.kind === 'ref' || g.kind === 'redirect' || g.kind === 'missing' || g.kind === 'slash' || g.kind === 'worker') {
    if (g.status === 200 && g.hash !== c.hash && !/\.(png|jpg|pdf)$/.test(url) && !url.includes('image')) add(url, 'body hash', g.hash, c.hash)
    else if (g.status === 200 && g.hash !== c.hash) add(url, 'binary body hash', g.hash, c.hash)
  }
  if (g.facts && c.facts) {
    const a = g.facts, b = c.facts
    if (a.title !== b.title) add(url, 'title', a.title, b.title)
    if (!same(a.htmlAttrs, b.htmlAttrs)) add(url, 'html attrs', a.htmlAttrs, b.htmlAttrs)
    if (!same(a.bodyAttrs, b.bodyAttrs)) add(url, 'body attrs', a.bodyAttrs, b.bodyAttrs)
    setDiff(url, 'meta', a.metas, b.metas)
    setDiff(url, 'head link', a.links, b.links)
    if (!same(a.jsonLd, b.jsonLd)) add(url, 'json-ld', a.jsonLd, b.jsonLd)
    listDiff(url, 'heading', a.outline, b.outline)
    listDiff(url, 'anchor', a.anchors, b.anchors)
    listDiff(url, 'img', a.imgs, b.imgs)
    listDiff(url, 'picture source', a.sources, b.sources)
    if (a.mainText !== b.mainText) {
      let i = 0
      while (i < a.mainText.length && a.mainText[i] === b.mainText[i]) i++
      add(url, `main text (first diff at char ${i})`, a.mainText.slice(Math.max(0, i - 40), i + 80), b.mainText.slice(Math.max(0, i - 40), i + 80))
    }
  }
  if (g.body && c.body) {
    const ga = fs.readFileSync(path.join(goldDir, 'bodies', g.body), 'utf8')
    const ca = fs.readFileSync(path.join(candDir, 'bodies', c.body), 'utf8')
    const n = (s) => s.replace(/\r\n/g, '\n').trimEnd()
    if (n(ga) !== n(ca)) {
      let i = 0
      while (i < ga.length && ga[i] === ca[i]) i++
      add(url, `text body (first diff at ${i})`, ga.slice(Math.max(0, i - 40), i + 80), ca.slice(Math.max(0, i - 40), i + 80))
    }
  }
}
for (const url of Object.keys(cand)) if (!gold[url]) add(url, 'extra in candidate', undefined, cand[url].status)

const rx = (p) => new RegExp(p)
const intentional = [], unexplained = []
for (const d of diffs) {
  const rule = allow.find((r) => rx(r.url).test(d.url) && d.field.startsWith(r.field))
  if (rule) intentional.push({ ...d, why: rule.why })
  else unexplained.push(d)
}

const trunc = (v) => {
  const s = typeof v === 'string' ? v : j(v)
  return s === undefined ? 'undefined' : s.length > 200 ? s.slice(0, 200) + '...' : s
}
const lines = []
lines.push(`# Parity report`, '', `golden: ${goldDir}`, `candidate: ${candDir}`, '')
lines.push(`urls compared: ${Object.keys(gold).length}; unexplained differences: ${unexplained.length}; intentional: ${intentional.length}`, '')
const group = (list) => {
  const m = new Map()
  for (const d of list) {
    const k = d.field.replace(/\[\d+\].*/, '').replace(/ \(.*/, '')
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m].sort((x, y) => y[1] - x[1])
}
lines.push('## Unexplained, by field', '', ...group(unexplained).map(([k, n]) => `- ${k}: ${n}`), '')
lines.push('## Intentional, by field', '', ...group(intentional).map(([k, n]) => `- ${k}: ${n}`), '')
lines.push('## Unexplained details', '')
for (const d of unexplained) lines.push(`- \`${d.url}\` ${d.field}\n  - golden: ${trunc(d.gold)}\n  - candidate: ${trunc(d.cand)}`)
lines.push('', '## Intentional details', '')
for (const d of intentional) lines.push(`- \`${d.url}\` ${d.field}: ${d.why}`)
const text = lines.join('\n') + '\n'
if (out) fs.writeFileSync(out, text)
console.log(text.split('\n').slice(0, 30).join('\n'))
process.exitCode = unexplained.length ? 1 : 0
