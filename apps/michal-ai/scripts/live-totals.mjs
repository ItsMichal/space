// Prints views and reactions for every live post as JSON: [{ id, views, reactions, reactionsTotal }].
//
//   node scripts/live-totals.mjs [baseUrl]        default https://michal.ai
//
// It reads the same public endpoint the page uses (GET /api/live/reactions?id=...), one request per post (edge-cached for
// 30 s), so it needs no secret and there is no admin route. `views` is null while the Worker var VIEWS_PUBLIC is "0"; in
// that case read the number in the Cloudflare dashboard (Workers & Pages > Durable Objects > ReactionsRoom, SQL: select n
// from c where target = '~' and emoji = 'views'), or set VIEWS_PUBLIC back to "1".
import fs from 'node:fs'
import path from 'node:path'

const base = (process.argv[2] ?? 'https://michal.ai').replace(/\/$/, '')
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const src = fs.readFileSync(path.join(root, 'lib', 'presence', 'slugs.generated.ts'), 'utf8')
const ids = JSON.parse(/LIVE_IDS[^=]*=\s*(\[[\s\S]*?\])/.exec(src)[1])

const rows = []
for (const id of ids) {
  try {
    const r = await fetch(`${base}/api/live/reactions?id=${encodeURIComponent(id)}`)
    if (r.status === 204) {
      console.error('Live features are switched off (LIVE_KILL=1): nothing to read.')
      process.exit(2)
    }
    if (r.status !== 200) {
      rows.push({ id, error: r.status })
      continue
    }
    const d = await r.json()
    const reactions = d.post ?? {}
    rows.push({ id, views: d.views ?? null, reactions, reactionsTotal: Object.values(reactions).reduce((a, b) => a + b, 0) })
  } catch (e) {
    rows.push({ id, error: String(e) })
  }
}
rows.sort((a, b) => (b.views ?? -1) - (a.views ?? -1))
console.log(JSON.stringify(rows, null, 2))
