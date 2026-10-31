// Offline half of the glyph art: a photo in, a small grid out. The subject is lifted out of the photo (lift-subject.swift, macOS
// Vision), cropped to its bounds and sampled into character cells; each cell keeps a palette entry (chroma and hue in OKLCH) and a
// shade (the cell's lightness rank inside the subject, 0 to 9). Lightness is not stored as is: draw.mjs maps the shade into a range
// that reads on the page's own paper, light or dark. Needs macOS (swiftc) and `sharp` from the root node_modules; run by hand, the
// output is committed (the CI build never runs this).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const HERE = path.dirname(new URL(import.meta.url).pathname)
/** Glyph cell width over height for a monospace face at line-height 1 (draw.mjs draws on the same grid). */
export const CELL = 0.6

let lifter
function liftTool() {
  if (lifter) return lifter
  const bin = path.join(os.tmpdir(), 'glyph-art-lift-subject')
  const src = path.join(HERE, 'lift-subject.swift')
  if (!fs.existsSync(bin) || fs.statSync(bin).mtimeMs < fs.statSync(src).mtimeMs) execFileSync('swiftc', ['-O', src, '-o', bin], { stdio: 'inherit' })
  return (lifter = bin)
}

const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
/** sRGB bytes to OKLCH: [L 0..1, C, h degrees]. */
export function oklch(r, g, b) {
  const [R, G, B] = [r, g, b].map((v) => lin(v / 255))
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return [L, Math.hypot(a, bb), ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360]
}

const NEUTRAL = 0.035 // chroma below this is grey
const HUE_BINS = 12

/**
 * The grid for one photo, or null when it has no subject that reads as glyphs (no subject found, one that fills nearly the
 * whole frame or almost none of it, or loose fragments that fill little of their own bounds).
 * Shape: { w, h, pal: [[C, h], ...], c, l } where c and l are w * h characters, row by row: c is ' ' (empty) or a palette letter
 * ('a' is pal[0]), l the shade digit.
 */
export async function glyphGrid(file, { maxCols = 120, maxRows = 34 } = {}) {
  const sharp = require(process.env.SHARP_PATH ?? 'sharp')
  const tmp = path.join(os.tmpdir(), `glyph-art-${process.pid}.png`)
  try {
    try {
      execFileSync(liftTool(), [file, tmp], { stdio: 'ignore' })
    } catch {
      return null
    }
    const { data, info } = await sharp(tmp).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const { width: W, height: H } = info
    let x0 = W, y0 = H, x1 = -1, y1 = -1, on = 0
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (data[(y * W + x) * 4 + 3] > 128) {
          on++
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
    if (x1 < 0 || on / (W * H) > 0.8 || on / (W * H) < 0.02) return null
    const bw = x1 - x0 + 1
    const bh = y1 - y0 + 1
    let w = Math.min(maxCols, Math.round((maxRows * bw) / bh / CELL))
    let h = Math.round((w * CELL * bh) / bw)
    if (h > maxRows) [h, w] = [maxRows, Math.round((maxRows * bw) / bh / CELL)]
    const cells = await sharp(tmp).extract({ left: x0, top: y0, width: bw, height: bh }).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer()
    const lch = []
    for (let i = 0; i < w * h; i++) lch.push(cells[i * 4 + 3] > 140 ? oklch(cells[i * 4], cells[i * 4 + 1], cells[i * 4 + 2]) : null)
    const sorted = lch.filter(Boolean).map((v) => v[0]).sort((a, b) => a - b)
    if (sorted.length / (w * h) < 0.25) return null // scattered fragments, not one shape
    const rank = (L) => {
      let lo = 0, hi = sorted.length
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (sorted[mid] < L) lo = mid + 1
        else hi = mid
      }
      return lo / Math.max(1, sorted.length - 1)
    }
    // palette: one grey, then a mean chroma and hue per hue bin that is used
    const bins = Array.from({ length: HUE_BINS }, () => ({ n: 0, c: 0, x: 0, y: 0 }))
    const binOf = (v) => (v[1] < NEUTRAL ? -1 : Math.floor(v[2] / (360 / HUE_BINS)) % HUE_BINS)
    for (const v of lch) {
      if (!v || binOf(v) < 0) continue
      const b = bins[binOf(v)]
      b.n++
      b.c += v[1]
      b.x += Math.cos((v[2] * Math.PI) / 180)
      b.y += Math.sin((v[2] * Math.PI) / 180)
    }
    const pal = [[0, 0]]
    const index = bins.map((b) => {
      if (!b.n) return 0
      pal.push([+(b.c / b.n).toFixed(3), Math.round(((Math.atan2(b.y, b.x) * 180) / Math.PI + 360) % 360)])
      return pal.length - 1
    })
    let c = ''
    let l = ''
    for (const v of lch) {
      c += v ? String.fromCharCode(97 + (binOf(v) < 0 ? 0 : index[binOf(v)])) : ' '
      l += v ? Math.min(9, Math.floor(rank(v[0]) * 10)) : ' '
    }
    return { w, h, pal, c, l }
  } finally {
    fs.rmSync(tmp, { force: true })
  }
}
