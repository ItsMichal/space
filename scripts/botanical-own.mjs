// The owner's own flower photographs (assets-src/botanical/own/*.jpg) into soft, warm background florals with alpha.
// Run via `node scripts/botanical-soft.mjs own [id]`.
//
// Per plate:
//   1. crop (+ optional mirror) and resize to 1400px wide
//   2. suppress branches / dark ground: pixels that are dark (and, for the cherry, desaturated brown) are replaced by a
//      normalized-convolution blur of their non-dark neighbours, so branches dissolve into the pink haze around them
//   3. soften (a little blur), lift and warm: gamma, desaturate slightly, tint warm, wash toward the paper
//   4. alpha: a colour key (keep blossom, drop grey sky and road) or a wandering noise ellipse, softened with a wide blur
//   5. colour under the alpha is pre-mixed with the paper so mip-mapped / blurred sampling never fringes grey
// Output: public/botanical/own/<id>-<1400|700>.<webp|avif> and a preview on paper in assets-src/botanical/own/preview/.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const SRC = 'assets-src/botanical/own'
const OUT = 'public/botanical/own'
const PAPER = [247, 242, 232] // warm: a little more cream than the site paper so washes read sunlit, not grey
const WARM = [1.025, 1.0, 0.955] // gentle warm tint

const plates = {
  // pink blossom cloud, mirrored so the dense side sits toward the page corner; branches dissolved, grey sky and road keyed out
  // Wikimedia Commons featured picture (CC BY 4.0, W.carter; see public/botanical/CREDITS.md): three pink sakura blossoms in soft
  // lavender-pink bokeh. Crop to the blossoms and the bokeh to their right, lift the dark leaves and branch toward blush.
  // (The owner's own cherry photo, cherry-blossom.jpg, did not survive branch removal without going muddy; see docs.)
  'cherry-bloom': {
    dir: 'assets-src/botanical/wikimedia',
    file: 'three-pink-cherry-blossoms-tuntorp.jpg',
    crop: [0.27, 0.02, 0.5, 0.8],
    flop: true,
    dark: { lo: 85, hi: 140, sat: 0.6 },
    blush: { lo: 50, hi: 150, k: 0.7, color: [241, 206, 215] },
    fill: 30,
    soft: 1.6,
    gamma: 0.8,
    sat: 0.95,
    wash: 0.2,
    key: null,
    alphaBlur: 0,
    ell: [0.6, 0.58],
  },
  // lavender hydrangea with green and yellow bokeh: a whole soft haze, no key; darkest greens and maroon lifted
  hydrangea: {
    file: 'hydrangea.jpg',
    crop: [0, 0, 1, 1],
    dark: { lo: 30, hi: 80, sat: 1 },
    fill: 40,
    soft: 5,
    gamma: 0.78,
    sat: 0.9,
    wash: 0.42,
    key: null,
    alphaBlur: 0,
    ell: [0.5, 0.5],
  },
  // red and yellow lily, heavily washed to a warm peach-gold accent; only the flower is kept
  'daylily-wash': {
    file: 'daylily.jpg',
    crop: [0, 0.12, 1, 0.66],
    dark: { lo: 40, hi: 90, sat: 1 },
    fill: 30,
    soft: 3.5,
    gamma: 0.72,
    sat: 0.78,
    wash: 0.5,
    key: { kind: 'warm', lo: 0.3, hi: 0.55, grow: 1.2 },
    alphaBlur: 28,
    ell: [0.5, 0.5],
  },
}
const WIDTHS = [1400, 700]
const W = 1400

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Separable box blur (3 passes ~ gaussian), radius r px, on interleaved Float32 data. */
function blur(src, w, h, ch, r) {
  if (r < 1) return Float32Array.from(src)
  let a = Float32Array.from(src)
  let b = new Float32Array(a.length)
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      for (let c = 0; c < ch; c++) {
        let sum = 0
        const row = y * w
        for (let x = -r; x <= r; x++) sum += a[(row + Math.min(w - 1, Math.max(0, x))) * ch + c]
        for (let x = 0; x < w; x++) {
          b[(row + x) * ch + c] = sum / (2 * r + 1)
          sum += a[(row + Math.min(w - 1, x + r + 1)) * ch + c] - a[(row + Math.max(0, x - r)) * ch + c]
        }
      }
    }
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < ch; c++) {
        let sum = 0
        for (let y = -r; y <= r; y++) sum += b[(Math.min(h - 1, Math.max(0, y)) * w + x) * ch + c]
        for (let y = 0; y < h; y++) {
          a[(y * w + x) * ch + c] = sum / (2 * r + 1)
          sum += b[(Math.min(h - 1, y + r + 1) * w + x) * ch + c] - b[(Math.max(0, y - r) * w + x) * ch + c]
        }
      }
    }
  }
  return a
}

function noiseField(w, h, seed) {
  let s = seed
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
  const gw = 10
  const gh = Math.max(5, Math.round((10 * h) / w))
  const g = new Float32Array(gw * gh).map(() => rnd())
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const fx = (x / w) * (gw - 1)
      const fy = (y / h) * (gh - 1)
      const x0 = Math.floor(fx)
      const y0 = Math.floor(fy)
      const tx = fx - x0
      const ty = fy - y0
      const sx = tx * tx * (3 - 2 * tx)
      const sy = ty * ty * (3 - 2 * ty)
      const x1 = Math.min(gw - 1, x0 + 1)
      const y1 = Math.min(gh - 1, y0 + 1)
      out[y * w + x] =
        (g[y0 * gw + x0] * (1 - sx) + g[y0 * gw + x1] * sx) * (1 - sy) + (g[y1 * gw + x0] * (1 - sx) + g[y1 * gw + x1] * sx) * sy
    }
  return out
}

async function make(id, cfg, seed) {
  const file = path.join(cfg.dir ?? SRC, cfg.file)
  const meta = await sharp(file).metadata()
  const [fx, fy, fw, fh] = cfg.crop
  const cw = Math.round(fw * meta.width)
  const ch = Math.round(fh * meta.height)
  const H = Math.round((W * ch) / cw)
  let img = sharp(file).extract({ left: Math.round(fx * meta.width), top: Math.round(fy * meta.height), width: cw, height: ch })
  if (cfg.flop) img = img.flop()
  const raw = await img.resize(W, H, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer()
  const N = W * H
  const rgb = new Float32Array(N * 3)
  for (let i = 0; i < N * 3; i++) rgb[i] = raw[i]

  // 2. suppress branches / dark ground
  if (cfg.blush) {
    // Cherry: no inpainting (it turns calyxes into blobs). Anything dark, branch or crimson calyx alike, is simply lifted to a
    // blush, in proportion to how dark it is, so the cluster reads as soft pink and white blossom.
    for (let i = 0; i < N; i++) {
      const l = 0.299 * rgb[i * 3] + 0.587 * rgb[i * 3 + 1] + 0.114 * rgb[i * 3 + 2]
      const d = Math.pow(1 - smooth(cfg.blush.lo, cfg.blush.hi, l), 0.85) * cfg.blush.k
      for (let c = 0; c < 3; c++) rgb[i * 3 + c] = rgb[i * 3 + c] * (1 - d) + cfg.blush.color[c] * d
    }
  }
  if (!cfg.blush) {
  const lum = new Float32Array(N)
  const bad = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2]
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    const l = 0.299 * r + 0.587 * g + 0.114 * b
    lum[i] = l
    const sat = mx > 0 ? (mx - mn) / mx : 0
    bad[i] = (1 - smooth(cfg.dark.lo, cfg.dark.hi, l)) * (1 - smooth(cfg.dark.sat, cfg.dark.sat + 0.15, sat))
  }
  const badGrown = blur(bad, W, H, 1, 8)
  for (let i = 0; i < N; i++) badGrown[i] = Math.min(1, badGrown[i] * 3)
  const wgt = new Float32Array(N)
  const premul = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    wgt[i] = 1 - smooth(0, 0.2, badGrown[i]) // any real branch contribution is cut to zero, or its tiny residual weight would dominate far-fill averages
    for (let c = 0; c < 3; c++) premul[i * 3 + c] = rgb[i * 3 + c] * wgt[i]
  }
  const bp = blur(premul, W, H, 3, cfg.fill)
  const bw = blur(wgt, W, H, 1, cfg.fill)
  // second, much wider pass so the middle of a thick branch still gets a colour from far-away good pixels
  const bp2 = blur(premul, W, H, 3, cfg.fill * 4)
  const bw2 = blur(wgt, W, H, 1, cfg.fill * 4)
  for (let i = 0; i < N; i++) {
    const m = badGrown[i]
    for (let c = 0; c < 3; c++) {
      const den = bw[i] + bw2[i] * 0.02
      const fill = den > 1e-4 ? (bp[i * 3 + c] + bp2[i * 3 + c] * 0.02) / den : PAPER[c]
      rgb[i * 3 + c] = rgb[i * 3 + c] * (1 - m) + fill * m
    }
  }

  }
  // 3. soften, lift, warm, wash
  const tmp = Buffer.alloc(N * 3)
  for (let i = 0; i < N * 3; i++) tmp[i] = Math.round(Math.min(255, Math.max(0, rgb[i])))
  if (process.env.DEBUG_FILL) await sharp(tmp, { raw: { width: W, height: H, channels: 3 } }).jpeg().toFile(`/tmp/claude/${id}-fill.jpg`)
  const soft = await sharp(tmp, { raw: { width: W, height: H, channels: 3 } }).blur(cfg.soft).raw().toBuffer()
  const col = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const r = soft[i * 3], g = soft[i * 3 + 1], b = soft[i * 3 + 2]
    const l = 0.3 * r + 0.59 * g + 0.11 * b
    for (let c = 0; c < 3; c++) {
      let v = l + ([r, g, b][c] - l) * cfg.sat
      v = 255 * Math.pow(Math.min(255, Math.max(0, v)) / 255, cfg.gamma)
      v *= WARM[c]
      col[i * 3 + c] = Math.min(255, v * (1 - cfg.wash) + PAPER[c] * cfg.wash)
    }
  }

  // 4. alpha
  const nz = noiseField(W, H, seed)
  let alpha = new Float32Array(N)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const r = Math.hypot((x / W - 0.5) / cfg.ell[0], (y / H - 0.5) / cfg.ell[1]) + (nz[i] - 0.5) * 0.3
      let a = 1 - smooth(0.55, 1.0, r)
      if (cfg.key) {
        const R = raw[i * 3], G = raw[i * 3 + 1], B = raw[i * 3 + 2] // key from the original pixels, so filled-in branches do not punch holes
        const mx = Math.max(R, G, B), mn = Math.min(R, G, B)
        const sat = mx > 0 ? (mx - mn) / mx : 0
        const k = cfg.key.kind === 'pink' ? (R - G) / 255 : sat * (R >= G ? 1 : 0.2)
        a *= smooth(cfg.key.lo, cfg.key.hi, k)
      }
      alpha[i] = a
    }
  if (cfg.alphaBlur) {
    if (cfg.close) {
      // morphological close: gaps inside the cluster (sky showing through) get covered so the haze has no cut-out holes
      const wide = blur(alpha, W, H, 1, cfg.close)
      for (let i = 0; i < N; i++) alpha[i] = Math.max(alpha[i], Math.min(1, wide[i] * 2.4) * 0.8)
    }
    alpha = blur(alpha, W, H, 1, cfg.alphaBlur)
    const g = cfg.key?.grow ?? 1
    for (let i = 0; i < N; i++) alpha[i] = Math.min(1, smooth(0.0, 0.9, alpha[i] * g))
  }

  // 5. pre-mix colour with paper under the alpha
  const out = Buffer.alloc(N * 4)
  for (let i = 0; i < N; i++) {
    const a = alpha[i]
    const k = Math.min(1, a * 2)
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(PAPER[c] * (1 - k) + col[i * 3 + c] * k)
    out[i * 4 + 3] = Math.round(a * 255)
  }

  fs.mkdirSync(OUT, { recursive: true })
  fs.mkdirSync(`${SRC}/preview`, { recursive: true })
  const full = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()
  const sizes = []
  for (const w of WIDTHS) {
    const s = sharp(full).resize({ width: w, kernel: 'lanczos3' })
    const webp = await s.clone().webp({ quality: 80, alphaQuality: 90, effort: 5 }).toBuffer()
    const avif = await s.clone().avif({ quality: 52, effort: 5 }).toBuffer()
    fs.writeFileSync(path.join(OUT, `${id}-${w}.webp`), webp)
    fs.writeFileSync(path.join(OUT, `${id}-${w}.avif`), avif)
    sizes.push({ w, h: Math.round((w * H) / W), webp: webp.length, avif: avif.length })
  }
  const flat = await sharp({ create: { width: W, height: H, channels: 3, background: { r: PAPER[0], g: PAPER[1], b: PAPER[2] } } }).composite([{ input: full }]).png().toBuffer()
  await sharp(flat).resize({ width: 900 }).jpeg({ quality: 88 }).toFile(`${SRC}/preview/${id}.jpg`)
  console.log(JSON.stringify({ id, aspect: +(W / H).toFixed(4), sizes }))
}

const only = process.argv[3]
let seed = 21
for (const [id, cfg] of Object.entries(plates)) {
  seed += 17
  if (!only || only === id) await make(id, cfg, seed)
}
