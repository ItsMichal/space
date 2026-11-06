// The paper transition itself, loaded on demand by ./index.ts. Raw WebGL2, no scene library.
//
// 1. The visible viewport of the old page is painted into a canvas (lib/paint, the site's own capture, the glass lens uses it too)
//    over the backdrop, and laid on a coarse sheet in a fixed canvas over the page, at exactly the page's pixels.
// 2. The router renders the new page underneath at once; it is shown, live, as soon as it has committed.
// 3. The sheet crumples in one drop into a ball, landing like a bouncy ball, (drawn as unshaded line art: ink along the creases, a hard shadow
//    under it) while a fire eats it from the face. What burns lets go of a glyph in the site's monospace, in the page's colour and then
//    the fire's, an ember thrown out by the blast of the landing and carried off on swirling air (./embers.ts) until it goes out. The
//    sheet and the embers move every frame; the glyphs flicker on twos.
// The capture reads the page as laid out, a few tens of ms, and comes on top of PAPER_MS.
import { paintPage } from '@/lib/paint/page'
import { BACKDROP_DRAW } from '../backdrop/config'
import { IGNITE_MS, LEAD_MS, PAPER_ASH, PAPER_FPS, PAPER_MS } from './config'
import { type Blast, air, embers, seeded, spawn, STEP_MS, step } from './embers'
import { ASH_FS, EMBER_FS, EMBER_VS, QUAD_VS, SHADE_FS, SHEET_FS, SHEET_VS, SOFT_FS } from './shaders'
import { type Design, PATTERNS, type Piece, foldsAt, mesh, packet, pieces, place, pose, reaches } from './origami'
import { flickerAt, frameAt, type Frame, randomCrumple, waitingAt } from './timeline'

const MAX_DPR = 2
/** Cells along the sheet's long side: fine enough that the creases are lines and the paper between them curves. */
const CELLS = 128
/** A glyph cell, CSS px (the hero globe's cell). */
const GLYPH_W = 8
const GLYPH_H = 13
/** The glyphs of the burning edge, sparse to dense. */
const RAMP = '.:-=+*#%@'
/** The embers' glyphs, in tiers sparse to dense: each ember picks its own within its tier, so no two drift alike. */
const TIERS = ['.`\',', ':;-~^"', '=+!|/\\<>', '*()?{}[]', '#%&$', '@&#']
/** Every glyph drawn: the edge's ramp first, then the embers' (one atlas). */
const ATLAS = RAMP + [...new Set(TIERS.join(''))].join('')
const TIER_AT = TIERS.map((t) => [...t].map((c) => ATLAS.indexOf(c)))
/** The share of burnt cells that let go of an ember. */
const SPAWN = 0.4
/** How deep the burning edge of glyphs runs ahead of the fire, in burn units. */
const EDGE = 0.05
/** A burnt cell lets go of its ember while its burn is this fresh, in burn units, and again no sooner than this, ms. */
const FRESH = 0.3
const COOLDOWN_MS = 250
/** Nothing may hold the overlay longer than this. */
const WATCHDOG_MS = 8000
/** How long the waiting fringes take to settle once the drop leaves, ms. */
const SWING_OUT_MS = 120
/** The longest the drop waits for the new page's images on screen, ms. */
const IMAGES_MS = 1500
const FOV = (32 * Math.PI) / 180
/** How much of the bloom the edge curl takes to let go, before the first fold starts. */
const CURL_OUT = 0.06
/** The most of the lead-in's and the wait's edge curl, in the timeline's ball (LEAD_BALL + WAIT_BALL); it lets go as the folding starts. */
const FOLD_FROM = 0.105
/** How much of the crumple's turn the finished flower keeps. */
const LEAN = 0.3
/** How far the page is lifted toward the camera before it crumples, as a share of the camera's distance: a little, about 5% larger,
 * so while the new route loads the old page overhangs every edge and still covers it all. */
const LIFT = 0.05
/** The most of the screen's width or height the finished flower takes. */
const FIT = 0.7
/** The shadow map's size, one texel for this many screen pixels each way. */
const SHADOW_DOWN = 4
/** The way a shadow is thrown, px along the floor for each px of height: the key light from the upper left, high over the page. */
const LIGHT: [number, number] = [0.32, -0.4]
/** How dark the paper's shadow on itself gets, 0 to 1 of the key light. */
const SELF_SHADOW = 0.55

const mono = () => getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() || 'ui-monospace, monospace'

/** The glyph strip, one cell per glyph, white on clear, in device px. */
function glyphAtlas(cw: number, ch: number) {
  const c = document.createElement('canvas')
  c.width = cw * ATLAS.length
  c.height = ch
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.font = `500 ${Math.round(ch * 0.86)}px ${mono()}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (let i = 0; i < ATLAS.length; i++) g.fillText(ATLAS[i], (i + 0.5) * cw, ch * 0.54)
  return c
}

const frame = () => new Promise<number>((r) => requestAnimationFrame(r))

function rgb(css: string): [number, number, number] {
  const c = document.createElement('canvas').getContext('2d')!
  c.fillStyle = css
  const v = c.fillStyle as string
  if (v.startsWith('#')) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16) / 255) as [number, number, number]
  const m = v.match(/[\d.]+/g) ?? ['0', '0', '0']
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255]
}

/** Elements that are not part of the sheet: the nav (stays live on top), the overlay, the backdrop (drawn under the shot). */
function skip(el: Element, cs: CSSStyleDeclaration): boolean {
  if (el.classList.contains('nav-glass') || el.classList.contains('nav-scrim') || el.classList.contains('paper-overlay')) return true
  if (el.classList.contains('paper-grid__gl')) return true
  return cs.position === 'fixed' && !el.classList.contains('paper-grid')
}

/** The visible viewport as an opaque sheet: paper colour, the live backdrop frame, then the page. */
async function capture(w: number, h: number, scale: number): Promise<HTMLCanvasElement> {
  const out = document.createElement('canvas')
  out.width = Math.round(w * scale)
  out.height = Math.round(h * scale)
  const ctx = out.getContext('2d')!
  ctx.fillStyle = getComputedStyle(document.documentElement).backgroundColor || '#f4f1e8'
  ctx.fillRect(0, 0, out.width, out.height)
  const gl = document.querySelector<HTMLCanvasElement>('.paper-grid__gl[data-ready]')
  if (gl) {
    const r = gl.getBoundingClientRect()
    try {
      // drawn now, in this task: between its own draws its bitmap is the cleared one, opaque black
      gl.dispatchEvent(new Event(BACKDROP_DRAW))
      ctx.globalAlpha = Number(getComputedStyle(gl).opacity) || 1
      ctx.drawImage(gl, r.left * scale, r.top * scale, r.width * scale, r.height * scale)
    } catch {
      // a tainted or lost backdrop: the paper colour stands in
    }
    ctx.globalAlpha = 1
  }
  // the page as it is on screen now (lib/paint), pictures it has to fetch again given a moment at most
  return paintPage({ x: 0, y: 0, width: w, height: h, scale, skip, canvas: out, wait: 300 })
}

function perspective(fov: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fov / 2)
  const nf = 1 / (near - far)
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]
}

function rotation(x: number, y: number, z: number) {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(x), Math.sin(x), Math.cos(y), Math.sin(y), Math.cos(z), Math.sin(z)]
  // R = Rz * Ry * Rx, column-major
  return [cy * cz, cy * sz, -sy, sx * sy * cz - cx * sz, sx * sy * sz + cx * cz, sx * cy, cx * sy * cz + sx * sz, cx * sy * sz - sx * cz, cx * cy]
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const p = gl.createProgram()!
  for (const [type, src] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`[paper] shader: ${gl.getShaderInfoLog(s)}`)
    gl.attachShader(p, s)
  }
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`[paper] link: ${gl.getProgramInfoLog(p)}`)
  const u = new Proxy({} as Record<string, WebGLUniformLocation | null>, { get: (c, k: string) => (k in c ? c[k] : (c[k] = gl.getUniformLocation(p, k))) })
  return { p, u }
}
/** A fixed jitter for a mesh vertex, -0.5 to 0.5. */
const jit = (i: number, j: number, k: number) => {
  const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453
  return s - Math.floor(s) - 0.5
}

function createStage(w: number, h: number, dpr: number) {
  const canvas = document.createElement('canvas')
  canvas.className = 'paper-overlay'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, depth: true, stencil: false })
  if (!gl) throw new Error('[paper] no WebGL2')

  const sheet = program(gl, SHEET_VS, SHEET_FS)
  const ash = program(gl, QUAD_VS, ASH_FS)
  const ember = program(gl, EMBER_VS, EMBER_FS)
  const soft = program(gl, QUAD_VS, SOFT_FS)
  const shade = program(gl, QUAD_VS, SHADE_FS)

  // sheet mesh: a grid of uv, the inner vertices nudged off the grid so it does not read as one, the edges kept straight
  const cols = w >= h ? CELLS : Math.max(8, Math.round((CELLS * w) / h))
  const rows = w >= h ? Math.max(8, Math.round((CELLS * h) / w)) : CELLS
  const uv = new Float32Array((cols + 1) * (rows + 1) * 2)
  for (let j = 0, k = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++, k += 2) {
      const inner = i > 0 && i < cols && j > 0 && j < rows
      uv[k] = (i + (inner ? 0.35 * jit(i, j, 0) : 0)) / cols
      uv[k + 1] = (j + (inner ? 0.35 * jit(i, j, 1) : 0)) / rows
    }
  }
  const idx = new Uint16Array(cols * rows * 6)
  for (let j = 0, k = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i
      const b = a + 1
      const c = a + cols + 1
      const d = c + 1
      // the diagonal alternates, so the triangles do not all lean one way
      idx.set((i + j) % 2 ? [a, c, b, b, c, d] : [a, c, d, a, d, b], k)
      k += 6
    }
  const sheetVao = gl.createVertexArray()
  gl.bindVertexArray(sheetVao)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW)
  const aUv = gl.getAttribLocation(sheet.p, 'a_uv')
  gl.enableVertexAttribArray(aUv)
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW)
  const quadVao = gl.createVertexArray()
  gl.bindVertexArray(quadVao)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  // read at location 0 (QUAD_VS)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)

  const texture = (unit: number, src: TexImageSource, smooth: boolean) => {
    const t = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
    if (smooth) gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, smooth ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, smooth ? gl.LINEAR : gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }
  let page: WebGLTexture | null = null
  const setPage = (src: HTMLCanvasElement) => {
    if (page) gl.deleteTexture(page)
    page = texture(0, src, true)
  }

  // the glyphs, and one texel per glyph cell for what burnt under it (page colour, age); the cells get a depth buffer of their
  // own so the front of the ball wins over its back
  const cw = Math.max(4, Math.round(GLYPH_W * dpr))
  const ch = Math.max(6, Math.round(GLYPH_H * dpr))
  const glyphs = texture(2, glyphAtlas(cw, ch), false)
  const gridW = Math.ceil(canvas.width / cw)
  const gridH = Math.ceil(canvas.height / ch)
  const cells = gl.createTexture()
  gl.activeTexture(gl.TEXTURE3)
  gl.bindTexture(gl.TEXTURE_2D, cells)
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, gridW, gridH)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  const cellsFb = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, cellsFb)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, cells, 0)
  const cellsDepth = gl.createRenderbuffer()
  gl.bindRenderbuffer(gl.RENDERBUFFER, cellsDepth)
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, gridW, gridH)
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, cellsDepth)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  // the shadow map at a quarter of the screen (its depth the paper's height, so the highest wins), and the floor shadow blurred
  // from it at the same size: small enough that both cost next to nothing
  const maskW = Math.max(1, Math.ceil(canvas.width / SHADOW_DOWN))
  const maskH = Math.max(1, Math.ceil(canvas.height / SHADOW_DOWN))
  const target = (unit: number, smooth: boolean, depth: boolean) => {
    const tex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, maskW, maskH)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, smooth ? gl.LINEAR : gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, smooth ? gl.LINEAR : gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    if (depth) {
      const rb = gl.createRenderbuffer()
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb)
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, maskW, maskH)
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { tex, fb }
  }
  const mask = target(4, false, true)
  const softShadow = target(5, true, false)

  // the embers: a unit quad, and per ember its place, glyph and colour (7 floats)
  const emberVao = gl.createVertexArray()
  gl.bindVertexArray(emberVao)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  const emberBuf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, emberBuf)
  for (const [loc, size, at] of [
    [1, 2, 0],
    [2, 1, 2],
    [3, 4, 3],
  ] as const) {
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 28, at * 4)
    gl.vertexAttribDivisor(loc, 1)
  }
  gl.bindVertexArray(null)

  const minDim = Math.min(w, h)
  // the ball keeps the sheet area in mind, so a tall phone page still makes a loose, fist-sized wad
  const R = Math.min(0.2 * Math.sqrt(w * h), 0.4 * minDim)
  const D = h / 2 / Math.tan(FOV / 2)
  const vp = perspective(FOV, w / h, D * 0.1, D * 4)
  // view = translate(0, 0, -D): only the last column of the projection changes
  vp[12] += vp[8] * -D
  vp[13] += vp[9] * -D
  vp[14] += vp[10] * -D
  vp[15] += vp[11] * -D
  // the site's palette, as the current theme sets it
  const css = getComputedStyle(document.documentElement)
  const token = (name: string, fallback: string) => rgb(css.getPropertyValue(name).trim() || fallback)
  const paper = token('--paper', '#f4f1e8')
  const ink = token('--ink', '#18211b')
  const back = paper.map((c) => c * 0.97)
  const lum = (c: number[]) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
  const fire = {
    hot: token('--presence-5', '#9a7a00'),
    flame: token('--presence-4', '#c9592a'),
    rose: token('--presence-6', '#b04462'),
    cool: token('--ink-faint', '#7f8777'),
    // char is the darker of paper and ink, whichever the theme makes it
    char: lum(ink) < lum(paper) ? ink : paper.map((c) => c * 0.6),
  }

  let drawing = 0
  let stopped = false
  // this run's own crumple: which way it turns, twirls and gathers, and where its folds fall
  const crumple = randomCrumple()
  // and the flower it folds into: its folds, fixed for the run, and how far each is made, set per frame
  let placedFor = ''
  let flowerName = ''
  let flower: Design = { folds: [], turn: 0 }
  let bloom: [number, number] = [0, 0]
  let fit = 1
  let plates: Piece[] = []
  let reach: number[] = []
  let plateFlat = new Float32Array(0)
  let plateOf = new Uint16Array(0)
  let plateIndex = new Uint32Array(0)
  let platePos = new Float32Array(0)
  let plateNrm = new Float32Array(0)
  let plateCount = 0
  const plateUvBuffer = gl.createBuffer()
  const platePosBuffer = gl.createBuffer()
  const plateNrmBuffer = gl.createBuffer()
  const plateIdxBuffer = gl.createBuffer()
  const platesVao = gl.createVertexArray()
  gl.bindVertexArray(platesVao)
  gl.bindBuffer(gl.ARRAY_BUFFER, plateUvBuffer)
  gl.enableVertexAttribArray(aUv)
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0)
  for (const [buffer, name] of [
    [platePosBuffer, 'a_pos'],
    [plateNrmBuffer, 'a_nrm'],
  ] as const) {
    const at = gl.getAttribLocation(sheet.p, name)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.enableVertexAttribArray(at)
    gl.vertexAttribPointer(at, 3, gl.FLOAT, false, 0, 0)
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, plateIdxBuffer)
  gl.bindVertexArray(null)
  const fold = (name: string) => {
    flowerName = name
    flower = PATTERNS[name](w, h)
    const box = packet(flower.folds, w, h, flower.turn)
    bloom = box.center
    // a flower wider or taller than the screen leaves room round it, so no petal is cut by the edge
    fit = Math.min(1, (FIT * w) / box.size[0], (FIT * h) / box.size[1])
    // the folding sheet is drawn as its pieces cut fine, so the bends curve, placed every frame
    plates = pieces(flower.folds, w, h)
    reach = reaches(flower.folds, plates)
    const m = mesh(flower.folds, plates, Math.max(6, minDim / 64))
    plateFlat = m.flat
    plateOf = m.of
    plateIndex = m.index
    plateCount = m.index.length
    platePos = new Float32Array(m.of.length * 3)
    plateNrm = new Float32Array(m.of.length * 3)
    const plateUv = new Float32Array(m.of.length * 2)
    for (let v = 0; v < m.of.length; v++) plateUv.set([m.flat[2 * v] / w + 0.5, 0.5 - m.flat[2 * v + 1] / h], 2 * v)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, plateUvBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, plateUv, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, platePosBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, platePos, gl.DYNAMIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, plateNrmBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, plateNrm, gl.DYNAMIC_DRAW)
    gl.bindVertexArray(platesVao)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.index, gl.STATIC_DRAW)
    gl.bindVertexArray(null)
    placedFor = ''
  }
  fold(crumple.flower)

  // the embers' sim: the blast from the middle of the ball as it lands, this run's air, and the burnt cells read back to spawn from
  const runSeed = Math.floor(Math.random() * 2 ** 31)
  const scale = Math.min(canvas.width, canvas.height)
  const blast: Blast = { cx: canvas.width / 2, cy: canvas.height / 2, at: IGNITE_MS, scale, waves: air(scale, seeded(runSeed)) }
  const sparks = embers()
  const instances = new Float32Array(sparks.x.length * 7)
  const read = new Uint8Array(gridW * gridH * 4)
  const lastSpawn = new Float32Array(gridW * gridH)
  let rand = seeded(runSeed + 1)
  let simMs = 0
  const freshMax = 64 + (191 * FRESH) / PAPER_ASH
  const resetSim = () => {
    sparks.n = 0
    lastSpawn.fill(-1e9)
    rand = seeded(runSeed + 1)
    simMs = 0
  }
  resetSim()

  /** Whether the sheet throws a shadow: once it is lifted off the page or gathered. */
  const shadows = (s: Frame) => s.ball > 0 || s.lift > 0

  /** state: 0 the sheet, 1 the burn state per glyph cell, 2 the shadow map. */
  const drawSheet = (s: Frame, state: 0 | 1 | 2) => {
    gl.useProgram(sheet.p)
    const u = sheet.u
    gl.uniform2f(u.u_size, w, h)
    // in development `window.__paperFlower = '<name>'` swaps the flower, for screenshots
    if (process.env.NODE_ENV !== 'production') {
      const want = (window as { __paperFlower?: string }).__paperFlower
      if (want && want !== flowerName && want in PATTERNS) fold(want)
    }
    // the lead-in and the wait only curl the edges, as the crumple did; past that the folding takes over and the curl lets go
    // the curl lets go over the first of the bloom, before any fold is made, so the flat sheet hands over to its plates unchanged
    const t = s.bloom
    const curl = Math.min(s.ball, FOLD_FROM) * (1 - Math.min(1, t / CURL_OUT))
    const folding = Math.max(0, (t - CURL_OUT) / (1 - CURL_OUT))
    gl.uniform1f(u.u_ball, curl)
    gl.uniform2f(u.u_seed, ...crumple.seed)
    gl.uniform1f(u.u_twirl, crumple.twirl)
    gl.uniform2f(u.u_lead, ...crumple.lead)
    gl.uniform1f(u.u_fold, curl)
    gl.uniform1f(u.u_lit, Math.min(1, folding * 4))
    const made = foldsAt(folding, flower.folds.length)
    // the flower drawn to the middle as it closes, so it finishes centred
    const e = t * t * (3 - 2 * t)
    gl.uniform2f(u.u_shift, bloom[0] * e, bloom[1] * e)
    gl.uniform1f(u.u_paper, e)
    gl.uniform1f(u.u_turn, flower.turn * e)
    gl.uniform1f(u.u_fit, 1 + (fit - 1) * e)
    gl.uniform1f(u.u_R, R)
    // squash and stretch on screen, volume kept: wider and shorter when squished (rows of the column-major matrix)
    const sy = 1 - s.squash
    const sxz = 1 / Math.sqrt(sy)
    // a folded flower is not a ball: it keeps only a little of the crumple's tumble, a slight lean that shows its relief
    const spin = s.spin.map((v) => v * (1 - (1 - LEAN) * e)) as [number, number, number]
    gl.uniformMatrix3fv(u.u_rot, false, rotation(...spin).map((v, i) => v * (i % 3 === 1 ? sy : sxz)))
    const cz = R * 0.5 * s.ball + LIFT * D * s.lift
    gl.uniform3f(u.u_center, 0, 0, cz)
    gl.uniformMatrix4fv(u.u_vp, false, vp)
    gl.uniform1i(u.u_a, 0)
    gl.uniform1f(u.u_burn, s.burn)
    gl.uniform1f(u.u_ash, PAPER_ASH)
    gl.uniform1f(u.u_edge, EDGE)
    gl.uniform1f(u.u_state, state)
    gl.uniform1f(u.u_shadow, state === 2 ? 1 : 0)
    // the floor the shadow falls on: behind the crumpled ball, and as the flower closes it comes up under it, so the flower rests
    // on it with a close shadow, its petals standing a little off it
    gl.uniform1f(u.u_floor, -0.55 * R * s.ball * (1 - e) + (cz - 0.1 * R) * e)
    gl.uniform1f(u.u_hmax, minDim)
    gl.uniform2f(u.u_light, ...LIGHT)
    gl.uniform1i(u.u_mask, 4)
    gl.uniform1f(u.u_texel, (SHADOW_DOWN * w) / canvas.width)
    // the paper shades itself only while the shadow map is drawn
    gl.uniform1f(u.u_selfA, shadows(s) ? SELF_SHADOW : 0)
    gl.uniform3fv(u.u_back, back)
    gl.uniform3fv(u.u_char, fire.char)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, page)
    gl.uniform1f(u.u_plates, curl > 0 ? 0 : 1)
    if (curl > 0) {
      gl.bindVertexArray(sheetVao)
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0)
      return
    }
    // placed once a frame, not again for the burn cells and the shadow drawn from the same frame; each vertex's normal the sum of
    // its triangles' (weighted by their size), so the bends shade smoothly and a vertex on a crease takes its own side's
    const key = flowerName + made.join()
    if (placedFor !== key) {
      placedFor = key
      const at = pose(flower.folds, made, reach)
      for (let v = 0; v < plateOf.length; v++)
        platePos.set(place(flower.folds, plates[plateOf[v]].moves, at, plateFlat[2 * v], plateFlat[2 * v + 1]), 3 * v)
      plateNrm.fill(0)
      const P = platePos
      for (let i = 0; i < plateIndex.length; i += 3) {
        const [a, b, c] = [3 * plateIndex[i], 3 * plateIndex[i + 1], 3 * plateIndex[i + 2]]
        const [ax, ay, az] = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]]
        const [bx, by, bz] = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]]
        const n = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx]
        for (const v of [a, b, c]) for (let j = 0; j < 3; j++) plateNrm[v + j] += n[j]
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, platePosBuffer)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, platePos)
      gl.bindBuffer(gl.ARRAY_BUFFER, plateNrmBuffer)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, plateNrm)
    }
    gl.bindVertexArray(platesVao)
    gl.drawElements(gl.TRIANGLES, plateCount, gl.UNSIGNED_INT, 0)
  }

  /** The burn state per glyph cell, into `cells`; read back into `read` too when asked. */
  const burnCells = (s: Frame, readBack: boolean) => {
    gl.disable(gl.BLEND)
    gl.enable(gl.DEPTH_TEST)
    gl.bindFramebuffer(gl.FRAMEBUFFER, cellsFb)
    gl.viewport(0, 0, gridW, gridH)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    drawSheet(s, 1)
    if (readBack) gl.readPixels(0, 0, gridW, gridH, gl.RGBA, gl.UNSIGNED_BYTE, read)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  /** Runs the embers on to `ms` in fixed steps: each step every freshly burnt cell lets go of its ember, then they all move. */
  const advance = (ms: number) => {
    while (simMs + STEP_MS <= ms) {
      const t = simMs + STEP_MS
      const s = frameAt(t / PAPER_MS, crumple)
      // cells are freshly burnt only while the front crosses the sheet and a little after
      if (s.burn > 0 && s.burn < 1 + FRESH) {
        burnCells(s, true)
        for (let j = 0, k = 0; j < gridH; j++)
          for (let i = 0; i < gridW; i++, k++) {
            const a = read[k * 4 + 3]
            if (a < 64 || a > freshMax || t - lastSpawn[k] < COOLDOWN_MS) continue
            lastSpawn[k] = t
            if (rand() > SPAWN) continue
            const rgb: [number, number, number] = [read[k * 4] / 255, read[k * 4 + 1] / 255, read[k * 4 + 2] / 255]
            // where it burnt through text (anything well off the paper colour) it starts in that colour
            const off = Math.hypot(rgb[0] - paper[0], rgb[1] - paper[1], rgb[2] - paper[2])
            const ink = Math.min(1, Math.max(0, (off - 0.15) / 0.25))
            spawn(sparks, blast, (i + rand()) * cw, (j + rand()) * ch, t, PAPER_MS - 20, rgb, ink, rand)
          }
      }
      step(sparks, blast, t, STEP_MS)
      simMs = t
    }
  }

  const mix3 = (a: number[], b: number[], k: number) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
  }
  /** Hot to cold in the site's palette (the theme's own values, so it reads on the paper in light and in dark): gold, rust, rose,
   * then the faint ink of ash. */
  const emberColor = (u: number) => mix3(mix3(mix3(fire.hot, fire.flame, smooth(0.05, 0.3, u)), fire.rose, smooth(0.3, 0.65, u)), fire.cool, smooth(0.65, 0.95, u))

  const drawEmbers = () => {
    const e = sparks
    for (let i = 0; i < e.n; i++) {
      const u = Math.min(1, (simMs - e.born[i]) / e.life[i])
      const h = Math.sin((e.seed[i] * 917.3 + drawing * 1.31) * 12.9898) * 43758.5453
      const flick = (h - Math.floor(h) - 0.5) * 1.6
      const tier = TIER_AT[Math.min(TIERS.length - 1, Math.max(0, Math.round((1 - u) * (1 - u) * (TIERS.length - 1) + flick)))]
      // its own glyph in the tier, now and then another on the flicker
      const g = tier[Math.floor((e.seed[i] * 7919 + (h - Math.floor(h) > 0.8 ? drawing : 0)) % tier.length)]
      // it starts as the page it burnt from (text keeps its colour a little longer), then heats into the fire's colours
      const c = mix3(emberColor(u), [e.r[i], e.g[i], e.b[i]], 1 - smooth(0.04 + 0.06 * e.ink[i], 0.24 + 0.08 * e.ink[i], u))
      const alpha = 1 - smooth(0.7, 1, u)
      instances.set([e.x[i], e.y[i], g, c[0] * alpha, c[1] * alpha, c[2] * alpha, alpha], i * 7)
    }
    gl.useProgram(ember.p)
    gl.uniform2f(ember.u.u_canvas, canvas.width, canvas.height)
    gl.uniform2i(ember.u.u_cellPx, cw, ch)
    gl.uniform1i(ember.u.u_glyphs, 2)
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, glyphs)
    gl.bindVertexArray(emberVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, emberBuf)
    gl.bufferData(gl.ARRAY_BUFFER, instances.subarray(0, e.n * 7), gl.STREAM_DRAW)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, e.n)
  }

  const draw = (s: Frame) => {
    const lit = s.burn > -EDGE
    if (lit) burnCells(s, false)
    gl.disable(gl.BLEND)
    gl.enable(gl.DEPTH_TEST)
    if (shadows(s)) {
      // the shadow map: unbound from its sampler while it is drawn into
      gl.activeTexture(gl.TEXTURE4)
      gl.bindTexture(gl.TEXTURE_2D, null)
      gl.bindFramebuffer(gl.FRAMEBUFFER, mask.fb)
      gl.viewport(0, 0, maskW, maskH)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      drawSheet(s, 2)
      gl.activeTexture(gl.TEXTURE4)
      gl.bindTexture(gl.TEXTURE_2D, mask.tex)
      // the floor shadow blurred from it, as wide as the paper is high
      gl.disable(gl.DEPTH_TEST)
      gl.bindFramebuffer(gl.FRAMEBUFFER, softShadow.fb)
      gl.useProgram(soft.p)
      gl.uniform1i(soft.u.u_mask, 4)
      gl.uniform1f(soft.u.u_hmax, minDim)
      gl.uniform1f(soft.u.u_texel, (SHADOW_DOWN * w) / canvas.width)
      // it comes in as the sheet lifts off the page, or gathers
      gl.uniform1f(soft.u.u_shadowA, Math.max(0.16 * Math.min(1, s.ball / 0.3), 0.1 * s.lift))
      gl.bindVertexArray(quadVao)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    if (shadows(s)) {
      // the floor shadow first, under the sheet
      gl.disable(gl.DEPTH_TEST)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.useProgram(shade.p)
      gl.uniform1i(shade.u.u_soft, 5)
      gl.uniform2f(shade.u.u_px, 1 / (maskW * SHADOW_DOWN), 1 / (maskH * SHADOW_DOWN))
      gl.uniform3fv(shade.u.u_char, fire.char)
      gl.bindVertexArray(quadVao)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.disable(gl.BLEND)
      gl.enable(gl.DEPTH_TEST)
    }
    drawSheet(s, 0)
    if (lit) {
      // the burning edge and the embers over everything, in front of what is left of the sheet
      gl.disable(gl.DEPTH_TEST)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.useProgram(ash.p)
      gl.uniform1i(ash.u.u_cells, 3)
      gl.uniform1i(ash.u.u_glyphs, 2)
      gl.uniform2i(ash.u.u_cellPx, cw, ch)
      gl.uniform1i(ash.u.u_count, RAMP.length)
      gl.uniform1f(ash.u.u_drawing, drawing)
      gl.uniform3fv(ash.u.u_hot, fire.hot)
      gl.uniform3fv(ash.u.u_flame, fire.flame)
      gl.uniform3fv(ash.u.u_char, fire.char)
      gl.activeTexture(gl.TEXTURE2)
      gl.bindTexture(gl.TEXTURE_2D, glyphs)
      gl.activeTexture(gl.TEXTURE3)
      gl.bindTexture(gl.TEXTURE_2D, cells)
      gl.bindVertexArray(quadVao)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (sparks.n > 0) drawEmbers()
      gl.disable(gl.BLEND)
    }
    gl.bindVertexArray(null)
  }

  /** Where the clock waits for a slow route: the lead-in's end, or just before the fire catches if that is earlier. */
  const HOLD_MS = Math.min(LEAD_MS, IGNITE_MS - 1)

  /** Plays the whole animation, drawn every frame. In development `window.__paperHold = <0 to 1>` stops it there, for screenshots,
   * and `window.__paperScrub(T)` then draws any other point of it. The drop waits in the lead-in, before the fire catches, until `ready` resolves
   * (the new route has committed under the sheet). */
  const play = async (ready: Promise<unknown>) => {
    const hold = process.env.NODE_ENV !== 'production' ? (window as { __paperHold?: number }).__paperHold : undefined
    let loaded = false
    void ready.then(() => (loaded = true))
    let t0 = performance.now()
    // how long the drop has waited for the route, and how far into the drop the waiting swing has eased out
    let waited = 0
    let leftAt = 0
    for (;;) {
      const now = await frame()
      if (stopped) return
      // still loading: the clock stops in the lead-in just short of the fire catching (it would hold a half-burnt sheet after that),
      // the sheet held before the drop, its fringes working
      if (!loaded && now - t0 > HOLD_MS) {
        waited += now - t0 - HOLD_MS
        t0 = now - HOLD_MS
        leftAt = now
      }
      const ms = Math.min(now - t0, PAPER_MS)
      const fade = waited > 0 ? Math.max(0, 1 - (now - leftAt) / SWING_OUT_MS) : 0
      const at = (T: number) => (fade > 0 ? waitingAt(frameAt(T, crumple), waited + (now - leftAt), fade * fade * (3 - 2 * fade)) : frameAt(T, crumple))
      const T = ms / PAPER_MS
      if (hold != null && T >= hold) {
        // the embers are a sim: a held or scrubbed point replays it from the start
        const show = (T: number) => {
          resetSim()
          advance(T * PAPER_MS)
          drawing = flickerAt(T * PAPER_MS, PAPER_FPS)
          draw(frameAt(T, crumple))
        }
        show(hold)
        ;(window as { __paperScrub?: (T: number) => void }).__paperScrub = show
        // held for inspection until the page is reloaded, or the next navigation takes over
        while (!stopped) await frame()
        return
      }
      advance(ms)
      drawing = flickerAt(ms, PAPER_FPS)
      draw(at(T))
      if (T >= 1) return
    }
  }

  const destroy = () => {
    stopped = true
    canvas.remove()
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }

  return { canvas, setPage, draw, play, destroy }
}

/** Resolves once the images on screen in the new page have loaded and decoded, or after IMAGES_MS at most. */
function imagesOnScreen(): Promise<void> {
  const shown = [...document.images].filter((img) => {
    const r = img.getBoundingClientRect()
    return r.bottom > 0 && r.top < innerHeight && r.width > 0 && !img.complete
  })
  const all = Promise.all(shown.map((img) => img.decode().catch(() => undefined)))
  return Promise.race([all.then(() => undefined), new Promise<void>((r) => setTimeout(r, IMAGES_MS))])
}

/** Ends the transition on screen, if any, at once: a newer navigation takes over from it. */
let current: (() => void) | null = null

/** Runs the whole transition; `go` performs the navigation and resolves once the new route has committed. A transition started
 * while another is on screen ends that one first, and captures the page as it then is. */
export async function runPaper(go: () => Promise<void> | void): Promise<void> {
  current?.()
  // superseded while it captures: the newer navigation is the one that happens, this one never goes
  let superseded = false
  current = () => (superseded = true)
  const root = document.documentElement
  const w = root.clientWidth
  const h = innerHeight
  const dpr = Math.min(devicePixelRatio || 1, MAX_DPR)
  const t0 = performance.now()
  // the glyphs need the monospace loaded; a page without code on it may not have fetched it yet
  const [old] = await Promise.all([capture(w, h, dpr), document.fonts?.load(`500 13px ${mono()}`).catch(() => undefined)])
  const t1 = performance.now()
  if (superseded) return
  const stage = createStage(w, h, dpr)
  const held = process.env.NODE_ENV !== 'production' && (window as { __paperHold?: number }).__paperHold != null
  const watchdog = held ? 0 : window.setTimeout(() => finish(), WATCHDOG_MS)
  let done = false
  function finish() {
    if (done) return
    done = true
    if (current === finish) current = null
    clearTimeout(watchdog)
    // the burn is this route change's transition: the fade-up a navigation without a view transition gets (data-fade, set by
    // CardTransitions in the commit, often after `go` resolves) must not start now that the page is up, or it pops out and in
    root.removeAttribute('data-fade')
    root.removeAttribute('data-paper')
    stage.destroy()
  }
  current = finish
  try {
    stage.setPage(old)
    stage.draw(frameAt(0))
    document.body.appendChild(stage.canvas)
    // the old page goes under the sheet at once; the new one shows through as soon as it has committed
    root.setAttribute('data-paper', 'hide')
    const nav = Promise.resolve(go()).then(() => {
      if (!done) root.setAttribute('data-paper', '')
    })
    // the drop leaves once the new route has committed (its data loaded) and the images it shows have come in
    let loaded = nav.then(() => new Promise(requestAnimationFrame)).then(imagesOnScreen)
    if (process.env.NODE_ENV !== 'production') {
      // in development `localStorage.paperSlow = <ms>` makes every route that much slower to load, to watch the drop wait for it
      let slow = 0
      try {
        slow = Number(localStorage.getItem('paperSlow')) || 0
      } catch {
        // no storage: no delay
      }
      if (slow > 0) loaded = loaded.then(() => new Promise((r) => setTimeout(r, slow)))
    }
    if (process.env.NODE_ENV !== 'production') console.info(`[paper] capture ${(t1 - t0).toFixed(0)}ms`)
    await stage.play(loaded)
    await nav
  } finally {
    finish()
  }
}
