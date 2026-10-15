// Pixel-diffs two screenshot directories made by shots.mjs.
//   node scripts/parity/shotdiff.mjs <golden-dir> <candidate-dir> [--threshold 0.5] [--out diff-dir]
// Per file: percentage of pixels whose channel difference exceeds 16/255. Fails above --threshold percent (default 0.5).
// Differently sized pages report the height difference and compare the overlapping rows.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')
const args = process.argv.slice(2)
const [g, c] = args
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d)
const threshold = Number(opt('--threshold', '0.5'))
const outDir = opt('--out')
if (outDir) fs.mkdirSync(outDir, { recursive: true })

let fail = 0
const rows = []
for (const f of fs.readdirSync(g).filter((x) => x.endsWith('.png')).sort()) {
  const pb = path.join(c, f)
  if (!fs.existsSync(pb)) { rows.push(`${f}: MISSING in candidate`); fail++; continue }
  const A = sharp(path.join(g, f)).ensureAlpha(), B = sharp(pb).ensureAlpha()
  const [ma, mb] = [await A.metadata(), await B.metadata()]
  const w = Math.min(ma.width, mb.width), h = Math.min(ma.height, mb.height)
  const ra = await sharp(path.join(g, f)).extract({ left: 0, top: 0, width: w, height: h }).ensureAlpha().raw().toBuffer()
  const rb = await sharp(pb).extract({ left: 0, top: 0, width: w, height: h }).ensureAlpha().raw().toBuffer()
  let bad = 0
  const diff = outDir ? Buffer.alloc(w * h * 4) : undefined
  for (let i = 0; i < ra.length; i += 4) {
    const d = Math.max(Math.abs(ra[i] - rb[i]), Math.abs(ra[i + 1] - rb[i + 1]), Math.abs(ra[i + 2] - rb[i + 2]))
    if (d > 16) {
      bad++
      if (diff) { diff[i] = 255; diff[i + 3] = 255 }
    } else if (diff) { diff[i] = ra[i] >> 1; diff[i + 1] = ra[i + 1] >> 1; diff[i + 2] = ra[i + 2] >> 1; diff[i + 3] = 255 }
  }
  const pct = (bad / (w * h)) * 100
  const sizeNote = ma.height !== mb.height || ma.width !== mb.width ? ` size ${ma.width}x${ma.height} vs ${mb.width}x${mb.height}` : ''
  const bad_ = pct > threshold || sizeNote !== ''
  if (bad_) fail++
  rows.push(`${bad_ ? 'DIFF' : 'ok  '} ${f}: ${pct.toFixed(3)}% pixels differ${sizeNote}`)
  if (diff && bad) await sharp(diff, { raw: { width: w, height: h, channels: 4 } }).png().toFile(path.join(outDir, f))
}
console.log(rows.join('\n'))
console.log(`\n${rows.length - fail}/${rows.length} within ${threshold}%`)
process.exitCode = fail ? 1 : 0
