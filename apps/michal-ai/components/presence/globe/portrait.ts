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
