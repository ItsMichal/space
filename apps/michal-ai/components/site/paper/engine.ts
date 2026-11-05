// The paper transition itself, loaded on demand by ./index.ts. Raw WebGL2, no scene library.
//
// 1. The visible viewport of the old page is captured (html2canvas-pro, the capture the glass lens already uses) over the
//    backdrop, and laid on a finely subdivided sheet in a fixed canvas over the page, at exactly the page's pixels.
// 2. The sheet crumples into a ball (noise folds plus a pull onto a sphere, a real crumpled paper height and normal map for
//    the fine creases), while the router renders the new page underneath, hidden.
// 3. The new page is captured the same way, the ball unfolds into it (the textures cross-fade while the ball opens), lands
//    creased, and the creases are pressed out from the centre until the sheet is flat. Then the live page is shown again.
// Captures take real time (about 100 to 400ms each on a laptop); they come on top of PAPER_MS, the first before the crumple
// (the page just waits for the click), the second while the ball rests.
import { PAPER_MS, PAPER_PHASES } from './config'
import { SHADOW_FS, SHADOW_VS, SHEET_FS, SHEET_VS } from './shaders'
import { crumpleAt, smoothAt, unfoldAt, type SheetState } from './timeline'

const MAX_DPR = 2
/** Cells along the sheet's long side. */
const CELLS = 128
/** The new page gets this long to settle (fonts, images in view) before it is captured anyway. */
const SETTLE_MS = 600
/** Nothing may hold the overlay longer than this. */
const WATCHDOG_MS = 8000
const FOV = (32 * Math.PI) / 180

type Maps = { normal: HTMLImageElement; height: HTMLImageElement }
let maps: Promise<Maps> | null = null

function loadImage(src: string) {
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  return img.decode().then(() => img)
}

/** The crumpled paper maps (ambientCG Paper003, CC0, see public/media/CREDITS.md). */
export function preloadMaps(): Promise<Maps> {
  maps ??= Promise.all([loadImage('/textures/paper-crumple-normal.webp'), loadImage('/textures/paper-crumple-height.webp')]).then(([normal, height]) => ({ normal, height }))
  maps.catch(() => (maps = null))
  return maps
}

const frame = () => new Promise<number>((r) => requestAnimationFrame(r))
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

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

/** The new page has committed: give it a moment for fonts and the images in view, bounded. */
async function settle(h: number) {
  await frame()
  await frame()
  const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('#main img')).filter((img) => {
    if (img.complete) return false
    const r = img.getBoundingClientRect()
    return r.bottom > 0 && r.top < h
  })
  await Promise.race([Promise.all([document.fonts?.ready, ...imgs.map((i) => i.decode().catch(() => {}))]), wait(SETTLE_MS)])
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

function createStage(w: number, h: number, dpr: number, m: Maps) {
  const canvas = document.createElement('canvas')
  canvas.className = 'paper-overlay'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, depth: true })
  if (!gl) throw new Error('[paper] no WebGL2')
  const block = (e: Event) => e.preventDefault()
  canvas.addEventListener('wheel', block, { passive: false })
  canvas.addEventListener('touchmove', block, { passive: false })

  const sheet = program(gl, SHEET_VS, SHEET_FS)
  const shadow = program(gl, SHADOW_VS, SHADOW_FS)
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic')

  // sheet mesh: a grid of uv, square cells
  const cols = w >= h ? CELLS : Math.max(8, Math.round((CELLS * w) / h))
  const rows = w >= h ? Math.max(8, Math.round((CELLS * h) / w)) : CELLS
  const uv = new Float32Array((cols + 1) * (rows + 1) * 2)
  for (let j = 0, k = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++, k += 2) {
      uv[k] = i / cols
      uv[k + 1] = j / rows
    }
  }
  const idx = new Uint16Array(cols * rows * 6)
  for (let j = 0, k = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i
      const b = a + 1
      const c = a + cols + 1
      const d = c + 1
      idx.set([a, c, b, b, c, d], k)
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
  const aP = gl.getAttribLocation(shadow.p, 'a_p')
  gl.enableVertexAttribArray(aP)
  gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)

  const texture = (unit: number, src: TexImageSource, repeat: boolean) => {
    const t = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)))
    return t
  }
  texture(2, m.normal, true)
  texture(3, m.height, true)
  const pages: (WebGLTexture | null)[] = [null, null]
  const setPage = (i: 0 | 1, src: HTMLCanvasElement) => {
    if (pages[i]) gl.deleteTexture(pages[i])
    pages[i] = texture(i, src, false)
    if (i === 0) {
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, pages[0])
    }
  }

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
  const back = rgb(getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || '#f4f1e8').map((c) => c * 0.97)
  const ink = rgb(getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#1c2420')
  const tile = Math.min(560, Math.max(300, minDim * 0.7))

  const draw = (s: SheetState) => {
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    const b = s.ball
    // contact shadow, from the sheet's outline down to the ball's
    const shadowAlpha = 0.2 * Math.min(1, b * 3) * (1 - 0.3 * b)
    if (shadowAlpha > 0.001) {
      gl.disable(gl.DEPTH_TEST)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.useProgram(shadow.p)
      const half = [w / 2 + (R * 0.8 - w / 2) * b, h / 2 + (R * 0.8 - h / 2) * b]
      gl.uniform2f(shadow.u.u_c, w / 2 + R * 0.22 * b, h / 2 - R * 0.3 * b)
      gl.uniform2f(shadow.u.u_half, half[0], half[1])
      gl.uniform1f(shadow.u.u_r, R * 0.8 * b)
      gl.uniform1f(shadow.u.u_blur, 6 + R * 0.5 * b)
      gl.uniform1f(shadow.u.u_alpha, shadowAlpha)
      gl.uniform1f(shadow.u.u_dpr, dpr)
      gl.uniform3f(shadow.u.u_ink, ink[0], ink[1], ink[2])
      gl.bindVertexArray(quadVao)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    gl.disable(gl.BLEND)
    gl.enable(gl.DEPTH_TEST)
    gl.useProgram(sheet.p)
    const u = sheet.u
    gl.uniform2f(u.u_size, w, h)
    gl.uniform2f(u.u_cell, 1 / cols, 1 / rows)
    gl.uniform1f(u.u_ball, b)
    gl.uniform1f(u.u_fold, s.fold)
    gl.uniform1f(u.u_wrinkle, s.wrinkle)
    gl.uniform1f(u.u_smooth, s.smooth)
    gl.uniform1f(u.u_R, R)
    gl.uniform1f(u.u_tile, tile)
    gl.uniformMatrix3fv(u.u_rot, false, rotation(-0.35 * b, 0.55 * b, 0.5 * b))
    gl.uniform3f(u.u_center, 0, 0, R * 0.5 * b)
    gl.uniformMatrix4fv(u.u_vp, false, vp)
    gl.uniform1i(u.u_a, 0)
    gl.uniform1i(u.u_b, 1)
    gl.uniform1i(u.u_normal, 2)
    gl.uniform1i(u.u_height, 3)
    gl.uniform1f(u.u_mix, pages[1] ? s.mix : 0)
    gl.uniform3f(u.u_back, back[0], back[1], back[2])
    gl.uniform3f(u.u_light, -0.45, 0.55, 0.7)
    gl.uniform3f(u.u_eye, 0, 0, D)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, pages[0])
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, pages[1] ?? pages[0])
    gl.bindVertexArray(sheetVao)
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0)
    gl.bindVertexArray(null)
  }

  /** Plays one phase over `ms`. In development `window.__paperHold = '<phase>:<t>'` stops it at that moment, for screenshots. */
  const play = async (at: (t: number) => SheetState, ms: number, name: string) => {
    const [hp, ht] = (process.env.NODE_ENV !== 'production' && (window as { __paperHold?: string }).__paperHold?.split(':')) || []
    const t0 = performance.now()
    for (;;) {
      const t = Math.min(1, ((await frame()) - t0) / ms)
      if (hp === name && t >= Number(ht)) {
        draw(at(Number(ht)))
        await new Promise(() => {}) // held for inspection until the page is reloaded
      }
      draw(at(t))
      if (t >= 1) return
    }
  }

  const fadeOut = async () => {
    canvas.style.opacity = '0'
    await wait(160)
  }

  const destroy = () => {
    canvas.remove()
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }

  return { canvas, setPage, draw, play, fadeOut, destroy }
}

/** Runs the whole transition; `go` performs the navigation and resolves once the new route has committed. */
export async function runPaper(go: () => Promise<void> | void): Promise<void> {
  const root = document.documentElement
  const w = root.clientWidth
  const h = innerHeight
  const dpr = Math.min(devicePixelRatio || 1, MAX_DPR)
  const t0 = performance.now()
  const [m, old] = await Promise.all([preloadMaps(), capture(w, h, dpr)])
  const t1 = performance.now()
  const stage = createStage(w, h, dpr, m)
  const held = process.env.NODE_ENV !== 'production' && !!(window as { __paperHold?: string }).__paperHold
  const watchdog = held ? 0 : window.setTimeout(() => finish(), WATCHDOG_MS)
  let done = false
  function finish() {
    if (done) return
    done = true
    clearTimeout(watchdog)
    root.removeAttribute('data-paper')
    stage.destroy()
  }
  try {
    stage.setPage(0, old)
    stage.draw(crumpleAt(0))
    document.body.appendChild(stage.canvas)
    root.setAttribute('data-paper', '')
    const nav = Promise.resolve(go()).then(() => {
      // the new route set the fade-up that a navigation without a view transition gets; the sheet is that transition here
      root.removeAttribute('data-fade')
      return settle(h)
    })
    await stage.play(crumpleAt, PAPER_MS * PAPER_PHASES.crumple, 'crumple')
    await nav
    root.removeAttribute('data-fade')
    if (done) return
    const t2 = performance.now()
    const fresh = await capture(w, h, dpr).catch(() => null)
    if (process.env.NODE_ENV !== 'production') console.info(`[paper] captures ${(t1 - t0).toFixed(0)}ms + ${(performance.now() - t2).toFixed(0)}ms`)
    if (done) return
    if (!fresh) {
      root.removeAttribute('data-paper')
      await stage.fadeOut()
      return
    }
    stage.setPage(1, fresh)
    await stage.play(unfoldAt, PAPER_MS * PAPER_PHASES.unfold, 'unfold')
    await stage.play(smoothAt, PAPER_MS * PAPER_PHASES.smooth, 'smooth')
    root.removeAttribute('data-paper')
    await stage.fadeOut()
  } finally {
    finish()
  }
}
