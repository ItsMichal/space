// Refreshes content/citations.json: Semantic Scholar citation counts for every DOI in content/profile.ts and
// content/mentions.ts. One source throughout so the numbers compare. The deploy workflow runs it before every michal.ai
// build (and a weekly scheduled deploy keeps the numbers moving between merges); by hand: npm run citations.
// Never fails the build: a DOI that cannot be fetched keeps its last known count, and asOf only moves when every DOI answered.
import { readFileSync, writeFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const file = new URL('../content/citations.json', import.meta.url)
const prev = JSON.parse(readFileSync(file, 'utf8'))
const dois = [...new Set([...`${read('content/profile.ts')}\n${read('content/mentions.ts')}`.matchAll(/doi: '([^']+)'/g)].map((m) => m[1]))]
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms))

async function count(doi) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`https://api.semanticscholar.org/graph/v1/paper/DOI:${doi}?fields=citationCount`)
      if (r.ok) {
        const n = (await r.json()).citationCount
        if (Number.isInteger(n)) return n
      }
      console.warn(`${doi}: HTTP ${r.status}`)
      if (r.status !== 429 && r.status < 500) return undefined
    } catch (e) {
      console.warn(`${doi}: ${e.message}`)
    }
    await wait(5000 * (attempt + 1)) // rate limited or flaky: back off and retry
  }
  return undefined
}

const counts = {}
let missed = 0
for (const doi of dois) {
  const n = await count(doi)
  if (n === undefined) missed++
  // never let a count go backwards on a bad answer; a missing one keeps the last known value
  const keep = prev.counts?.[doi]
  if (n !== undefined || keep !== undefined) counts[doi] = Math.max(n ?? 0, keep ?? 0)
  await wait(1100) // the public API allows about one request a second
}
const out = { source: 'Semantic Scholar', asOf: missed ? prev.asOf : new Date().toISOString().slice(0, 10), counts }
writeFileSync(file, JSON.stringify(out, null, 2) + '\n')
console.log(missed ? `${missed} of ${dois.length} DOIs kept their last count` : 'all counts fresh', out)
