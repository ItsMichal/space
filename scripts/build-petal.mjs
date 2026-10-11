// One-off: cut a petal out of the owner's cherry-blossom photo into public/motion/petal.png (transparent, feathered).
// Run: node scripts/build-petal.mjs
import sharp from 'sharp'
import fs from 'node:fs'

const SRC = 'assets-src/botanical/own/cherry-blossom.jpg'
const box = { left: 1085, top: 1075, width: 190, height: 150 }
fs.mkdirSync('public/motion', { recursive: true })
const { data, info } = await sharp(SRC)
  .extract(box)
  .resize(box.width * 3)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const { width: W, height: H } = info
const mask = new Uint8Array(W * H)
for (let i = 0; i < W * H; i++) {
  const r = data[i * 3]
  const g = data[i * 3 + 1]
  const pink = r - g // petal is soft pink, background grey (about 0), stamens deep red (> 80)
  mask[i] = (i % W) > W * 0.24 && pink > 22 && pink < 60 && r > 185 && data[i * 3 + 2] > g + 2 ? 255 : 0
}
// keep the largest connected component
const lab = new Int32Array(W * H)
let best = 0
let bestN = 0
let n = 0
for (let s = 0; s < W * H; s++) {
  if (!mask[s] || lab[s]) continue
  n++
  const st = [s]
  lab[s] = n
  let c = 0
  while (st.length) {
    const p = st.pop()
    c++
    const x = p % W
    const y = (p / W) | 0
    for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
      if (q >= 0 && mask[q] && !lab[q]) {
        lab[q] = n
        st.push(q)
      }
    }
  }
  if (c > bestN) {
    bestN = c
    best = n
  }
}
const m = Buffer.alloc(W * H)
for (let i = 0; i < W * H; i++) m[i] = lab[i] === best ? 255 : 0
const alpha = await sharp(m, { raw: { width: W, height: H, channels: 1 } }).median(13).blur(2).linear(1.5, -60).toColourspace("b-w").raw().toBuffer()
// round the hard left cut: multiply by a soft ellipse fitted to the component's bounding box
let x0 = W, x1 = 0, y0 = H, y1 = 0
for (let i = 0; i < W * H; i++) if (alpha[i] > 128) { const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2 * 1.08, ry = (y1 - y0) / 2 * 1.08
for (let i = 0; i < W * H; i++) {
  const d = Math.hypot(((i % W) - cx) / rx, (((i / W) | 0) - cy) / ry)
  const k = Math.min(1, Math.max(0, (1 - d) / 0.18))
  alpha[i] = Math.round(alpha[i] * k * k * (3 - 2 * k))
}
const rgba = Buffer.alloc(W * H * 4)
for (let i = 0; i < W * H; i++) {
  rgba[i * 4] = data[i * 3]
  rgba[i * 4 + 1] = data[i * 3 + 1]
  rgba[i * 4 + 2] = data[i * 3 + 2]
  rgba[i * 4 + 3] = alpha[i]
}
await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
  .trim({ threshold: 5 })
  .resize({ width: 240 })
  .png({ compressionLevel: 9 })
  .toFile('public/motion/petal.png')
console.log('petal written', bestN)
