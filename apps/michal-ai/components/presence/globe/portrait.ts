// The hero portrait: a monospace glyph atlas built at runtime from whichever monospace face resolves (SF Mono on Apple devices,
// otherwise the system mono; no font file is shipped or baked), and the picture loader. The glyphs are chosen by their measured
// ink coverage, so the luminance ramp is right whichever face it is.
export const MONO_STACK = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'

/** Characters in a fixed order the shader relies on: lights 0-3, mids 4-6, edge strokes 7-10 (- | / \\), darks 11-16. */
export const ATLAS_CHARS = ".'`:+=_-|/\\#@%&80"

export interface Atlas {
  canvas: HTMLCanvasElement
  /** number of glyphs, left to right */
  n: number
  /** cell width / height of one glyph (measured advance over measured line height) */
  aspect: number
  /** where the glyph sits in its padded atlas cell: padX, width, padY, height (fractions) */
  box: [number, number, number, number]
}

export function buildAtlas(dpr: number): Atlas | null {
  try {
    const size = Math.max(12, Math.round(16 * dpr))
    const probe = document.createElement('canvas').getContext('2d')
    if (!probe) return null
    probe.font = `${size}px ${MONO_STACK}`
    const m = probe.measureText('M')
    const cw = Math.max(4, Math.ceil(m.width))
    const asc = m.fontBoundingBoxAscent ?? size * 0.8
    const desc = m.fontBoundingBoxDescent ?? size * 0.25
    const ch = Math.max(6, Math.ceil(asc + desc))
    const pad = 4
    const cwp = cw + 2 * pad
    const chp = ch + 2 * pad
    const n = ATLAS_CHARS.length
    const atlas = document.createElement('canvas')
    atlas.width = cwp * n
    atlas.height = chp
    const g = atlas.getContext('2d')!
    g.font = `${size}px ${MONO_STACK}`
    g.textBaseline = 'alphabetic'
    g.fillStyle = '#fff'
    // a slightly heavier stroke than the font's regular weight, so scaled-down characters stay solid
    g.strokeStyle = '#fff'
    g.lineWidth = Math.max(0.6, size * 0.035)
    for (let i = 0; i < n; i++) {
      g.fillText(ATLAS_CHARS[i], i * cwp + pad, pad + Math.round(asc))
      g.strokeText(ATLAS_CHARS[i], i * cwp + pad, pad + Math.round(asc))
    }
    return { canvas: atlas, n, aspect: cw / ch, box: [pad / cwp, cw / cwp, pad / chp, ch / chp] }
  } catch {
    return null
  }
}

let pic: Promise<ImageBitmap | null> | null = null
export function loadPortrait(): Promise<ImageBitmap | null> {
  pic ??= fetch('/globe/portrait.webp')
    .then((r) => (r.ok ? r.blob() : null))
    .then((b) => (b ? createImageBitmap(b, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }) : null))
    .catch(() => null)
  return pic
}

export interface Glyphs {
  count: number
  aspect: number
  /** per instance: x, y (texture fractions), height fraction, glyph index */
  a: Float32Array
  /** per instance: ink 0..1.25, sketch start 0..1, r, g, b (0..1) */
  q: Float32Array
  atlasCols: number
  atlasRows: number
  glyphCount: number
  /** padX, width, padY, height of the glyph inside its atlas cell (fractions) */
  box: [number, number, number, number]
  atlas: ImageBitmap
}

/** Reads public/globe/portrait-glyphs.bin (written by scripts/build-portrait-glyphs.mjs) and its atlas. */
let glyphsP: Promise<Glyphs | null> | null = null
export function loadGlyphs(): Promise<Glyphs | null> {
  glyphsP ??= (async () => {
    const [bin, img] = await Promise.all([fetch('/globe/portrait-glyphs.bin'), fetch('/globe/portrait-glyphs.webp')])
    if (!bin.ok || !img.ok) return null
    const buf = await bin.arrayBuffer()
    const dv = new DataView(buf)
    if (dv.getUint32(0, false) !== 0x50474c31) return null // "PGL1"
    const count = dv.getUint32(4, true)
    const aspect = dv.getFloat32(8, true)
    const heights = [0, 1, 2, 3].map((i) => dv.getFloat32(12 + i * 4, true))
    const acols = dv.getUint8(28)
    const arows = dv.getUint8(29)
    const gcount = dv.getUint8(30)
    const clen = dv.getUint8(32)
    const off = 33 + clen
    if (buf.byteLength !== off + count * 12) return null
    const a = new Float32Array(count * 4)
    const q = new Float32Array(count * 5)
    for (let i = 0; i < count; i++) {
      const o = off + i * 12
      a[i * 4] = dv.getUint16(o, true) / 65535
      a[i * 4 + 1] = dv.getUint16(o + 2, true) / 65535
      a[i * 4 + 2] = heights[dv.getUint8(o + 4)]
      a[i * 4 + 3] = dv.getUint8(o + 5)
      q[i * 5] = (dv.getUint8(o + 6) / 255) * 1.25
      q[i * 5 + 1] = dv.getUint16(o + 7, true) / 65535
      q[i * 5 + 2] = dv.getUint8(o + 9) / 255
      q[i * 5 + 3] = dv.getUint8(o + 10) / 255
      q[i * 5 + 4] = dv.getUint8(o + 11) / 255
    }
    const atlas = await createImageBitmap(await img.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
    // glyph box inside the atlas cell: the bake pads 3 px around a 64 x 104 cell, glyph box 58 x 96 wide (0.6 aspect of 96)
    const cw = 64
    const ch = 104
    const bw = Math.round(aspect * 96)
    return { count, aspect, a, q, atlasCols: acols, atlasRows: arows, glyphCount: gcount, box: [(cw - bw) / 2 / cw, bw / cw, 3 / ch, 96 / ch] as [number, number, number, number], atlas }
  })().catch(() => null)
  return glyphsP as Promise<Glyphs | null>
}
