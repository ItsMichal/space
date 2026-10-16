// Side-by-side montages (live left, new right, 2x nearest-neighbour zoom of a 240x160 corner) and a texture-strength number
// (median 8x8-block luma standard deviation, the local variation that is left once the soft wash is ignored) for the crops
// written by backdrop-tooth-crops.mjs. Usage: node scripts/backdrop-tooth-compare.mjs <dir> <liveprefix> <newprefix>
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const sharp = require('sharp')
const [dir, a, b] = process.argv.slice(2)
const names = []
for (const k of ['light', 'dark']) for (const n of ['1440x1', '1440x2', '375x3', '375x3-ios-scrolled']) names.push(`${n}-${k}`)
const blockStd = async (file) => {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true })
  const sds = []
  for (let y = 0; y + 8 <= info.height; y += 8) {
    for (let x = 0; x + 8 <= info.width; x += 8) {
      let s = 0, s2 = 0
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const v = data[(y + j) * info.width + x + i]; s += v; s2 += v * v }
      const m = s / 64
      sds.push(Math.sqrt(Math.max(0, s2 / 64 - m * m)))
    }
  }
  sds.sort((p, q) => p - q)
  return sds[sds.length >> 1]
}
for (const n of names) {
  const fa = path.join(dir, `${a}-${n}.png`)
  const fb = path.join(dir, `${b}-${n}.png`)
  const sa = await blockStd(fa)
  const sb = await blockStd(fb)
  console.log(`${n}: ${a} ${sa.toFixed(2)}  ${b} ${sb.toFixed(2)}  (x${(sb / Math.max(sa, 0.01)).toFixed(1)})`)
  const ma = await sharp(fa).metadata()
  const w = Math.min(240, ma.width)
  const h = Math.min(160, ma.height)
  const crop = async (f) => sharp(f).extract({ left: 0, top: 0, width: w, height: h }).resize(w * 2, h * 2, { kernel: 'nearest' }).png().toBuffer()
  await sharp({ create: { width: w * 4 + 8, height: h * 2, channels: 3, background: '#888' } })
    .composite([{ input: await crop(fa), left: 0, top: 0 }, { input: await crop(fb), left: w * 2 + 8, top: 0 }])
    .png()
    .toFile(path.join(dir, `compare-${n}.png`))
}
