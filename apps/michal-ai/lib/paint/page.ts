// Paints the live page into a 2D canvas: the site's own capture, for the paper transition (a texture of the viewport) and the glass
// lens on engines without a backdrop lens (the whole document). It reads the page as it is laid out right now, nothing is cloned or
// laid out again, so it is quick and never moves the page.
//
// One pass over the DOM builds a list of drawing steps; images it has to fetch again (cross-origin ones with CORS, inline SVG as a
// picture) load meanwhile; then the steps run. What it draws, in rough CSS paint order (backgrounds, then in-flow content, then
// positioned layers by z-index): background colours and linear and radial gradients, url() backgrounds, rounded corners, borders,
// box shadows, opacity, overflow clips, absolutely placed ::before and ::after boxes, images, video frames, canvases, inline SVG, and
// text word by word where the browser laid it out, with its font, colour, letter-spacing, case and underline.
// What it leaves out: transforms beyond their bounding box (rotations draw upright), filters, masks, blend modes, text shadows,
// list markers other than bullets and numbers, iframes. Good enough for a sheet that burns away in two seconds, or a blurred lens.
import { fit, parseGradient, parseShadows, parseStops, placeStops, px, radii, splitTop } from './css'

export type PaintOptions = {
  /** The area to paint, in viewport CSS px: the viewport is 0, 0, innerWidth, innerHeight; the whole document starts at -scrollX, -scrollY. */
  x: number
  y: number
  width: number
  height: number
  /** Device px per CSS px. */
  scale: number
  /** Leave an element (and all inside it) out. */
  skip?: (el: Element, cs: CSSStyleDeclaration) => boolean
  /** Paint over this canvas (what is on it stays under the page) instead of a new one. */
  canvas?: HTMLCanvasElement
  /** The longest wait for pictures fetched again, ms. */
  wait?: number
}

type Ctx = CanvasRenderingContext2D
type Step = (ctx: Ctx) => void
type Radii = [number, number, number, number]
type Box = { x: number; y: number; w: number; h: number; r: Radii }

const NEVER = new Set(['SCRIPT', 'NOSCRIPT', 'STYLE', 'TEMPLATE', 'LINK', 'META', 'HEAD', 'IFRAME', 'OBJECT', 'EMBED'])
/** Far away, for drawing a shape off the canvas so that only its shadow lands. */
const OFF = 1e5

let probe: Ctx | null = null
const rgbaCache = new Map<string, [number, number, number, number]>()

/** Any CSS colour as sRGB 0 to 255 and alpha 0 to 1, read off one painted pixel (so oklch and color-mix work as the browser has them). */
function rgba(css: string): [number, number, number, number] {
  let v = rgbaCache.get(css)
  if (v) return v
  probe ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })!
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = 'rgba(0,0,0,0)'
  probe.fillStyle = css
  probe.fillRect(0, 0, 1, 1)
  const d = probe.getImageData(0, 0, 1, 1).data
  v = [d[0], d[1], d[2], d[3] / 255]
  if (rgbaCache.size > 512) rgbaCache.clear()
  rgbaCache.set(css, v)
  return v
}
const clear = (css: string) => rgba(css)[3] === 0

const pics = new Map<string, Promise<HTMLImageElement | null>>()

/** A picture loaded again (from cache) as anonymous CORS, so drawing it does not taint the canvas. */
function picture(src: string, cors: boolean): Promise<HTMLImageElement | null> {
  const key = (cors ? 'c:' : '') + src
  let p = pics.get(key)
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image()
      if (cors) img.crossOrigin = 'anonymous'
      img.decoding = 'async'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = src
    })
    if (pics.size > 256) pics.clear()
    pics.set(key, p)
  }
  return p
}

const sameOrigin = (src: string) => {
  if (/^(data|blob):/.test(src)) return true
  try {
    return new URL(src, location.href).origin === location.origin
  } catch {
    return false
  }
}

const metricsCache = new Map<string, [number, number]>()

/** Ascent and descent of a font, CSS px: where the baseline sits in the box the browser gives a run of text. */
function metrics(ctx: Ctx, font: string, size: number): [number, number] {
  let m = metricsCache.get(font)
  if (!m) {
    ctx.font = font
    const t = ctx.measureText('Hg')
    m = [t.fontBoundingBoxAscent ?? size * 0.8, t.fontBoundingBoxDescent ?? size * 0.2]
    metricsCache.set(font, m)
  }
  return m
}

function path(ctx: Ctx, b: Box) {
  ctx.beginPath()
  if (b.r.some((v) => v > 0)) ctx.roundRect(b.x, b.y, b.w, b.h, b.r)
  else ctx.rect(b.x, b.y, b.w, b.h)
}

/** Padding, content boxes inside a border box: shrunk by `t r b l`, corners shrunk with them. */
function inset(b: Box, t: number, r: number, bo: number, l: number): Box {
  const [tl, tr, br, bl] = b.r
  return {
    x: b.x + l,
    y: b.y + t,
    w: Math.max(0, b.w - l - r),
    h: Math.max(0, b.h - t - bo),
    r: [Math.max(0, tl - Math.max(t, l)), Math.max(0, tr - Math.max(t, r)), Math.max(0, br - Math.max(bo, r)), Math.max(0, bl - Math.max(bo, l))],
  }
}

const sides = (cs: CSSStyleDeclaration, k: 'border' | 'padding') =>
  k === 'border'
    ? [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].map((v) => px(v) || 0)
    : [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map((v) => px(v) || 0)

function borderBox(r: { left: number; top: number; width: number; height: number }, cs: CSSStyleDeclaration): Box {
  const c = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius] as [string, string, string, string]
  return { x: r.left, y: r.top, w: r.width, h: r.height, r: radii(c, r.width, r.height) }
}

/** A gradient over `b` as a canvas fill, CSS's transparent stops kept the colour of their neighbours (canvas fades through black). */
function gradientFill(ctx: Ctx, layer: string, b: Box): { fill: CanvasGradient; draw: (ctx: Ctx) => void } | null {
  const g = parseGradient(layer, b.w, b.h)
  if (!g) return null
  let fill: CanvasGradient
  let draw: (ctx: Ctx) => void
  let length: number
  if (g.kind === 'linear') {
    length = g.length || 1
    const cx = b.x + b.w / 2
    const cy = b.y + b.h / 2
    const [dx, dy] = g.dir
    fill = ctx.createLinearGradient(cx - (dx * length) / 2, cy - (dy * length) / 2, cx + (dx * length) / 2, cy + (dy * length) / 2)
    draw = (c) => {
      c.fillStyle = fill
      c.fill()
    }
  } else {
    const cx = b.x + px(g.at[0], b.w)
    const cy = b.y + px(g.at[1], b.h)
    const near = [Math.min(cx - b.x, b.x + b.w - cx), Math.min(cy - b.y, b.y + b.h - cy)]
    const far = [Math.max(cx - b.x, b.x + b.w - cx), Math.max(cy - b.y, b.y + b.h - cy)]
    const lens = g.size.filter((s) => !/^(closest|farthest)-/.test(s))
    const key = g.size.find((s) => /^(closest|farthest)-/.test(s)) ?? 'farthest-corner'
    let rx: number
    let ry: number
    if (lens.length) {
      rx = px(lens[0], b.w)
      ry = lens[1] ? px(lens[1], b.h) : rx
    } else {
      const [sx, sy] = key.startsWith('closest') ? near : far
      if (g.circle) rx = ry = key.endsWith('side') ? (key.startsWith('closest') ? Math.min(sx, sy) : Math.max(sx, sy)) : Math.hypot(sx, sy)
      else {
        const k = key.endsWith('corner') ? Math.SQRT2 : 1
        rx = sx * k
        ry = sy * k
      }
    }
    rx = Math.max(rx, 0.01)
    ry = Math.max(ry, 0.01)
    length = rx
    fill = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
    draw = (c) => {
      c.save()
      c.translate(cx, cy)
      c.scale(1, ry / rx)
      c.fillStyle = fill
      c.fillRect(b.x - cx - 1, ((b.y - cy) * rx) / ry - 1, b.w + 2, (b.h * rx) / ry + 2)
      c.restore()
    }
  }
  const stops = placeStops(parseStops(g.stops, length))
  stops.forEach((s, i) => {
    const at = Math.min(1, Math.max(0, s.at))
    if (!clear(s.color)) return fill.addColorStop(at, s.color)
    const near = (d: number) => {
      for (let j = i + d; j >= 0 && j < stops.length; j += d) if (!clear(stops[j].color)) return rgba(stops[j].color)
      return null
    }
    const a = near(-1)
    const z = near(1)
    const none = (c: number[] | null) => (c ? `rgba(${c[0]},${c[1]},${c[2]},0)` : 'rgba(0,0,0,0)')
    fill.addColorStop(at, none(a ?? z))
    if (a && z) fill.addColorStop(at, none(z))
  })
  return { fill, draw }
}

/** A url() background layer (it waits on the picture). */
function urlLayer(layer: string, b: Box, size: string, pos: string, repeat: string, need: (p: Promise<unknown>) => void): Step | null {
  const m = /^url\(["']?(.*?)["']?\)$/.exec(layer)
  if (!m) return null
  let img: HTMLImageElement | null = null
  need(picture(m[1], !sameOrigin(m[1])).then((i) => (img = i)))
  return (ctx) => {
    if (!img?.naturalWidth) return
    const nw = img.naturalWidth
    const nh = img.naturalHeight
    let tw = nw
    let th = nh
    if (size === 'cover' || size === 'contain') ({ w: tw, h: th } = fit(size, nw, nh, b.w, b.h))
    else if (size !== 'auto' && size !== 'auto auto') {
      const [sw, sh = 'auto'] = size.split(/\s+/)
      tw = sw === 'auto' ? NaN : px(sw, b.w)
      th = sh === 'auto' ? NaN : px(sh, b.h)
      if (Number.isNaN(tw) && Number.isNaN(th)) [tw, th] = [nw, nh]
      else if (Number.isNaN(tw)) tw = (th * nw) / nh
      else if (Number.isNaN(th)) th = (tw * nh) / nw
    }
    const [px0, py0 = '50%'] = pos.split(/\s+/)
    const x0 = b.x + px(px0, b.w - tw)
    const y0 = b.y + px(py0, b.h - th)
    const rx = /^repeat|repeat-x|round|space/.test(repeat) && tw > 1
    const ry = (/^repeat(?!-x)/.test(repeat) || /round|space|repeat-y/.test(repeat)) && th > 1
    const xs = rx ? Math.ceil((x0 - b.x) / tw) : 0
    const ys = ry ? Math.ceil((y0 - b.y) / th) : 0
    for (let j = 0, y = y0 - ys * th; j < 64 && (j === 0 || (ry && y < b.y + b.h)); j++, y += th)
      for (let i = 0, x = x0 - xs * tw; i < 64 && (i === 0 || (rx && x < b.x + b.w)); i++, x += tw) ctx.drawImage(img, x, y, tw, th)
  }
}

function shadowSteps(cs: CSSStyleDeclaration, b: Box, pad: Box, inner: boolean): Step[] {
  const out: Step[] = []
  for (const s of parseShadows(cs.boxShadow)) {
    if (s.inset !== inner || clear(s.color === 'currentcolor' ? cs.color : s.color)) continue
    const color = s.color === 'currentcolor' ? cs.color : s.color
    if (!inner) {
      const shape: Box = { x: b.x - s.spread, y: b.y - s.spread, w: b.w + 2 * s.spread, h: b.h + 2 * s.spread, r: b.r.map((v) => (v > 0 ? Math.max(0, v + s.spread) : 0)) as Radii }
      out.push((ctx) => {
        const k = ctx.getTransform().a
        ctx.save()
        // never under the box itself, as CSS draws it
        ctx.beginPath()
        ctx.rect(b.x - OFF / 2, b.y - OFF / 2, OFF, OFF)
        if (b.r.some((v) => v > 0)) ctx.roundRect(b.x, b.y, b.w, b.h, b.r)
        else ctx.rect(b.x, b.y, b.w, b.h)
        ctx.clip('evenodd')
        ctx.shadowColor = color
        ctx.shadowBlur = s.blur * k
        ctx.shadowOffsetX = (s.x + OFF) * k
        ctx.shadowOffsetY = s.y * k
        ctx.fillStyle = '#000'
        path(ctx, { ...shape, x: shape.x - OFF })
        ctx.fill()
        ctx.restore()
      })
    } else {
      const hole = inset(pad, s.spread + s.y, s.spread - s.x, s.spread - s.y, s.spread + s.x)
      out.push((ctx) => {
        const k = ctx.getTransform().a
        ctx.save()
        path(ctx, pad)
        ctx.clip()
        const frame = (dx: number) => {
          ctx.beginPath()
          ctx.rect(pad.x - pad.w - s.blur * 2 + dx, pad.y - pad.h - s.blur * 2, pad.w * 3 + s.blur * 4, pad.h * 3 + s.blur * 4)
          if (hole.r.some((v) => v > 0)) ctx.roundRect(hole.x + dx, hole.y, hole.w, hole.h, hole.r)
          else ctx.rect(hole.x + dx, hole.y, hole.w, hole.h)
        }
        if (s.blur <= 0) {
          ctx.fillStyle = color
          frame(0)
          ctx.fill('evenodd')
        } else {
          ctx.shadowColor = color
          ctx.shadowBlur = s.blur * k
          ctx.shadowOffsetX = OFF * k
          ctx.fillStyle = '#000'
          frame(-OFF)
          ctx.fill('evenodd')
        }
        ctx.restore()
      })
    }
  }
  return out
}

/** Background, shadows and border of one box. */
function boxSteps(cs: CSSStyleDeclaration, b: Box, need: (p: Promise<unknown>) => void): Step[] {
  const out: Step[] = []
  const [bt, br, bb, bl] = sides(cs, 'border')
  const pad = inset(b, bt, br, bb, bl)
  out.push(...shadowSteps(cs, b, pad, false))
  const clipText = cs.backgroundClip === 'text' || (cs as unknown as Record<string, string>).webkitBackgroundClip === 'text'
  const area = cs.backgroundClip === 'padding-box' ? pad : cs.backgroundClip === 'content-box' ? inset(pad, ...(sides(cs, 'padding') as [number, number, number, number])) : b
  if (!clipText) {
    if (!clear(cs.backgroundColor))
      out.push((ctx) => {
        ctx.fillStyle = cs.backgroundColor
        path(ctx, area)
        ctx.fill()
      })
    if (cs.backgroundImage && cs.backgroundImage !== 'none') {
      const layers = splitTop(cs.backgroundImage, ',')
      const sizes = splitTop(cs.backgroundSize, ',')
      const poss = splitTop(cs.backgroundPosition, ',')
      const reps = splitTop(cs.backgroundRepeat, ',')
      // the first layer is on top: draw from the last
      for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i]
        if (layer.startsWith('url(')) {
          const step = urlLayer(layer, area, sizes[i % sizes.length] ?? 'auto', poss[i % poss.length] ?? '0% 0%', reps[i % reps.length] ?? 'repeat', need)
          if (step)
            out.push((ctx) => {
              ctx.save()
              path(ctx, area)
              ctx.clip()
              step(ctx)
              ctx.restore()
            })
        } else if (/gradient\(/.test(layer)) {
          out.push((ctx) => {
            const g = gradientFill(ctx, layer, area)
            if (!g) return
            ctx.save()
            path(ctx, area)
            ctx.clip()
            path(ctx, area)
            g.draw(ctx)
            ctx.restore()
          })
        }
      }
    }
  }
  out.push(...shadowSteps(cs, b, pad, true))
  const widths = [bt, br, bb, bl]
  const colors = [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor]
  const styles = [cs.borderTopStyle, cs.borderRightStyle, cs.borderBottomStyle, cs.borderLeftStyle]
  const shown = widths.map((w, i) => w > 0 && styles[i] !== 'none' && styles[i] !== 'hidden' && !clear(colors[i]))
  if (shown.some(Boolean)) {
    const even = shown.every(Boolean) && colors.every((c) => c === colors[0]) && widths.every((w) => w === widths[0])
    out.push((ctx) => {
      if (even) {
        ctx.fillStyle = colors[0]
        ctx.beginPath()
        if (b.r.some((v) => v > 0)) {
          ctx.roundRect(b.x, b.y, b.w, b.h, b.r)
          ctx.roundRect(pad.x, pad.y, pad.w, pad.h, pad.r)
        } else {
          ctx.rect(b.x, b.y, b.w, b.h)
          ctx.rect(pad.x, pad.y, pad.w, pad.h)
        }
        ctx.fill('evenodd')
        return
      }
      // sides of their own: straight, clipped to the rounded outline
      ctx.save()
      path(ctx, b)
      ctx.clip()
      const rects = [
        [b.x, b.y, b.w, bt],
        [b.x + b.w - br, b.y, br, b.h],
        [b.x, b.y + b.h - bb, b.w, bb],
        [b.x, b.y, bl, b.h],
      ]
      rects.forEach((r, i) => {
        if (!shown[i]) return
        ctx.fillStyle = colors[i]
        ctx.fillRect(r[0], r[1], r[2], r[3])
      })
      ctx.restore()
    })
  }
  return out
}

const transform = (s: string, t: string) => (t === 'uppercase' ? s.toUpperCase() : t === 'lowercase' ? s.toLowerCase() : t === 'capitalize' ? s.replace(/^\p{L}/u, (c) => c.toUpperCase()) : s)

function fontOf(cs: CSSStyleDeclaration) {
  return `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
}

/** The colour text is filled with; gradient text (background-clip: text) takes its first stop. */
function textColor(el: Element, cs: CSSStyleDeclaration): string {
  const fill = cs.webkitTextFillColor || cs.color
  if (!clear(fill)) return fill
  for (let e: Element | null = el; e; e = e.parentElement) {
    const s = e === el ? cs : getComputedStyle(e)
    const g = s.backgroundImage !== 'none' && /gradient\(/.test(s.backgroundImage) ? splitTop(s.backgroundImage, ',')[0] : ''
    const m = /\(\s*(?:[^,]*?,\s*)?((?:rgba?|oklch|oklab|color|hsla?)\([^)]*\)|#[0-9a-f]+)/i.exec(g)
    if (m) return m[1]
  }
  return cs.color
}

function textSteps(node: Text, el: Element, cs: CSSStyleDeclaration, ctx: Ctx, area: DOMRect): Step[] {
  const text = node.data
  if (!/\S/.test(text)) return []
  const font = fontOf(cs)
  const size = px(cs.fontSize) || 16
  const [asc, desc] = metrics(ctx, font, size)
  const color = textColor(el, cs)
  if (clear(color)) return []
  const spacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing
  const tt = cs.textTransform
  const under = /underline/.test(cs.textDecorationLine) && cs.textDecorationStyle !== 'none'
  const underColor = cs.textDecorationColor || color
  const thick = Math.max(1, px(cs.textDecorationThickness) || size / 14)
  const offset = px(cs.textUnderlineOffset) || 0
  const range = document.createRange()
  const runs: { s: string; x: number; y: number; w: number }[] = []
  const lines: { x0: number; x1: number; y: number }[] = []
  const add = (s: string, r: DOMRect) => {
    if (r.width === 0 || r.right < area.left || r.left > area.right || r.bottom < area.top || r.top > area.bottom) return
    const y = r.top + (r.height - (asc + desc)) / 2 + asc
    runs.push({ s, x: r.left, y, w: r.width })
    if (!under) return
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - y) < 1) last.x1 = r.right
    else lines.push({ x0: r.left, x1: r.right, y })
  }
  const words = /\S+/g
  for (let m = words.exec(text); m; m = words.exec(text)) {
    range.setStart(node, m.index)
    range.setEnd(node, m.index + m[0].length)
    const rects = range.getClientRects()
    if (rects.length === 1) add(transform(m[0], tt), rects[0])
    else if (rects.length > 1) {
      // broken across lines: letter by letter
      for (let i = 0; i < m[0].length; i++) {
        range.setStart(node, m.index + i)
        range.setEnd(node, m.index + i + 1)
        const r = range.getClientRects()[0]
        if (r) add(transform(m[0][i], tt === 'capitalize' && i ? 'none' : tt), r)
      }
    }
  }
  range.detach()
  if (!runs.length) return []
  return [
    (c) => {
      c.font = font
      ;(c as Ctx & { letterSpacing?: string }).letterSpacing = spacing
      c.textBaseline = 'alphabetic'
      c.textAlign = 'left'
      c.fillStyle = color
      // never wider than the browser made it, so a fallback font cannot run into the next word
      for (const r of runs) c.fillText(r.s, r.x, r.y, r.w + 1)
      c.fillStyle = underColor
      for (const l of lines) c.fillRect(l.x0, l.y + Math.max(1, desc * 0.35) + offset, l.x1 - l.x0, thick)
    },
  ]
}

/** An inline SVG as a picture: serialized with the styles that colour it inlined. */
function svgPicture(svg: SVGSVGElement, w: number, h: number, cs: CSSStyleDeclaration): Promise<HTMLImageElement | null> {
  const copy = svg.cloneNode(true) as SVGSVGElement
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copy.setAttribute('width', String(w))
  copy.setAttribute('height', String(h))
  copy.style.color = cs.color
  const from = svg.querySelectorAll('*')
  const to = copy.querySelectorAll('*')
  const keep = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity', 'fill-opacity', 'stroke-opacity', 'stop-color', 'stop-opacity', 'display', 'visibility']
  from.forEach((e, i) => {
    const s = getComputedStyle(e)
    const t = to[i] as SVGElement
    for (const k of keep) t.style.setProperty(k, s.getPropertyValue(k))
  })
  for (const k of ['fill', 'stroke']) copy.style.setProperty(k, cs.getPropertyValue(k))
  const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy))
  return picture(src, false)
}

const isPositioned = (cs: CSSStyleDeclaration) => cs.position !== 'static'
const zOf = (cs: CSSStyleDeclaration) => (cs.zIndex === 'auto' ? 0 : Number(cs.zIndex) || 0)

/** An absolutely placed ::before or ::after: its box, worked out from its containing block. */
function pseudoBox(el: Element, cs: CSSStyleDeclaration, ps: CSSStyleDeclaration, r: DOMRect): Box | null {
  if (ps.position !== 'absolute' && ps.position !== 'fixed') return null
  let cb: Element | null = ps.position === 'fixed' ? null : isPositioned(cs) ? el : (el as HTMLElement).offsetParent
  let left = 0
  let top = 0
  let w = innerWidth
  let h = innerHeight
  if (cb) {
    const cr = cb === el ? r : cb.getBoundingClientRect()
    const ccs = cb === el ? cs : getComputedStyle(cb)
    const [bt, br, bb, bl] = sides(ccs, 'border')
    left = cr.left + bl
    top = cr.top + bt
    w = cr.width - bl - br
    h = cr.height - bt - bb
  } else cb = null
  const pw = px(ps.width)
  const ph = px(ps.height)
  let x = px(ps.left, w)
  let y = px(ps.top, h)
  if (Number.isNaN(x)) x = w - px(ps.right, w) - pw
  if (Number.isNaN(y)) y = h - px(ps.bottom, h) - ph
  if ([pw, ph, x, y].some(Number.isNaN) || pw <= 0 || ph <= 0) return null
  return borderBox({ left: left + x, top: top + y, width: pw, height: ph }, ps)
}

/** Paints the page area into a canvas. The canvas is `width * scale` by `height * scale` device px. */
export async function paintPage(o: PaintOptions): Promise<HTMLCanvasElement> {
  const canvas = o.canvas ?? document.createElement('canvas')
  if (!o.canvas) {
    canvas.width = Math.round(o.width * o.scale)
    canvas.height = Math.round(o.height * o.scale)
  }
  const ctx = canvas.getContext('2d')!
  const area = new DOMRect(o.x, o.y, o.width, o.height)
  const waits: Promise<unknown>[] = []
  const need = (p: Promise<unknown>) => void waits.push(p)
  const steps: Step[] = []
  const meets = (r: { left: number; top: number; right: number; bottom: number }) => r.right >= area.left && r.left <= area.right && r.bottom >= area.top && r.top <= area.bottom

  const listIndex = (li: Element) => {
    let n = Number(li.parentElement?.getAttribute('start') ?? 1)
    for (let e = li.previousElementSibling; e; e = e.previousElementSibling) if (e.tagName === 'LI') n++
    return n
  }

  function replaced(el: Element, cs: CSSStyleDeclaration, content: Box) {
    const draw = (src: CanvasImageSource, nw: number, nh: number) => {
      const pos = cs.objectPosition.split(/\s+/).map((v) => (v.endsWith('%') ? Number(v.slice(0, -1)) / 100 : 0.5)) as [number, number]
      const f = fit(cs.objectFit || 'fill', nw, nh, content.w, content.h, pos)
      steps.push((c) => {
        c.save()
        path(c, content)
        c.clip()
        try {
          c.drawImage(src, content.x + f.x, content.y + f.y, f.w, f.h)
        } catch {
          // not drawable (a lost context, a broken picture): the box behind it shows
        }
        c.restore()
      })
    }
    if (el instanceof HTMLImageElement) {
      if (!el.complete || !el.naturalWidth) return
      const src = el.currentSrc || el.src
      if (sameOrigin(src) || el.crossOrigin != null) return draw(el, el.naturalWidth, el.naturalHeight)
      let copy: HTMLImageElement | null = null
      need(picture(src, true).then((i) => (copy = i)))
      steps.push((c) => {
        if (!copy?.naturalWidth) return
        const pos = cs.objectPosition.split(/\s+/).map((v) => (v.endsWith('%') ? Number(v.slice(0, -1)) / 100 : 0.5)) as [number, number]
        const f = fit(cs.objectFit || 'fill', copy.naturalWidth, copy.naturalHeight, content.w, content.h, pos)
        c.save()
        path(c, content)
        c.clip()
        c.drawImage(copy, content.x + f.x, content.y + f.y, f.w, f.h)
        c.restore()
      })
    } else if (el instanceof HTMLVideoElement) {
      const src = el.currentSrc || el.src
      if (el.readyState >= 2 && el.videoWidth && (sameOrigin(src) || el.crossOrigin != null)) return draw(el, el.videoWidth, el.videoHeight)
      if (el.poster) {
        let poster: HTMLImageElement | null = null
        need(picture(el.poster, !sameOrigin(el.poster)).then((i) => (poster = i)))
        steps.push((c) => {
          if (!poster?.naturalWidth) return
          const f = fit(cs.objectFit || 'contain', poster.naturalWidth, poster.naturalHeight, content.w, content.h)
          c.save()
          path(c, content)
          c.clip()
          c.drawImage(poster, content.x + f.x, content.y + f.y, f.w, f.h)
          c.restore()
        })
      }
    } else if (el instanceof HTMLCanvasElement) {
      if (el.width && el.height) draw(el, el.width, el.height)
    } else if (el instanceof SVGSVGElement) {
      let pic: HTMLImageElement | null = null
      need(svgPicture(el, content.w, content.h, cs).then((i) => (pic = i)))
      steps.push((c) => {
        if (pic?.naturalWidth) c.drawImage(pic, content.x, content.y, content.w, content.h)
      })
    } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const value = el.value || el.placeholder
      if (!value || el.type === 'checkbox' || el.type === 'radio' || el.type === 'range' || el.type === 'hidden') return
      const font = fontOf(cs)
      const size = px(cs.fontSize) || 16
      const [asc, desc] = metrics(ctx, font, size)
      const color = el.value ? cs.color : getComputedStyle(el, '::placeholder').color
      steps.push((c) => {
        c.save()
        path(c, content)
        c.clip()
        c.font = font
        c.fillStyle = color
        c.textBaseline = 'alphabetic'
        c.fillText(el.type === 'password' ? '•'.repeat(value.length) : value, content.x, content.y + (content.h - (asc + desc)) / 2 + asc)
        c.restore()
      })
    }
  }

  function pseudo(el: Element, cs: CSSStyleDeclaration, r: DOMRect, which: '::before' | '::after') {
    const ps = getComputedStyle(el, which)
    if (ps.content === 'none' || ps.content === 'normal' || ps.display === 'none' || ps.visibility !== 'visible') return
    const b = pseudoBox(el, cs, ps, r)
    if (!b || !meets({ left: b.x, top: b.y, right: b.x + b.w, bottom: b.y + b.h })) return
    const op = Number(ps.opacity)
    if (op <= 0) return
    steps.push((c) => {
      c.save()
      c.globalAlpha *= op
    })
    steps.push(...boxSteps(ps, b, need))
    steps.push((c) => c.restore())
  }

  function marker(el: Element, cs: CSSStyleDeclaration, content: Box) {
    const type = cs.listStyleType
    if (cs.display !== 'list-item' || type === 'none' || cs.listStyleImage !== 'none') return
    const mark = type === 'disc' ? '•' : type === 'circle' ? '◦' : type === 'square' ? '▪' : /decimal/.test(type) ? `${listIndex(el)}.` : null
    if (!mark) return
    const mcs = getComputedStyle(el, '::marker')
    const font = fontOf(mcs)
    const size = px(mcs.fontSize) || 16
    const [asc, desc] = metrics(ctx, font, size)
    const line = px(cs.lineHeight) || size * 1.4
    const y = content.y + (line - (asc + desc)) / 2 + asc
    const outside = cs.listStylePosition !== 'inside'
    const color = mcs.color || cs.color
    steps.push((c) => {
      c.font = font
      c.fillStyle = color
      c.textAlign = 'right'
      c.textBaseline = 'alphabetic'
      if (outside) c.fillText(mark, content.x - size * 0.4, y)
      c.textAlign = 'left'
    })
  }

  function children(el: Element, cs: CSSStyleDeclaration) {
    const below: [number, Element][] = []
    const flow: (Element | Text)[] = []
    const layered: Element[] = []
    const above: [number, Element][] = []
    for (const n of el.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) flow.push(n as Text)
      if (n.nodeType !== Node.ELEMENT_NODE) continue
      const e = n as Element
      if (NEVER.has(e.tagName)) continue
      const ecs = getComputedStyle(e)
      if (!isPositioned(ecs)) flow.push(e)
      else {
        const z = zOf(ecs)
        if (z < 0) below.push([z, e])
        else if (z > 0) above.push([z, e])
        else layered.push(e)
      }
    }
    const byZ = (a: [number, Element], b: [number, Element]) => a[0] - b[0]
    for (const [, e] of below.sort(byZ)) walk(e)
    for (const n of flow) {
      if (n instanceof Text) {
        if (cs.visibility === 'visible') steps.push(...textSteps(n, el, cs, ctx, area))
      } else walk(n)
    }
    for (const e of layered) walk(e)
    for (const [, e] of above.sort(byZ)) walk(e)
  }

  function walk(el: Element) {
    if (NEVER.has(el.tagName)) return
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || o.skip?.(el, cs)) return
    if (cs.display === 'contents') return children(el, cs)
    const r = el.getBoundingClientRect()
    if (!meets(r)) return
    const op = Number(cs.opacity)
    if (op <= 0.001) return
    steps.push((c) => {
      c.save()
      if (op < 1) c.globalAlpha *= op
    })
    const b = borderBox(r, cs)
    const [bt, br, bb, bl] = sides(cs, 'border')
    const pad = inset(b, bt, br, bb, bl)
    const [pt, pr, pb, pl] = sides(cs, 'padding')
    const content = inset(pad, pt, pr, pb, pl)
    const visible = cs.visibility === 'visible'
    if (visible && r.width > 0 && r.height > 0) {
      // an inline run broken over lines is a box per line, as its background shows
      const parts = cs.display === 'inline' ? el.getClientRects() : null
      if (parts && parts.length > 1) for (const p of parts) steps.push(...boxSteps(cs, borderBox(p, cs), need))
      else steps.push(...boxSteps(cs, b, need))
    }
    if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement || el instanceof HTMLCanvasElement || el instanceof SVGSVGElement || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      if (visible) replaced(el, cs, content)
    } else if (el instanceof SVGElement) {
      // inside an <svg> that was drawn whole
    } else {
      if (visible) marker(el, cs, content)
      const clips = cs.overflowX !== 'visible' || cs.overflowY !== 'visible'
      if (clips)
        steps.push((c) => {
          c.save()
          path(c, pad)
          c.clip()
        })
      pseudo(el, cs, r, '::before')
      children(el, cs)
      pseudo(el, cs, r, '::after')
      if (clips) steps.push((c) => c.restore())
    }
    steps.push((c) => c.restore())
  }

  walk(document.body)
  if (waits.length) await Promise.race([Promise.all(waits), new Promise((r) => setTimeout(r, o.wait ?? 1500))])
  ctx.save()
  ctx.setTransform(o.scale, 0, 0, o.scale, -o.x * o.scale, -o.y * o.scale)
  for (const s of steps) s(ctx)
  ctx.restore()
  return canvas
}
