// Diff one rectangle of two screenshots (luminance only, so the hook-dependent page tint does not count).
//   node scripts/parity/crop-diff.mjs a.png b.png left top width height
import { createRequire } from 'node:module'
const sharp = createRequire(import.meta.url)('sharp')
const [a, b, l, t, w, h] = process.argv.slice(2)
const region = { left: +l, top: +t, width: +w, height: +h }
const grey = async (f) => sharp(f).extract(region).greyscale().raw().toBuffer()
const [ga, gb] = await Promise.all([grey(a), grey(b)])
let bad = 0, sum = 0
for (let i = 0; i < ga.length; i++) {
  const d = Math.abs(ga[i] - gb[i])
  sum += d
  if (d > 40) bad++
}
console.log(`pixels differing by more than 40/255 in luminance: ${((bad / ga.length) * 100).toFixed(2)}%, mean abs diff ${(sum / ga.length).toFixed(2)}`)
