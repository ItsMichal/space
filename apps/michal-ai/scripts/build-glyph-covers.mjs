// Header art for articles: each article cover's subject as a glyph grid (@space/glyph-art), written to lib/glyph/covers.json keyed
// by cover path. macOS only (Vision lifts the subject) and run by hand after content:pull when an article cover changes; the
// output is committed. A cover with no clear subject gets no entry, and its article keeps the photo header.
//
//   node scripts/build-glyph-covers.mjs
import fs from 'node:fs'
import path from 'node:path'
import { glyphGrid } from '@space/glyph-art/generate'
process.chdir(new URL('..', import.meta.url).pathname)

const OUT = 'lib/glyph/covers.json'
const out = {}
for (const f of fs.readdirSync('content/posts').filter((f) => f.endsWith('.md')).sort()) {
  const head = fs.readFileSync(path.join('content/posts', f), 'utf8').split('\n---')[0]
  const kind = /^kind:\s*(\S+)/m.exec(head)?.[1]
  const cover = /^cover:\s*(\S+)/m.exec(head)?.[1]
  if (kind !== 'article' || !cover || !fs.existsSync('public' + cover)) continue
  const grid = await glyphGrid('public' + cover)
  console.log(grid ? `${cover}: ${grid.w} x ${grid.h}` : `${cover}: no subject`)
  if (grid) out[cover] = grid
}
fs.writeFileSync(OUT, JSON.stringify(out) + '\n')
console.log(`${OUT}: ${Object.keys(out).length} covers`)
