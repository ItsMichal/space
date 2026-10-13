// Builds the hero portrait texture: public/globe/portrait.webp, 576x768, greyscale + alpha (the only portrait file in the repo).
// Source photo and matte are NOT committed. Pipeline:
//   1. swift scripts/portrait-matte.swift <photo> <matte.png>      (Apple Vision subject lifting, macOS 14+; no install needed)
//   2. node scripts/build-portrait.mjs <photo> <matte.png>
// Tone is baked here, because the shader turns luminance straight into halftone dot coverage (dark = more ink):
//   - unsharp mask first, so glasses, eyes and mouth stay crisp at small sizes
//   - shadows lifted (gamma 0.8) so eye sockets, brows and the jacket never fill in to black
//   - a gentle S-curve afterwards; no CLAHE (it produced halos and a gritty, aged face)
// Alpha is the Vision matte, anti-aliased only (no erosion, no feathering), and the colour under the transparent area is filled from
// the figure's own edge so bilinear sampling never pulls a dark or bright halo in.
import path from 'node:path'
import sharp from 'sharp'

const [photo, matte] = process.argv.slice(2)
if (!photo || !matte) {
  console.error('usage: node scripts/build-portrait.mjs <photo> <matte.png>')
  process.exit(2)
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const W = 576
const H = 768
// 3:4 crop of the 1500x2000 original: x 300..1500, y 200..1800 (head top at about 4%, shoulders to the bottom edge).
const crop = { left: 300, top: 200, width: 1200, height: 1600 }

const L8 = await sharp(photo)
  .extract(crop)
  .resize(W, H, { kernel: 'lanczos3' })
  .greyscale()
  .normalise({ lower: 1, upper: 99 })
  .sharpen({ sigma: 1.2, m1: 1.2, m2: 3.2 })
  .raw()
  .toBuffer()
const A8 = await sharp(matte).extract(crop).resize(W, H, { kernel: 'lanczos3' }).greyscale().blur(0.5).raw().toBuffer()

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const n = W * H
const lum = new Float32Array(n)
const alpha = new Float32Array(n)
// Broad shadows (eye sockets, under the chin, the smile's cheek) are what a blurred copy still sees as dark; thin dark lines (the
// glasses frames, lashes) are not. Lifting by that signal opens the face without washing the frames out.
const blurL = await sharp(L8, { raw: { width: W, height: H, channels: 1 } }).blur(7).raw().toBuffer()
// fine blur: the difference to it is local detail (iris, pupil, lash line, glasses frames, catchlights), boosted in the eye band
const blurF = await sharp(L8, { raw: { width: W, height: H, channels: 1 } }).blur(2.4).raw().toBuffer()
for (let i = 0; i < n; i++) {
  const x = i % W
  const y = (i / W) | 0
  // soft ellipses from the forehead to the chin, and a band across the eyes (positions of the 576x768 crop of the source photo)
  const face = 1 - smooth(0.72, 1.1, Math.hypot((x - 228) / 100, (y - 236) / 128))
  const eyes = 1 - smooth(0.6, 1.2, Math.hypot((x - 228) / 108, (y - 205) / 40))
  const l0 = L8[i] / 255
  const broad = 1 - blurL[i] / 255
  const lifted = l0 + (1 - l0) * (eyes * 0.3 * smooth(0.3, 0.6, broad) + face * 0.2 * smooth(0.25, 0.55, broad))
  // eyes look at the viewer: small dark accents without darkening the sockets (the broad lift above keeps those open)
  const l1 = lifted + Math.max(-0.3, Math.min(0.12, l0 - blurF[i] / 255)) * (eyes * 1.4 + face * 0.4)
  // face lighter than everything else (gamma 0.58 inside, 0.82 outside so hair, jacket and hoodie keep their own tones)
  const l = Math.pow(Math.max(0, l1), 0.82 - 0.14 * face)
  lum[i] = Math.max(0, Math.min(1, l * 0.45 + smooth(0, 1, l) * 0.55))
  alpha[i] = smooth(0.35, 0.65, A8[i] / 255)
}
// fill colour outside the matte from the nearest figure pixels (large blur of premultiplied luminance over blurred alpha)
const pre = Buffer.alloc(n)
const aBuf = Buffer.alloc(n)
for (let i = 0; i < n; i++) {
  pre[i] = Math.round(lum[i] * alpha[i] * 255)
  aBuf[i] = Math.round(alpha[i] * 255)
}
const blurPre = await sharp(pre, { raw: { width: W, height: H, channels: 1 } }).blur(14).raw().toBuffer()
const blurA = await sharp(aBuf, { raw: { width: W, height: H, channels: 1 } }).blur(14).raw().toBuffer()
const rgba = Buffer.alloc(n * 4)
for (let i = 0; i < n; i++) {
  const fill = blurA[i] > 2 ? blurPre[i] / blurA[i] : 0.85
  const v = alpha[i] > 0.02 ? lum[i] * Math.min(1, alpha[i] * 4) + fill * (1 - Math.min(1, alpha[i] * 4)) : fill
  const g = Math.round(Math.max(0, Math.min(1, v)) * 255)
  rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = g
  rgba[i * 4 + 3] = Math.round(alpha[i] * 255)
}
const out = path.join(root, 'public', 'globe', 'portrait.webp')
const info = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 82, alphaQuality: 100, effort: 6 }).toFile(out)
console.log(`wrote ${out} ${info.width}x${info.height} ${info.size} bytes`)
