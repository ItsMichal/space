// Builds the hero portrait texture: public/globe/portrait.webp, a small greyscale + alpha image (the only portrait file in the repo).
// Source photo and matte are NOT committed. Pipeline:
//   1. swift scripts/portrait-matte.swift <photo> <matte.png>      (Apple Vision subject lifting, macOS 14+; no install needed)
//   2. node scripts/build-portrait.mjs <photo> <matte.png>
// Crop: head and shoulders. Luminance gets local contrast (CLAHE) and a gentle S-curve so the face reads at ~100 px wide; alpha is the
// matte, eroded one pixel and feathered a touch to remove the background halo.
import path from 'node:path'
import sharp from 'sharp'

const [photo, matte] = process.argv.slice(2)
if (!photo || !matte) {
  console.error('usage: node scripts/build-portrait.mjs <photo> <matte.png>')
  process.exit(2)
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const W = 384
const H = 512
// 3:4 crop of the 1500x2000 original: x 300..1500, y 200..1800 (head top at about 4%, shoulders to the bottom edge).
const crop = { left: 300, top: 200, width: 1200, height: 1600 }

const base = sharp(photo).extract(crop).resize(W, H, { kernel: 'lanczos3' }).greyscale().normalise({ lower: 2, upper: 98 })
const flat = await base.clone().raw().toBuffer()
const local = await base.clone().clahe({ width: 24, height: 24, maxSlope: 2 }).raw().toBuffer()
// Half plain, half local contrast: the face keeps its softness, eyes / glasses / hairline / jaw still separate.
const grey = Buffer.from(flat.map((v, i) => Math.max(0, Math.min(255, 0.5 * v + 0.5 * local[i]) * 1.08 - 8)))

const alpha = await sharp(matte)
  .extract(crop)
  .resize(W, H, { kernel: 'lanczos3' })
  .greyscale()
  .blur(0.8)
  .linear(1.6, -0.55 * 255 * 0.6)
  .raw()
  .toBuffer()

const rgba = Buffer.alloc(W * H * 4)
for (let i = 0; i < W * H; i++) {
  const v = Math.max(0, Math.min(255, grey[i]))
  rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = v
  rgba[i * 4 + 3] = Math.max(0, Math.min(255, alpha[i]))
}
const out = path.join(root, 'public', 'globe', 'portrait.webp')
const info = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(out)
console.log(`wrote ${out} ${info.width}x${info.height} ${info.size} bytes`)
