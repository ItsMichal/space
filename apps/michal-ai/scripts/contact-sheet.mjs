// Contact sheet: node scripts/contact-sheet.mjs <out.png> <columns> <cell width> <left,top,width,height crop|-> <files...>
import sharp from 'sharp'

const [out, cols, cw, crop, ...files] = process.argv.slice(2)
const C = Number(cols)
const W = Number(cw)
const c = crop === '-' ? null : crop.split(',').map(Number)
const tiles = await Promise.all(
  files.map(async (f) => {
    let img = sharp(f)
    if (c) img = img.extract({ left: c[0], top: c[1], width: c[2], height: c[3] })
    return img.resize(W).png().toBuffer()
  }),
)
const meta = await Promise.all(tiles.map((b) => sharp(b).metadata()))
const H = Math.max(...meta.map((m) => m.height ?? 0))
const rows = Math.ceil(tiles.length / C)
await sharp({ create: { width: C * W + (C - 1) * 6, height: rows * H + (rows - 1) * 6, channels: 3, background: '#777' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % C) * (W + 6), top: Math.floor(i / C) * (H + 6) })))
  .png()
  .toFile(out)
console.log('wrote', out)
