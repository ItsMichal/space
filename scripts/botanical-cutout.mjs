// Cuts public-domain botanical plates (assets-src/botanical/*.jpg) out of their paper and writes
// transparent WebP/AVIF to public/botanical/. The plate's own paper is flat-fielded to the site paper, so the
// hand-colouring, engraved line and watercolour edge are kept; only the background, captions and library stamps go.
//
//   node scripts/botanical-cutout.mjs            (all plates)
//   node scripts/botanical-cutout.mjs dryas      (one)
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const SRC = 'assets-src/botanical'
const OUT = 'public/botanical'
const TARGET_PAPER = [248, 246, 239] // the airy light paper (#f8f6ef)

// rects are [x0, y0, x1, y1] in source pixels: caption, plate number, library scale-bar stamp, signatures.
const plates = {
  dryas: { exclude: [[0, 0, 1920, 150], [840, 1240, 1840, 1600]], keep: 0.01, widths: [1100, 560] },
  silene: { exclude: [[0, 0, 1920, 110], [290, 1000, 1540, 1420]], keep: 0.05, widths: [900, 480] },
  papaver: { exclude: [[0, 0, 1280, 150], [60, 1590, 840, 1844]], keep: 0.06, widths: [760, 420] },
  eriophorum: { thr: 32, exclude: [[1150, 0, 1920, 115], [0, 0, 1150, 40], [1100, 3150, 1920, 3323], [0, 3150, 640, 3323]], keep: 0.03, widths: [780, 420] },
  lupinus: { exclude: [[1650, 0, 1920, 100], [0, 2245, 1920, 2361]], keep: 0.1, widths: [1000, 520] },
}

async function blur(buf, W, H, ch, sigma) {
  const { data, info } = await sharp(buf, { raw: { width: W, height: H, channels: ch } }).blur(sigma).raw().toBuffer({ resolveWithObject: true })
  if (info.channels === ch) return data
  const out = Buffer.alloc(W * H * ch) // sharp may widen greyscale; repack to the stride we asked for
  for (let i = 0; i < W * H; i++) for (let c = 0; c < ch; c++) out[i * ch + c] = data[i * info.channels + c]
  return out
}

function boxMax(m, W, H, r, useMin) {
  // separable square dilate (or erode when useMin)
  const tmp = new Uint8Array(W * H)
  const out = new Uint8Array(W * H)
  const pick = useMin ? Math.min : Math.max
  const init = useMin ? 1 : 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = init
      for (let k = -r; k <= r; k++) {
        const xx = x + k
        v = pick(v, xx < 0 || xx >= W ? (useMin ? 0 : 0) : m[y * W + xx])
      }
      tmp[y * W + x] = v
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = init
      for (let k = -r; k <= r; k++) {
        const yy = y + k
        v = pick(v, yy < 0 || yy >= H ? 0 : tmp[yy * W + x])
      }
      out[y * W + x] = v
    }
  }
  return out
}

function fillHoles(m, W, H, maxHole) {
  const outside = new Uint8Array(W * H)
  const stack = []
  const push = (x, y) => {
    const i = y * W + x
    if (!m[i] && !outside[i]) {
      outside[i] = 1
      stack.push(i)
    }
  }
  for (let x = 0; x < W; x++) {
    push(x, 0)
    push(x, H - 1)
  }
  for (let y = 0; y < H; y++) {
    push(0, y)
    push(W - 1, y)
  }
  while (stack.length) {
    const i = stack.pop()
    const x = i % W
    const y = (i - x) / W
    if (x > 0) push(x - 1, y)
    if (x < W - 1) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y < H - 1) push(x, y + 1)
  }
  // enclosed background regions: fill only the small ones (petal interiors), leave big gaps between leaves clear
  const out = Uint8Array.from(m)
  const seen = new Uint8Array(W * H)
  for (let s0 = 0; s0 < W * H; s0++) {
    if (m[s0] || outside[s0] || seen[s0]) continue
    const region = [s0]
    seen[s0] = 1
    for (let k = 0; k < region.length; k++) {
      const i = region[k]
      const x = i % W
      const y = (i - x) / W
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx
        const yy = y + dy
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
        const j = yy * W + xx
        if (!m[j] && !outside[j] && !seen[j]) {
          seen[j] = 1
          region.push(j)
        }
      }
    }
    if (region.length <= maxHole) for (const i of region) out[i] = 1
  }
  return out
}

function keepComponents(m, W, H, minFrac) {
  const lab = new Int32Array(W * H)
  const sizes = [0]
  let n = 0
  const stack = []
  for (let s = 0; s < W * H; s++) {
    if (!m[s] || lab[s]) continue
    n++
    let size = 0
    lab[s] = n
    stack.push(s)
    while (stack.length) {
      const i = stack.pop()
      size++
      const x = i % W
      const y = (i - x) / W
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx
        const yy = y + dy
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
        const j = yy * W + xx
        if (m[j] && !lab[j]) {
          lab[j] = n
          stack.push(j)
        }
      }
    }
    sizes.push(size)
  }
  const max = Math.max(...sizes)
  const out = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) if (lab[i] && sizes[lab[i]] >= max * minFrac) out[i] = 1
  return out
}

async function cut(name, cfg) {
  const { data: rgb, info } = await sharp(path.join(SRC, `${name}.jpg`)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = info
  const N = W * H

  // 1) paper estimate: median paper colour, then a smooth per-pixel field from non-plant areas
  const rough = await blur(rgb, W, H, 3, 60)
  const fg0 = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    const d = Math.max(Math.abs(rgb[i * 3] - rough[i * 3]), Math.abs(rgb[i * 3 + 1] - rough[i * 3 + 1]), Math.abs(rgb[i * 3 + 2] - rough[i * 3 + 2]))
    fg0[i] = d > 14 ? 1 : 0
  }
  const fgBig = boxMax(fg0, W, H, 14, false)
  const med = [0, 1, 2].map((c) => {
    const vals = []
    for (let i = 0; i < N; i += 37) if (!fgBig[i]) vals.push(rgb[i * 3 + c])
    vals.sort((a, b) => a - b)
    return vals[vals.length >> 1]
  })
  const filled = Buffer.from(rgb)
  for (let i = 0; i < N; i++) if (fgBig[i]) for (let c = 0; c < 3; c++) filled[i * 3 + c] = med[c]
  const paper = await blur(filled, W, H, 3, 70)

  // 2) mask: anything that differs from the paper, minus captions and stamps
  let m = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    const d = Math.max(Math.abs(rgb[i * 3] - paper[i * 3]), Math.abs(rgb[i * 3 + 1] - paper[i * 3 + 1]), Math.abs(rgb[i * 3 + 2] - paper[i * 3 + 2]))
    m[i] = d > (cfg.thr ?? 17) ? 1 : 0
  }
  for (const [x0, y0, x1, y1] of cfg.exclude) for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) m[y * W + x] = 0
  m = boxMax(boxMax(m, W, H, 4, false), W, H, 4, true) // close small gaps
  m = fillHoles(m, W, H, cfg.hole ?? 22000) // watercolour petals enclosed by their outline become solid
  m = keepComponents(m, W, H, cfg.keep)
  m = boxMax(m, W, H, 1, true) // pull the edge in a hair so no paper halo survives

  // 3) soft, slightly irregular edge
  const a8 = Buffer.alloc(N)
  for (let i = 0; i < N; i++) a8[i] = m[i] ? 255 : 0
  const alpha = await blur(a8, W, H, 1, 1.1)

  // 4) colour: flat-field the paper to white, retint to the site paper, a touch less saturated
  const out = Buffer.alloc(N * 4)
  for (let i = 0; i < N; i++) {
    const r = []
    for (let c = 0; c < 3; c++) r[c] = Math.min(255, (rgb[i * 3 + c] / Math.max(40, paper[i * 3 + c])) * TARGET_PAPER[c])
    const l = 0.3 * r[0] + 0.59 * r[1] + 0.11 * r[2]
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(l + (r[c] - l) * 0.94)
    out[i * 4 + 3] = alpha[i]
  }

  // 5) crop to the plant and export
  let x0 = W, y0 = H, x1 = 0, y1 = 0
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (alpha[y * W + x] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  const pad = 10
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad)
  const base = sharp(out, { raw: { width: W, height: H, channels: 4 } }).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
  const crop = await base.png().toBuffer()
  fs.mkdirSync(OUT, { recursive: true })
  const meta = { name, aspect: +((x1 - x0 + 1) / (y1 - y0 + 1)).toFixed(4), files: [] }
  for (const w of cfg.widths) {
    const img = sharp(crop).resize({ width: Math.min(w, x1 - x0 + 1), kernel: 'lanczos3' })
    const webp = await img.clone().webp({ quality: 84, alphaQuality: 90, effort: 6 }).toBuffer()
    const avif = await img.clone().avif({ quality: 58, effort: 6 }).toBuffer()
    fs.writeFileSync(path.join(OUT, `${name}-${w}.webp`), webp)
    fs.writeFileSync(path.join(OUT, `${name}-${w}.avif`), avif)
    meta.files.push({ w, webp: webp.length, avif: avif.length })
  }
  // preview on paper (not shipped)
  fs.mkdirSync('assets-src/botanical/preview', { recursive: true })
  const flat = await sharp({ create: { width: x1 - x0 + 1, height: y1 - y0 + 1, channels: 3, background: { r: 248, g: 246, b: 239 } } })
    .composite([{ input: crop }])
    .png()
    .toBuffer()
  await sharp(flat).resize({ width: 900 }).jpeg({ quality: 88 }).toFile(`assets-src/botanical/preview/${name}.jpg`)
  console.log(JSON.stringify(meta))
}

const only = process.argv[2]
for (const [name, cfg] of Object.entries(plates)) if (!only || only === name) await cut(name, cfg)
