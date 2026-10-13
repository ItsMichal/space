// The hero portrait: a monospace glyph atlas built at runtime from whichever monospace face resolves (SF Mono on Apple devices,
// otherwise the system mono; no font file is shipped or baked), and the picture loader. The glyphs are chosen by their measured
// ink coverage, so the luminance ramp is right whichever face it is.
export const MONO_STACK = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'
const CANDIDATES = " .'`,:;-_~=+*/\\|!ilxXoO#%&@$MW"

export interface Atlas {
  canvas: HTMLCanvasElement
  /** number of glyphs, left to right, lightest to darkest */
  n: number
  /** cell width / height of one glyph (measured advance over measured line height) */
  aspect: number
  glyphs: string
}

export function buildAtlas(dpr: number): Atlas | null {
  try {
    const size = Math.max(10, Math.round(14 * dpr))
    const probe = document.createElement('canvas').getContext('2d')
    if (!probe) return null
    probe.font = `${size}px ${MONO_STACK}`
    const m = probe.measureText('M')
    const cw = Math.max(4, Math.ceil(m.width))
    const asc = m.fontBoundingBoxAscent ?? size * 0.8
    const desc = m.fontBoundingBoxDescent ?? size * 0.25
    const ch = Math.max(6, Math.ceil(asc + desc))
    // rasterise every candidate and measure its coverage
    const all = [...new Set(CANDIDATES)]
    const sheet = document.createElement('canvas')
    sheet.width = cw * all.length
    sheet.height = ch
    const g = sheet.getContext('2d', { willReadFrequently: true })!
    g.font = `${size}px ${MONO_STACK}`
    g.textBaseline = 'alphabetic'
    g.fillStyle = '#fff'
    all.forEach((c, i) => g.fillText(c, i * cw, Math.round(asc)))
    const px = g.getImageData(0, 0, sheet.width, ch).data
    const cov = all.map((_, i) => {
      let s = 0
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) s += px[(y * sheet.width + i * cw + x) * 4 + 3]
      return s
    })
    const order = all.map((_, i) => i).sort((a, b) => cov[a] - cov[b])
    // pick 12 glyphs spread evenly over the coverage range
    const N = 12
    const max = cov[order[order.length - 1]]
    const picked: number[] = []
    for (let k = 0; k < N; k++) {
      const want = (max * k) / (N - 1)
      let best = order[0]
      for (const i of order) if (Math.abs(cov[i] - want) < Math.abs(cov[best] - want)) best = i
      if (!picked.includes(best)) picked.push(best)
    }
    const atlas = document.createElement('canvas')
    atlas.width = cw * picked.length
    atlas.height = ch
    const a = atlas.getContext('2d')!
    a.drawImage(sheet, 0, 0)
    a.clearRect(0, 0, atlas.width, ch)
    picked.forEach((src, i) => a.drawImage(sheet, src * cw, 0, cw, ch, i * cw, 0, cw, ch))
    return { canvas: atlas, n: picked.length, aspect: cw / ch, glyphs: picked.map((i) => all[i]).join('') }
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
