// Bakes the hero portrait as multi-size terminal characters (public/globe/portrait-glyphs.bin + portrait-glyphs.webp).
// Input is the tone texture public/globe/portrait.webp (greyscale + matte alpha, made by build-portrait.mjs). A quadtree search picks, per
// region, the glyph, its size and its ink so the composite best reproduces the tone: big characters in flat areas (jacket, hoodie), small
// ones where detail matters (eyes, glasses, mouth, hairline; the face mask lowers the cost of splitting). Characters come from a fixed
// monospace set rendered from IBM Plex Mono (SIL Open Font License 1.1, lib/og-fonts/IBMPlexMono-Regular.ttf, see lib/og-fonts/LICENSE-OFL.txt)
// by resvg; the runtime only needs the baked atlas and the instance list.
//   node scripts/build-portrait-glyphs.mjs [--preview out.png]
// Instance record (12 bytes, little endian): x u16, y u16 (cell top-left in 1/65535 of the texture), level u8, glyph u8, ink u8 (/255 * 1.25),
// t0 u16 (sketch-in start, 0..1 of the animation), r u8, g u8, b u8 (the photo's own colour averaged over the cell, through the matte). Header: "PGL1", count u32, aspect f32, heights f32 x4 (cell height per level, in texture
// height fractions), atlas cols u8, rows u8, glyph count u8, pad u8, then a "chars" string of the glyph set (length u8 + bytes).
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { Resvg } from '@resvg/resvg-js'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const TEX = path.join(root, 'public', 'globe', 'portrait.webp')
const FONT = path.join(root, 'lib', 'og-fonts', 'IBMPlexMono-Regular.ttf')
const CHARS = ".,'`:;-_~=+*/\\|!^<>()[]{}vxzcunwmoO0aMWQ#%&@8$"
const ASPECT = 0.6
const LEVEL_H = [18, 9, 4.5] // largest 18 px (about 18 CSS px at 1440); texture 576 x 768 // cell heights in texture pixels (576 x 768)
const GW = 16
const GH = 27 // canonical raster for matching
const CELL_W = 64 // atlas cell, pixels (glyph box 58 x 96 plus padding)
const CELL_H = 104
const PAD = 3

// --- tone map: darkness T = (1 - luminance) inside the matte
const { data: tex, info } = await sharp(TEX).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const TW = info.width
const TH = info.height
const T = new Float32Array(TW * TH)
const A = new Float32Array(TW * TH)
for (let i = 0; i < TW * TH; i++) {
  A[i] = tex[i * 4 + 3] / 255
  const tn = 1 - tex[i * 4] / 255
  // slightly stronger S-curve on the light tones: skin a little darker than the hoodie, mid-tones back
  // mid-dark fabric rather than black: the darks are pulled down to about 0.8
  const hx = (i % TW) / TW
  const hy = Math.floor(i / TW) / TH
  const inHair = hx > 0.2 && hx < 0.62 && hy < 0.24
  const sm = Math.min(1, Math.max(0, (tn - 0.55) / 0.35))
  // jacket and shoulders are pulled down to mid-dark; hair and face keep their full tone so the head stays the focal point
  T[i] = Math.min(1, Math.max(0, (tn - 0.06) * 1.3 + 0.1)) * (1 - (inHair ? 0.1 : 0.4) * sm * sm * (3 - 2 * sm)) * A[i]
}

// --- photo colour, same crop as the tone texture (build-portrait.mjs): 576 x 768 RGB
const PHOTO = process.env.PORTRAIT_PHOTO ?? (process.argv.includes('--photo') ? process.argv[process.argv.indexOf('--photo') + 1] : null) ?? '/private/tmp/claude-501/-Users-michal-Desktop-dev-space/ec70ad79-12cb-4462-b58a-1b95b9bae29e/images/9.webp'
const rgb = await sharp(PHOTO).extract({ left: 300, top: 200, width: 1200, height: 1600 }).resize(TW, TH, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer()
function cellColour(x0, y0, w, h) {
  let r = 0, g = 0, b = 0, n = 0
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(TH, Math.ceil(y0 + h)); y++)
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(TW, Math.ceil(x0 + w)); x++) {
      const a = A[y * TW + x]
      if (a < 0.5) continue
      r += rgb[(y * TW + x) * 3]; g += rgb[(y * TW + x) * 3 + 1]; b += rgb[(y * TW + x) * 3 + 2]; n++
    }
  return n ? [r / n, g / n, b / n] : [128, 128, 128]
}

// --- glyph rasters from the font
const GLYPH_PX = 96
const fontOpts = { font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: 'IBM Plex Mono' } }
const esc = (c) => c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
async function glyphRaster(c) {
  const fs0 = 88
  const w = Math.round(ASPECT * GLYPH_PX) + 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_W}" height="${CELL_H}"><text x="${CELL_W / 2}" y="${PAD + 72}" text-anchor="middle" font-family="IBM Plex Mono" font-size="${fs0}" fill="#fff">${esc(c)}</text></svg>`
  void w
  const png = new Resvg(svg, { ...fontOpts, fitTo: { mode: 'original' } }).render().asPng()
  const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const a = new Uint8Array(CELL_W * CELL_H)
  for (let i = 0; i < a.length; i++) a[i] = data[i * 4 + 3]
  return a
}
const rasters = []
for (const c of CHARS) rasters.push(await glyphRaster(c))
// canonical small versions over the nominal glyph box (centred in the atlas cell)
const boxW = Math.round(ASPECT * GLYPH_PX)
const bx0 = Math.round((CELL_W - boxW) / 2)
const by0 = PAD
const small = rasters.map((r) => {
  const g = new Float32Array(GW * GH)
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      let s = 0
      let n = 0
      const x0 = bx0 + Math.floor((i * boxW) / GW)
      const x1 = bx0 + Math.floor(((i + 1) * boxW) / GW)
      const y0 = by0 + Math.floor((j * GLYPH_PX) / GH)
      const y1 = by0 + Math.floor(((j + 1) * GLYPH_PX) / GH)
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += r[y * CELL_W + x] / 255; n++ }
      g[j * GW + i] = n ? s / n : 0
    }
  return g
})
const gSum = small.map((g) => g.reduce((a, b) => a + b, 0))
const gSq = small.map((g) => g.reduce((a, b) => a + b * b, 0))

// --- face weight: eyes and glasses matter most, then the face, then the rest
const face = (x, y) => {
  const u = x / TW
  const v = y / TH
  const f = Math.max(0, 1 - Math.hypot((u - 0.396) / 0.21, (v - 0.29) / 0.22))
  const e = Math.max(0, 1 - Math.hypot((u - 0.396) / 0.19, (v - 0.268) / 0.045))
  return Math.min(1, f + e)
}

// --- patch sampling
function patch(x0, y0, w, h) {
  const p = new Float32Array(GW * GH)
  let am = 0
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const sx0 = x0 + (i * w) / GW
      const sx1 = x0 + ((i + 1) * w) / GW
      const sy0 = y0 + (j * h) / GH
      const sy1 = y0 + ((j + 1) * h) / GH
      let s = 0
      let a = 0
      let n = 0
      for (let y = Math.floor(sy0); y < Math.max(Math.ceil(sy1), Math.floor(sy0) + 1); y++)
        for (let x = Math.floor(sx0); x < Math.max(Math.ceil(sx1), Math.floor(sx0) + 1); x++) {
          const k = Math.min(TH - 1, Math.max(0, y)) * TW + Math.min(TW - 1, Math.max(0, x))   // beyond the texture: replicate its edge
          s += T[k]
          a += A[k]
          n++
        }
      p[j * GW + i] = n ? s / n : 0
      am += n ? a / n : 0
    }
  return { p, alpha: am / (GW * GH) }
}

// best glyph and ink for a patch. The score mixes the fine pixel error with a coarse (4 x 6) one, so light flat tones (skin) are matched by a
// sparse character at low ink instead of falling back to blank, and ink may go from faint to full.
const INKS = [0.45, 0.6, 0.75, 0.9, 1.05, 1.2]
const CW = 4
const CH = 6
function coarse(a) {
  const c = new Float32Array(CW * CH)
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) c[Math.min(CH - 1, Math.floor((j * CH) / GH)) * CW + Math.min(CW - 1, Math.floor((i * CW) / GW))] += a[j * GW + i]
  const n = (GW * GH) / (CW * CH)
  for (let i = 0; i < c.length; i++) c[i] /= n
  return c
}
const smallC = small.map(coarse)
const gSqC = smallC.map((g) => g.reduce((a, b) => a + b * b, 0))
const DENSE = new Set([...'@#%$MW8Q&'].map((c) => CHARS.indexOf(c)))
function bestGlyph(p, fw = 0, seed = 0) {
  let mean = 0
  for (let i = 0; i < p.length; i++) mean += p[i]
  mean /= p.length
  let tt = 0
  for (let i = 0; i < p.length; i++) tt += p[i] * p[i]
  const pc = coarse(p)
  let ttc = 0
  for (let i = 0; i < pc.length; i++) ttc += pc[i] * pc[i]
  const FINE = 0.25 + 5 * fw
  const COARSE = 14
  let best = { err: FINE * tt + COARSE * ttc, glyph: -1, ink: 0 }
  const cands = []
  for (let g = 0; g < small.length; g++) {
    // fabric and hair stay light-bodied (: = + * x o ...); the dense characters are kept for the darkest tones
    if (DENSE.has(g) && mean < 0.7) continue
    let gt = 0
    const gg = small[g]
    for (let i = 0; i < p.length; i++) gt += gg[i] * p[i]
    let gtc = 0
    for (let i = 0; i < pc.length; i++) gtc += smallC[g][i] * pc[i]
    for (const a of INKS) {
      const err = FINE * (tt - 2 * a * gt + a * a * gSq[g]) + COARSE * (ttc - 2 * a * gtc + a * a * gSqC[g])
      if (err < best.err) best = { err, glyph: g, ink: a }
      cands.push({ err, glyph: g, ink: a })
    }
  }
  // near-ties (within 30%) are broken by position, so flat areas do not repeat one character
  if (fw > 0.12 && mean > 0.02 && best.glyph < 0 && cands.length) best = cands.reduce((m, c) => (c.err < m.err ? c : m))   // no gaps in the face
  const near = cands.filter((c) => c.err <= best.err * 1.3 + 1e-6 && c.glyph >= 0)
  if (near.length > 1 && best.glyph >= 0) return near[Math.floor(((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1 * near.length)]
  return best
}

const LAMBDA = [0, 1.2, 0.9] // cost of a split into the next level, scaled down by the face weight
const FACE_GAIN = 60
const instances = []
function cell(level, x0, y0) {
  const h = LEVEL_H[level]
  const w = h * ASPECT
  const { p, alpha } = patch(x0, y0, w, h)
  const cx = x0 + w / 2
  const cy = y0 + h / 2
  const fw = face(cx, cy)
  const u0 = cx / TW
  const v0 = cy / TH
  // inside the matte only
  const centreIn = A[Math.min(TH - 1, Math.max(0, Math.round(cy))) * TW + Math.min(TW - 1, Math.max(0, Math.round(cx)))] >= 0.5
  const last = level === LEVEL_H.length - 1
  if (alpha < 0.02) return { err: 0, items: [] }
  // a cell that is only partly inside the silhouette must split (a big character would stick out of the matte)
  // the face is always drawn small enough for eyes, glasses, mouth to read
  const hair = u0 > 0.2 && u0 < 0.62 && v0 < 0.22
  const forceSplit = !last && (alpha < 0.93 || (fw > 0.25 && level < 1) || (fw > 0.5 && level < 2) || (hair && level < 1))
  if (last && (alpha < 0.5 || !centreIn)) return { err: 0, items: [] }
  const weight = 1 + FACE_GAIN * fw
  const leaf = bestGlyph(p, fw, x0 * 0.37 + y0 * 1.31 + level)
  const leafErr = leaf.err * weight
  const leafItem = leaf.glyph < 0 ? [] : [{ x: x0, y: y0, level, glyph: leaf.glyph, ink: leaf.ink }]
  if (level === LEVEL_H.length - 1) return { err: leafErr + (leaf.glyph < 0 ? 0 : 0.05), items: leafItem }
  const hw = w / 2
  const hh = h / 2
  let sErr = 0
  let sItems = []
  for (const [dx, dy] of [[0, 0], [hw, 0], [0, hh], [hw, hh]]) {
    const c = cell(level + 1, x0 + dx, y0 + dy)
    sErr += c.err
    sItems = sItems.concat(c.items)
  }
  const lam = LAMBDA[level + 1] / (1 + 12 * fw)
  if (forceSplit || sErr + lam < leafErr) return { err: sErr + lam, items: sItems }
  return { err: leafErr, items: leafItem }
}
const cols = Math.ceil(TW / (LEVEL_H[0] * ASPECT))
const rows = Math.ceil(TH / LEVEL_H[0])
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) instances.push(...cell(0, c * LEVEL_H[0] * ASPECT, r * LEVEL_H[0]).items)

for (let i = instances.length - 1; i >= 0; i--) if (instances[i].x >= TW - 1 || instances[i].y >= TH - 1) instances.splice(i, 1)

// --- sketch-in order: big outline first, detail from the eyes outward, with jitter
const E = { x: 0.396 * TW, y: 0.268 * TH }
let maxD = 0
for (const it of instances) {
  const h = LEVEL_H[it.level]
  it.cx = it.x + (h * ASPECT) / 2
  it.cy = it.y + h / 2
  it.d = Math.hypot((it.cx - E.x) / TW, (it.cy - E.y) / TH)
  maxD = Math.max(maxD, it.d)
}
let seed = 12345
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
for (const it of instances) it.key = 0.5 * (it.level / (LEVEL_H.length - 1)) + 0.45 * (it.d / maxD) + 0.05 * rnd()
instances.sort((a, b) => a.key - b.key)
const kmin = instances[0].key
const kmax = instances[instances.length - 1].key

// --- write the binary
const chars = Buffer.from(CHARS, 'utf8')
const head = Buffer.alloc(4 + 4 + 4 + 16 + 4 + 1 + chars.length)
let o = 0
head.write('PGL1', o); o += 4
head.writeUInt32LE(instances.length, o); o += 4
head.writeFloatLE(ASPECT, o); o += 4
for (let l = 0; l < 4; l++) { head.writeFloatLE((LEVEL_H[l] ?? 0) / TH, o); o += 4 } // four slots, unused ones 0
const ACOLS = 8
const AROWS = Math.ceil(CHARS.length / ACOLS)
head.writeUInt8(ACOLS, o++); head.writeUInt8(AROWS, o++); head.writeUInt8(CHARS.length, o++); head.writeUInt8(0, o++)
head.writeUInt8(chars.length, o++); chars.copy(head, o)
const body = Buffer.alloc(instances.length * 12)
instances.forEach((it, i) => {
  const b = i * 12
  body.writeUInt16LE(Math.round((it.x / TW) * 65535), b)
  body.writeUInt16LE(Math.round((it.y / TH) * 65535), b + 2)
  body.writeUInt8(it.level, b + 4)
  body.writeUInt8(it.glyph, b + 5)
  body.writeUInt8(Math.round(Math.min(1.25, it.ink) / 1.25 * 255), b + 6)
  body.writeUInt16LE(Math.round(((it.key - kmin) / (kmax - kmin)) * 65535), b + 7)
  const col = cellColour(it.x, it.y, LEVEL_H[it.level] * ASPECT, LEVEL_H[it.level])
  body.writeUInt8(Math.round(col[0]), b + 9)
  body.writeUInt8(Math.round(col[1]), b + 10)
  body.writeUInt8(Math.round(col[2]), b + 11)
})
const outBin = path.join(root, 'public', 'globe', 'portrait-glyphs.bin')
fs.writeFileSync(outBin, Buffer.concat([head, body]))

// --- atlas: glyph cells in a grid, white with alpha
const aw = ACOLS * CELL_W
const ah = AROWS * CELL_H
const atlas = Buffer.alloc(aw * ah * 4)
rasters.forEach((r, gi) => {
  const gx = (gi % ACOLS) * CELL_W
  const gy = Math.floor(gi / ACOLS) * CELL_H
  for (let y = 0; y < CELL_H; y++) for (let x = 0; x < CELL_W; x++) {
    const k = ((gy + y) * aw + gx + x) * 4
    atlas[k] = atlas[k + 1] = atlas[k + 2] = 255
    atlas[k + 3] = r[y * CELL_W + x]
  }
})
const outAtlas = path.join(root, 'public', 'globe', 'portrait-glyphs.webp')
const ai = await sharp(atlas, { raw: { width: aw, height: ah, channels: 4 } }).webp({ lossless: true, effort: 6 }).toFile(outAtlas)
const counts = LEVEL_H.map((_, l) => instances.filter((i) => i.level === l).length)
console.log(`instances ${instances.length} (levels ${counts.join('/')}), bin ${fs.statSync(outBin).size} bytes, atlas ${ai.width}x${ai.height} ${ai.size} bytes`)

// --- preview: the instances as SVG text, rendered by resvg, beside nothing else (compose with the source elsewhere)
const prev = args('--preview')
if (prev) {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH}"><rect width="100%" height="100%" fill="#efe6cf"/>`
  for (const it of instances) {
    const h = LEVEL_H[it.level]
    const size = h / 1.05
    svg += `<text x="${(it.cx).toFixed(1)}" y="${(it.y + h * 0.78).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono" font-size="${size.toFixed(1)}" fill="#1c241f" fill-opacity="${Math.min(1, it.ink).toFixed(2)}">${esc(CHARS[it.glyph])}</text>`
  }
  svg += '</svg>'
  fs.writeFileSync(prev, new Resvg(svg, { ...fontOpts, fitTo: { mode: 'zoom', value: 1.5 } }).render().asPng())
  console.log('preview', prev)
}
function args(n) {
  const i = process.argv.indexOf(n)
  return i >= 0 ? process.argv[i + 1] : null
}
