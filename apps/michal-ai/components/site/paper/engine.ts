// The paper transition itself, loaded on demand by ./index.ts. Raw WebGL2, no scene library.
//
// 1. The visible viewport of the old page is captured (html2canvas-pro, the capture the glass lens already uses) over the
//    backdrop, and laid on a coarse sheet in a fixed canvas over the page, at exactly the page's pixels.
// 2. The router renders the new page underneath at once; it is shown, live, as soon as it has committed.
// 3. The sheet crumples in three springy squeezes into a ball (drawn as unshaded line art: ink along the creases, a hard shadow
//    under it) while a fire eats it from the face. What burns turns to glyphs in the site's monospace, in the page's colour and then the fire's,
//    that rise and go out. The sheet moves every frame; the glyphs flicker on twos.
// The capture takes real time (about 100 to 400ms on a laptop) and comes on top of PAPER_MS: the page just waits for the click.
import { PAPER_ASH, PAPER_FPS, PAPER_MS } from './config'
import { ASH_FS, QUAD_VS, SHEET_FS, SHEET_VS } from './shaders'
import { flickerAt, frameAt, type Frame } from './timeline'

const MAX_DPR = 2
/** Cells along the sheet's long side: fine enough that the creases are lines and the paper between them curves. */
const CELLS = 128
/** A glyph cell, CSS px (the hero globe's cell). */
const GLYPH_W = 8
const GLYPH_H = 13
/** The glyphs, sparse to dense. */
const RAMP = '.:-=+*#%@'
/** How deep the burning edge of glyphs runs ahead of the fire, in burn units. */
const EDGE = 0.05
/** How far a spot rises over its life, in glyph cells. */
const RISE = 11
/** Nothing may hold the overlay longer than this. */
const WATCHDOG_MS = 8000
const FOV = (32 * Math.PI) / 180

const mono = () => getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() || 'ui-monospace, monospace'

/** The glyph strip, one cell per glyph, white on clear, in device px. */
function glyphAtlas(cw: number, ch: number) {
  const c = document.createElement('canvas')
  c.width = cw * RAMP.length
  c.height = ch
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.font = `500 ${Math.round(ch * 0.86)}px ${mono()}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (let i = 0; i < RAMP.length; i++) g.fillText(RAMP[i], (i + 0.5) * cw, ch * 0.54)
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
function skip(el: Element, vh: number): boolean {
  if (el.tagName === 'SCRIPT' || el.tagName === 'NOSCRIPT') return true
  if (el.classList.contains('nav-glass') || el.classList.contains('nav-scrim') || el.classList.contains('paper-overlay')) return true
  if (el.classList.contains('paper-grid__gl')) return true
  const cs = getComputedStyle(el)
  if (cs.position === 'fixed') return !el.classList.contains('paper-grid')
  // far outside the viewport: not worth cloning (the capture time is mostly cloning and text layout)
  const r = el.getBoundingClientRect()
  return r.bottom < -200 || r.top > vh + 200
}

/** The visible viewport as an opaque sheet: paper colour, the live backdrop frame, then the page. */
async function capture(w: number, h: number, scale: number): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas-pro')
  const shot = await html2canvas(document.body, {
    backgroundColor: null,
    scale,
    logging: false,
    useCORS: true,
    x: scrollX,
    y: scrollY,
    width: w,
    height: h,
    windowWidth: w,
    windowHeight: h,
    ignoreElements: (el) => skip(el, h),
    onclone: (doc) => {
      doc.documentElement.removeAttribute('data-paper')
      doc.documentElement.removeAttribute('data-fade')
      const s = doc.createElement('style')
      s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}'
      doc.head.appendChild(s)
      // html2canvas fades `transparent` as transparent black, so the home section's paper ground (home.css) came out as a grey
      // band: the same fade from the paper colour at no alpha. The ::before is a real element in the clone by now, styled inline.
      const p = rgb(getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || '#f4f1e8').map((c) => Math.round(c * 255)).join(',')
      for (const el of doc.querySelectorAll<HTMLElement>('.home-ground > .___html2canvas___pseudoelement_before'))
        el.style.backgroundImage = `linear-gradient(to bottom,rgba(${p},0),rgba(${p},.9) var(--space-24),rgba(${p},.9) calc(100% - var(--space-16)),rgba(${p},0))`
    },
  })
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
      ctx.globalAlpha = Number(getComputedStyle(gl).opacity) || 1
      ctx.drawImage(gl, r.left * scale, r.top * scale, r.width * scale, r.height * scale)
    } catch {
      // a tainted or lost backdrop: the paper colour stands in
    }
    ctx.globalAlpha = 1
  }
  ctx.drawImage(shot, 0, 0, out.width, out.height)
  return out
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
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, depth: true, stencil: true })
  if (!gl) throw new Error('[paper] no WebGL2')
  const block = (e: Event) => e.preventDefault()
  canvas.addEventListener('wheel', block, { passive: false })
  canvas.addEventListener('touchmove', block, { passive: false })

  const sheet = program(gl, SHEET_VS, SHEET_FS)
  const ash = program(gl, QUAD_VS, ASH_FS)

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

  const minDim = Math.min(w, h)
  // the ball keeps the sheet area in mind, so a tall phone page still makes a fist-sized ball
  const R = Math.min(0.16 * Math.sqrt(w * h), 0.32 * minDim)
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

  /** state: 0 the sheet, 1 the burn state per glyph cell, 2 the cast shadow. */
  const drawSheet = (s: Frame, state: 0 | 1 | 2) => {
    gl.useProgram(sheet.p)
    const u = sheet.u
    gl.uniform2f(u.u_size, w, h)
    gl.uniform1f(u.u_ball, s.ball)
    gl.uniform1f(u.u_fold, s.fold)
    gl.uniform1f(u.u_R, R)
    // squash and stretch on screen, volume kept: wider and shorter when squished (rows of the column-major matrix)
    const sy = 1 - s.squash
    const sxz = 1 / Math.sqrt(sy)
    gl.uniformMatrix3fv(u.u_rot, false, rotation(...s.spin).map((v, i) => v * (i % 3 === 1 ? sy : sxz)))
    gl.uniform3f(u.u_center, 0, 0, R * 0.5 * s.ball)
    gl.uniformMatrix4fv(u.u_vp, false, vp)
    gl.uniform1i(u.u_a, 0)
    gl.uniform1f(u.u_burn, s.burn)
    gl.uniform1f(u.u_ash, PAPER_ASH)
    gl.uniform1f(u.u_edge, EDGE)
    gl.uniform1f(u.u_state, state)
    gl.uniform1f(u.u_shadow, state === 2 ? 1 : 0)
    // the floor the shadow falls on, behind the ball; it comes in as the sheet lifts off the page
    gl.uniform1f(u.u_floor, -0.55 * R * s.ball)
    gl.uniform1f(u.u_shadowA, 0.22 * Math.min(1, s.ball / 0.3))
    gl.uniform3fv(u.u_back, back)
    gl.uniform3fv(u.u_char, fire.char)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, page)
    gl.bindVertexArray(sheetVao)
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0)
  }

  const draw = (s: Frame) => {
    const lit = s.burn > -EDGE
    gl.disable(gl.BLEND)
    gl.enable(gl.DEPTH_TEST)
    if (lit) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, cellsFb)
      gl.viewport(0, 0, gridW, gridH)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      drawSheet(s, 1)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT)
    if (s.ball > 0) {
      // the shadow first, under the sheet: one flat tone, each pixel darkened once however many folds land on it
      gl.disable(gl.DEPTH_TEST)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.enable(gl.STENCIL_TEST)
      gl.stencilFunc(gl.EQUAL, 0, 0xff)
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR)
      drawSheet(s, 2)
      gl.disable(gl.STENCIL_TEST)
      gl.disable(gl.BLEND)
      gl.enable(gl.DEPTH_TEST)
    }
    drawSheet(s, 0)
    if (lit) {
      // the glyphs over everything, embers rising in front of what is left of the sheet
      gl.disable(gl.DEPTH_TEST)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.useProgram(ash.p)
      gl.uniform1i(ash.u.u_cells, 3)
      gl.uniform1i(ash.u.u_glyphs, 2)
      gl.uniform2i(ash.u.u_cellPx, cw, ch)
      gl.uniform1i(ash.u.u_count, RAMP.length)
      gl.uniform1f(ash.u.u_rise, RISE)
      gl.uniform1f(ash.u.u_drawing, drawing)
      gl.uniform3fv(ash.u.u_paper, paper)
      gl.uniform3fv(ash.u.u_hot, fire.hot)
      gl.uniform3fv(ash.u.u_flame, fire.flame)
      gl.uniform3fv(ash.u.u_rose, fire.rose)
      gl.uniform3fv(ash.u.u_cool, fire.cool)
      gl.uniform3fv(ash.u.u_char, fire.char)
      gl.activeTexture(gl.TEXTURE2)
      gl.bindTexture(gl.TEXTURE_2D, glyphs)
      gl.activeTexture(gl.TEXTURE3)
      gl.bindTexture(gl.TEXTURE_2D, cells)
      gl.bindVertexArray(quadVao)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.disable(gl.BLEND)
    }
    gl.bindVertexArray(null)
  }

  /** Plays the whole animation, drawn every frame. In development `window.__paperHold = <0 to 1>` stops it there, for screenshots,
   * and `window.__paperScrub(T)` then draws any other point of it. */
  const play = async () => {
    const hold = process.env.NODE_ENV !== 'production' ? (window as { __paperHold?: number }).__paperHold : undefined
    const t0 = performance.now()
    for (;;) {
      const ms = Math.min((await frame()) - t0, PAPER_MS)
      const T = ms / PAPER_MS
      if (hold != null && T >= hold) {
        drawing = flickerAt(hold * PAPER_MS, PAPER_FPS)
        draw(frameAt(hold))
        ;(window as { __paperScrub?: (T: number) => void }).__paperScrub = (T) => {
          drawing = flickerAt(T * PAPER_MS, PAPER_FPS)
          draw(frameAt(T))
        }
        await new Promise(() => {}) // held for inspection until the page is reloaded
      }
      drawing = flickerAt(ms, PAPER_FPS)
      draw(frameAt(T))
      if (T >= 1) return
    }
  }

  const destroy = () => {
    canvas.remove()
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }

  return { canvas, setPage, draw, play, destroy }
}

/** Runs the whole transition; `go` performs the navigation and resolves once the new route has committed. */
export async function runPaper(go: () => Promise<void> | void): Promise<void> {
  const root = document.documentElement
  const w = root.clientWidth
  const h = innerHeight
  const dpr = Math.min(devicePixelRatio || 1, MAX_DPR)
  const t0 = performance.now()
  // the glyphs need the monospace loaded; a page without code on it may not have fetched it yet
  const [old] = await Promise.all([capture(w, h, dpr), document.fonts?.load(`500 13px ${mono()}`).catch(() => undefined)])
  const t1 = performance.now()
  const stage = createStage(w, h, dpr)
  const held = process.env.NODE_ENV !== 'production' && (window as { __paperHold?: number }).__paperHold != null
  const watchdog = held ? 0 : window.setTimeout(() => finish(), WATCHDOG_MS)
  let done = false
  function finish() {
    if (done) return
    done = true
    clearTimeout(watchdog)
    // the burn is this route change's transition: the fade-up a navigation without a view transition gets (data-fade, set by
    // CardTransitions in the commit, often after `go` resolves) must not start now that the page is up, or it pops out and in
    root.removeAttribute('data-fade')
    root.removeAttribute('data-paper')
    stage.destroy()
  }
  try {
    stage.setPage(old)
    stage.draw(frameAt(0))
    document.body.appendChild(stage.canvas)
    // the old page goes under the sheet at once; the new one shows through as soon as it has committed
    root.setAttribute('data-paper', 'hide')
    const nav = Promise.resolve(go()).then(() => {
      if (!done) root.setAttribute('data-paper', '')
    })
    if (process.env.NODE_ENV !== 'production') console.info(`[paper] capture ${(t1 - t0).toFixed(0)}ms`)
    await stage.play()
    await nav
  } finally {
    finish()
  }
}
