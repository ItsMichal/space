// One-off: recut the petal texture. The pixels are the owner's own cherry-blossom photograph (a clean stretch of one
// petal, veins and all, with no stamens or background); the silhouette is a hand-drawn sakura petal (ovate, narrow at
// the base, a small notch at the tip), so there is no threshold ragged edge and no hard cut.
// Run: node scripts/build-petal.mjs      Preview: node scripts/preview-petal.mjs out.png
import sharp from 'sharp'
import fs from 'node:fs'
// Paths below are relative to the app root; make that true whatever directory the script is launched from.
process.chdir(new URL('..', import.meta.url).pathname)

const SRC = 'assets-src/botanical/own/cherry-blossom.jpg'
const W = 240
const H = 270
// Source pixels: the lower-left petal of the large open flower (pink, evenly lit, veined).
const crop = { left: 1118, top: 474, width: 60, height: 70 }
fs.mkdirSync('public/motion', { recursive: true })

const tex = await sharp(SRC)
  .extract(crop)
  .resize(W, H, { fit: 'fill', kernel: 'lanczos3' })
  .modulate({ brightness: 1.2, saturation: 0.82 })
  .blur(0.6)
  .removeAlpha()
  .toBuffer()

// Petal outline with a gentle asymmetry (one shoulder a touch fuller) so no two edges mirror.
const outline =
  'M121 268C116 242 60 198 43 134C30 76 62 22 105 17C113 17 118 27 120 40C124 24 135 13 148 16C190 24 214 78 199 136C184 196 128 242 121 268Z'
const mask = await sharp(
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><path d="${outline}" fill="#fff"/></svg>`
  )
)
  .blur(1.4)
  .greyscale()
  .raw()
  .toBuffer()

// Soft translucency toward the rim (thin petal tissue lets light through), and a faint deeper tone at the base.
const raw = await sharp(tex).raw().toBuffer()
const rgba = Buffer.alloc(W * H * 4)
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x
    const a = mask[i]
    const base = Math.max(0, (y / H - 0.72) / 0.28)
    rgba[i * 4] = Math.min(255, raw[i * 3] - base * 6)
    rgba[i * 4 + 1] = Math.max(0, raw[i * 3 + 1] - base * 16)
    rgba[i * 4 + 2] = Math.max(0, raw[i * 3 + 2] - base * 10)
    rgba[i * 4 + 3] = a
  }
}
await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile('public/motion/petal.png')
console.log('petal written', W, H)
