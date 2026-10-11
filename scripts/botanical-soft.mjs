// Turns licensed flower PHOTOGRAPHS (assets-src/botanical-photo/*.jpg, fetched by scripts/fetch-botanical-photos.py)
// into soft, high-key, pastel images whose edges dissolve into the paper (alpha), for use as BACKGROUND florals:
//   1. crop to the part worth keeping
//   2. wash it toward the paper (lifts blacks to pale sage, keeps hue), reduce saturation slightly
//   3. depth of field: blur grows toward the edge
//   4. feather the silhouette with a wandering, noise-perturbed ellipse so no edge is a clean line
// Output: public/botanical/photo/<id>-<w>.webp|avif, plus a preview on paper in assets-src/botanical-photo/preview.
//
//   node scripts/botanical-soft.mjs [id]
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

// `node scripts/botanical-soft.mjs own [id]` processes the owner's own photographs (scripts/botanical-own.mjs).
if (process.argv[2] === 'own') {
  await import('./botanical-own.mjs')
  process.exit(0)
}

const SRC = 'assets-src/botanical-photo'
const OUT = 'public/botanical/photo'
const PAPER = [248, 246, 239]

// crop = [x, y, w, h] as fractions of the source; wash = how far the image is pulled toward paper (0..1);
// sat = saturation multiplier; ell = ellipse radii as fractions of the crop (the soft silhouette); cx/cy = its centre
const plates = {
  'cosmos-sky': { crop: [0, 0, 1, 0.72], wash: 0.3, sat: 0.62, ell: [0.5, 0.5], blur: 16 },
  'daisies-glow': { crop: [0, 0, 1, 0.92], wash: 0.66, gamma: 0.62, sat: 0.8, ell: [0.5, 0.5], blur: 14 },
  'poppy-pale': { crop: [0.12, 0, 0.88, 0.86], wash: 0.66, gamma: 0.62, sat: 0.85, ell: [0.5, 0.5], blur: 16 },
  'blossom-sky': { crop: [0, 0.04, 1, 0.8], wash: 0.34, sat: 0.8, ell: [0.5, 0.5], blur: 12 },
  'cottongrass-meadow': { crop: [0, 0, 1, 1], wash: 0.58, gamma: 0.7, sat: 0.7, ell: [0.5, 0.5], blur: 12 },
  'cottongrass-glow': { crop: [0.08, 0.04, 0.88, 0.9], wash: 0.64, gamma: 0.66, sat: 0.8, ell: [0.5, 0.5], blur: 16 },
  'lupine-green': { crop: [0.18, 0.08, 0.66, 0.86], wash: 0.42, sat: 0.78, ell: [0.5, 0.5], blur: 14 },
  'avens-white': { crop: [0.08, 0.06, 0.78, 0.8], wash: 0.6, gamma: 0.72, sat: 0.8, ell: [0.5, 0.5], blur: 14 },
  'cosmos-blush': { crop: [0.1, 0.04, 0.8, 0.9], wash: 0.3, sat: 0.7, ell: [0.5, 0.5], blur: 16 },
}
const WIDTHS = [1400, 700]

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

async function noiseField(w, h, seed) {
  // low-frequency value noise: random bytes, blurred, 0..1
  let s = seed
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  const gw = 12
  const gh = Math.max(6, Math.round((12 * h) / w))
  const small = Buffer.alloc(gw * gh)
  for (let i = 0; i < small.length; i++) small[i] = Math.floor(rnd() * 256)
  const big = await sharp(small, { raw: { width: gw, height: gh, channels: 1 } }).resize(w, h, { kernel: 'cubic' }).blur(6).raw().toBuffer({ resolveWithObject: true })
  return big.info.channels === 1 ? big.data : Buffer.from(big.data.filter((_, i) => i % big.info.channels === 0))
}

async function make(id, cfg, seed) {
  const meta = await sharp(path.join(SRC, `${id}.jpg`)).metadata()
  const [fx, fy, fw, fh] = cfg.crop
  const left = Math.round(fx * meta.width)
  const top = Math.round(fy * meta.height)
  const cw = Math.round(fw * meta.width)
  const ch = Math.round(fh * meta.height)
  const W = 1400
  const H = Math.round((W * ch) / cw)
  const base = sharp(path.join(SRC, `${id}.jpg`)).extract({ left, top, width: cw, height: ch }).resize(W, H, { kernel: 'lanczos3' })
  const sharpBuf = await base.clone().removeAlpha().raw().toBuffer()
  const blurBuf = await base.clone().blur(cfg.blur).removeAlpha().raw().toBuffer()
  const noise = await noiseField(W, H, seed)
  const out = Buffer.alloc(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const nx = (x / W - 0.5) / cfg.ell[0]
      const ny = (y / H - 0.5) / cfg.ell[1]
      const r = Math.hypot(nx, ny) + (noise[i] / 255 - 0.5) * 0.24
      const alpha = 1 - smooth(0.5, 1.0, r)
      const dof = smooth(0.35, 0.95, r) // blur weight grows toward the edge
      let rgb = [0, 0, 0]
      for (let c = 0; c < 3; c++) rgb[c] = sharpBuf[i * 3 + c] * (1 - dof) + blurBuf[i * 3 + c] * dof
      const l = 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2]
      for (let c = 0; c < 3; c++) {
        let v = l + (rgb[c] - l) * cfg.sat
        v = 255 * Math.pow(Math.min(255, Math.max(0, v)) / 255, cfg.gamma ?? 1)
        v = v * (1 - cfg.wash) + PAPER[c] * cfg.wash // wash toward paper: darks become pale sage, not black
        out[i * 4 + c] = Math.min(255, Math.max(0, Math.round(v)))
      }
      out[i * 4 + 3] = Math.round(alpha * 255)
    }
  }
  fs.mkdirSync(OUT, { recursive: true })
  fs.mkdirSync(`${SRC}/preview`, { recursive: true })
  const full = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()
  const sizes = []
  for (const w of WIDTHS) {
    const img = sharp(full).resize({ width: w, kernel: 'lanczos3' })
    const webp = await img.clone().webp({ quality: 78, alphaQuality: 85, effort: 5 }).toBuffer()
    const avif = await img.clone().avif({ quality: 50, effort: 5 }).toBuffer()
    fs.writeFileSync(path.join(OUT, `${id}-${w}.webp`), webp)
    fs.writeFileSync(path.join(OUT, `${id}-${w}.avif`), avif)
    sizes.push({ w, h: Math.round((w * H) / W), webp: webp.length, avif: avif.length })
  }
  const flat = await sharp({ create: { width: W, height: H, channels: 3, background: { r: 248, g: 246, b: 239 } } }).composite([{ input: full }]).png().toBuffer()
  await sharp(flat).resize({ width: 800 }).jpeg({ quality: 86 }).toFile(`${SRC}/preview/${id}.jpg`)
  console.log(JSON.stringify({ id, aspect: +(W / H).toFixed(4), sizes }))
}

const only = process.argv[2]
let seed = 7
for (const [id, cfg] of Object.entries(plates)) {
  seed += 13
  if (!only || only === id) await make(id, cfg, seed)
}
