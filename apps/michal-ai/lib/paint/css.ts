// Reading computed CSS values for the page painter (./page.ts). Pure: strings in, numbers out, no DOM.

/** Splits on `sep` outside parentheses, trimmed, empty parts dropped. */
export function splitTop(s: string, sep: ',' | ' '): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const c of s) {
    if (c === '(') depth++
    else if (c === ')') depth--
    if (depth === 0 && (sep === ' ' ? /\s/.test(c) : c === sep)) {
      if (cur.trim()) out.push(cur.trim())
      cur = ''
    } else cur += c
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** A computed length in px: `12px`, `50%` of `total`, or a calc() of those added and subtracted. NaN if it is neither. */
export function px(s: string, total = 0): number {
  s = s.trim()
  if (s.startsWith('calc(') && s.endsWith(')')) {
    const body = s.slice(5, -1)
    let sum = 0
    let sign = 1
    for (const t of body.split(/\s+/)) {
      if (t === '+') sign = 1
      else if (t === '-') sign = -1
      else sum += sign * px(t, total)
    }
    return sum
  }
  const m = /^(-?[\d.]+(?:e-?\d+)?)(px|%)?$/.exec(s)
  if (!m) return NaN
  return m[2] === '%' ? (Number(m[1]) / 100) * total : Number(m[1])
}

const isLength = (t: string) => /^(-?[\d.]|calc\()/.test(t)

export type Stop = { color: string; at: number | null }
/** A gradient layer; its stops stay raw until the painter knows the length of the gradient line (parseStops). */
export type Gradient =
  | { kind: 'linear'; dir: [number, number]; length: number; stops: string[] }
  | { kind: 'radial'; circle: boolean; size: string[]; at: [string, string]; stops: string[] }

/** Unit vector the gradient runs along in a w x h box, y down, from the first argument (or none: to bottom). */
export function linearDir(arg: string | null, w: number, h: number): [number, number] {
  if (arg?.startsWith('to ')) {
    const words = arg.slice(3).split(/\s+/)
    const sx = words.includes('right') ? 1 : words.includes('left') ? -1 : 0
    const sy = words.includes('bottom') ? 1 : words.includes('top') ? -1 : 0
    // to a corner: the line is square to the diagonal between the other two corners
    const x = sx * (sy ? h : 1)
    const y = sy * (sx ? w : 1)
    const l = Math.hypot(x, y) || 1
    return [x / l, y / l]
  }
  let a = Math.PI
  const m = arg && /^(-?[\d.]+)(deg|turn|rad|grad)$/.exec(arg)
  if (m) {
    const v = Number(m[1])
    a = m[2] === 'deg' ? (v * Math.PI) / 180 : m[2] === 'turn' ? v * 2 * Math.PI : m[2] === 'grad' ? (v * Math.PI) / 200 : v
  }
  return [Math.sin(a), -Math.cos(a)]
}

/** Colour stops along a gradient line `length` px long; positions as a share of it, null where CSS leaves it to placeStops. */
export function parseStops(parts: string[], length: number): Stop[] {
  const out: Stop[] = []
  for (const p of parts) {
    const t = splitTop(p, ' ')
    const colorEnd = t.findIndex((x, i) => i > 0 && isLength(x))
    const color = (colorEnd < 0 ? t : t.slice(0, colorEnd)).join(' ')
    const at = colorEnd < 0 ? [] : t.slice(colorEnd).map((x) => px(x, length) / length)
    // a bare position (a colour hint) is dropped: the stops either side meet halfway, near enough
    if (isLength(color)) continue
    if (at.length === 0) out.push({ color, at: null })
    for (const a of at) out.push({ color, at: a })
  }
  return out
}

/** Gives every stop a position from 0 to 1, as CSS does: the ends default to 0 and 1, the rest are spread evenly, none goes back. */
export function placeStops(list: Stop[]): { color: string; at: number }[] {
  if (list.length === 0) return []
  const s = list.map((x) => ({ ...x }))
  if (s[0].at == null) s[0].at = 0
  if (s[s.length - 1].at == null) s[s.length - 1].at = 1
  let max = -Infinity
  for (const x of s) if (x.at != null) max = x.at = Math.max(x.at, max)
  for (let i = 1; i < s.length; i++) {
    if (s[i].at != null) continue
    let j = i
    while (s[j].at == null) j++
    const a = s[i - 1].at!
    const b = s[j].at!
    for (let k = i; k < j; k++) s[k].at = a + ((b - a) * (k - i + 1)) / (j - i + 1)
  }
  return s as { color: string; at: number }[]
}

/** One computed `background-image` layer, if it is a gradient this painter draws (linear or radial, repeating drawn once). */
export function parseGradient(layer: string, w: number, h: number): Gradient | null {
  const m = /^(?:repeating-)?(linear|radial)-gradient\((.*)\)$/s.exec(layer.trim())
  if (!m) return null
  const args = splitTop(m[2], ',')
  if (m[1] === 'linear') {
    const first = args[0] && /^(to |-?[\d.]+(deg|turn|rad|grad)$)/.test(args[0]) ? args.shift()! : null
    const dir = linearDir(first, w, h)
    const length = Math.abs(w * dir[0]) + Math.abs(h * dir[1])
    return { kind: 'linear', dir, length, stops: args }
  }
  let circle = false
  let size: string[] = []
  let at: [string, string] = ['50%', '50%']
  const head = args[0] ?? ''
  const words = splitTop(head, ' ')
  if (words.some((x) => /^(circle|ellipse|at|closest-|farthest-)/.test(x)) || (words.length <= 2 && words.every(isLength) && args.length > 2)) {
    args.shift()
    const ai = words.indexOf('at')
    const shape = ai < 0 ? words : words.slice(0, ai)
    if (ai >= 0) {
      const pos = words.slice(ai + 1).map((x) => ({ left: '0%', top: '0%', center: '50%', right: '100%', bottom: '100%' })[x] ?? x)
      at = [pos[0] ?? '50%', pos[1] ?? '50%']
    }
    circle = shape.includes('circle') || (shape.filter(isLength).length === 1 && !shape.includes('ellipse'))
    size = shape.filter((x) => x !== 'circle' && x !== 'ellipse')
  }
  return { kind: 'radial', circle, size, at, stops: args }
}

export type Shadow = { inset: boolean; x: number; y: number; blur: number; spread: number; color: string }

/** A computed `box-shadow`: the colour comes first in computed values, then the lengths, then `inset`. */
export function parseShadows(s: string): Shadow[] {
  if (!s || s === 'none') return []
  return splitTop(s, ',').map((one) => {
    const t = splitTop(one, ' ')
    const inset = t.includes('inset')
    const lens = t.filter(isLength).map((x) => px(x))
    const color = t.filter((x) => x !== 'inset' && !isLength(x)).join(' ') || 'currentcolor'
    return { inset, x: lens[0] ?? 0, y: lens[1] ?? 0, blur: lens[2] ?? 0, spread: lens[3] ?? 0, color }
  })
}

/** The four corner radii (tl, tr, br, bl) of a w x h box, from computed per-corner values, shrunk together when they overlap. */
export function radii(corners: [string, string, string, string], w: number, h: number): [number, number, number, number] {
  const r = corners.map((c) => Math.max(0, px(c.split(/\s+/)[0] || '0', w) || 0)) as [number, number, number, number]
  const k = Math.min(1, w / (r[0] + r[1] || 1), w / (r[2] + r[3] || 1), h / (r[0] + r[3] || 1), h / (r[1] + r[2] || 1))
  return r.map((v) => v * k) as [number, number, number, number]
}

/** Where object-fit puts a nw x nh picture in a w x h box: the drawn rect relative to the box. */
export function fit(mode: string, nw: number, nh: number, w: number, h: number, pos: [number, number] = [0.5, 0.5]) {
  let dw = w
  let dh = h
  if (mode === 'cover' || mode === 'contain' || mode === 'scale-down') {
    const k = mode === 'cover' ? Math.max(w / nw, h / nh) : Math.min(w / nw, h / nh, mode === 'scale-down' ? 1 : Infinity)
    dw = nw * k
    dh = nh * k
  } else if (mode === 'none') {
    dw = nw
    dh = nh
  }
  return { x: (w - dw) * pos[0], y: (h - dh) * pos[1], w: dw, h: dh }
}
