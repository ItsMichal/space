// Refreshes content/citations.json: Semantic Scholar citation counts for every DOI in content/profile.ts and
// content/mentions.ts. One source throughout so the numbers compare; run by hand (npm run citations) and commit the result.
import { readFileSync, writeFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const dois = [...new Set([...`${read('content/profile.ts')}\n${read('content/mentions.ts')}`.matchAll(/doi: '([^']+)'/g)].map((m) => m[1]))]
const counts = {}
for (const doi of dois) {
  const r = await fetch(`https://api.semanticscholar.org/graph/v1/paper/DOI:${doi}?fields=citationCount`)
  if (!r.ok) {
    console.warn(`${doi}: ${r.status}, skipped`)
    continue
  }
  counts[doi] = (await r.json()).citationCount
  await new Promise((ok) => setTimeout(ok, 1100)) // the public API allows about one request a second
}
const out = { source: 'Semantic Scholar', asOf: new Date().toISOString().slice(0, 10), counts }
writeFileSync(new URL('../content/citations.json', import.meta.url), JSON.stringify(out, null, 2) + '\n')
console.log(out)
