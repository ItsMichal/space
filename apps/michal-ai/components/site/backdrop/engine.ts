import { BACKDROP as C, PIGMENT } from './config'
import { FS_COMP, FS_LOW, NB, NL, VERT } from './shaders'

export type EngineHooks = {
  /** true when the CSS fallback should show instead of the canvas (no WebGL, context lost), false when the canvas is live. */
  onFallback(on: boolean): void
}

type Prog = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }

const UNIFORMS_LOW = ['uLow', 'uView', 'uUnit', 'uT', 'uScrollB', 'uScrollR', 'uRepeat', 'uWarp', 'uFloorL', 'uCeilD', 'uGlowD', 'uDark', 'uBlob[0]', 'uPig[0]', 'uPaperL', 'uPaperHi', 'uPaperD', 'uRay', 'uRayD', 'uDens']
const UNIFORMS_COMP = ['uLowTex', 'uRes', 'uDpr', 'uCell', 'uOff', 'uT', 'uDark', 'uGlyphOn', 'uShootOn', 'uInkL', 'uInkD', 'uMax', 'uDensity', 'uTwinkle', 'uConst', 'uGrain', 'uThin', 'uShoot', 'uLens[0]', 'uLensR[0]', 'uLensN', 'uLensP', 'uRim']

/**
 * Page backdrop: one fixed canvas, one WebGL2 context, two passes. Returns a disposer.
 *  - soft layers (blobs, rays, glyph density) at 1/6 resolution into a texture,
 *  - composite at device resolution (capped DPR 2) with the glyph field, glass lensing and grain.
 * Pacing: idle redraws at fps.idle, scroll redraws at fps.scroll (fps.scrollLens while glass rects are on screen so the rim
 * stays glued to the card), nothing while the tab is hidden. Reduced motion draws one static frame. No per-frame allocation.
 */
export function createBackdrop(canvas: HTMLCanvasElement, hooks: EngineHooks): () => void {
  const qs = new URLSearchParams(location.search)
  const bake = qs.get('backdrop') === 'bake'
  const reduced = bake || matchMedia('(prefers-reduced-motion: reduce)').matches
  const darkMq = matchMedia('(prefers-color-scheme: dark)')
  const html = document.documentElement
  const isDark = () => (bake ? qs.get('scheme') === 'dark' : darkMq.matches && html.hasAttribute('data-reading'))

  let gl: WebGL2RenderingContext | null = null
  let low!: Prog
  let comp!: Prog
  let tex: WebGLTexture | null = null
  let fbo: WebGLFramebuffer | null = null
  let lowW = 1
  let lowH = 1
  let cssW = 1
  let cssH = 1
  let dpr = 1
  let disposed = false
  let raf = 0
  let lost = false

  const blobArr = new Float32Array(NB * 4)
  const pigArr = new Float32Array(NB * 3)
  for (let i = 0; i < NB; i++) pigArr.set(PIGMENT[C.blobs[i].pigment], i * 3)
  const lensArr = new Float32Array(NL * 4)
  const lensR = new Float32Array(NL)
  let lensN = 0

  // ---- glass lens tracker: rects of marked elements, offscreen ones dropped by IntersectionObserver
  const visible = new Set<Element>()
  const radii = new WeakMap<Element, number>()
  const watched: Element[] = []
  const io = new IntersectionObserver((es) => {
    for (const e of es) (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))
    needsDraw = true
  })
  let rescanTimer = 0
  const rescan = () => {
    const now = Array.from(document.querySelectorAll(C.lens.selector))
    for (const el of watched) if (!now.includes(el)) { io.unobserve(el); visible.delete(el) }
    for (const el of now) if (!watched.includes(el)) io.observe(el)
    watched.length = 0
    for (const el of now) watched.push(el)
    needsDraw = true
  }
  const queueRescan = () => {
    clearTimeout(rescanTimer)
    rescanTimer = window.setTimeout(rescan, 160)
  }
  const mo = new MutationObserver(queueRescan)
  const radiusOf = (el: Element) => {
    let r = radii.get(el)
    if (r === undefined) {
      r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
      radii.set(el, r)
    }
    return r
  }
  const updateLens = () => {
    let n = 0
    if (!reduced) {
      for (const el of visible) {
        if (n >= C.lens.max) break
        const r = el.getBoundingClientRect()
        if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > cssH || r.right < 0 || r.left > cssW) continue
        lensArr[n * 4] = r.left * dpr
        lensArr[n * 4 + 1] = r.top * dpr
        lensArr[n * 4 + 2] = r.right * dpr
        lensArr[n * 4 + 3] = r.bottom * dpr
        lensR[n] = Math.min(radiusOf(el) * dpr, (Math.min(r.width, r.height) * dpr) / 2)
        n++
      }
    }
    lensN = n
  }

  // ---- GL setup
  const compile = (g: WebGL2RenderingContext, type: number, src: string) => {
    const s = g.createShader(type)!
    g.shaderSource(s, src)
    g.compileShader(s)
    if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s) ?? 'shader')
    return s
  }
  const program = (g: WebGL2RenderingContext, fs: string, names: string[]): Prog => {
    const p = g.createProgram()!
    g.attachShader(p, compile(g, g.VERTEX_SHADER, VERT))
    g.attachShader(p, compile(g, g.FRAGMENT_SHADER, fs))
    g.linkProgram(p)
    if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p) ?? 'link')
    const u: Record<string, WebGLUniformLocation | null> = {}
    for (const n of names) u[n.replace('[0]', '')] = g.getUniformLocation(p, n)
    return { p, u }
  }
  const initGL = (): boolean => {
    gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: bake,
    })
    if (!gl) return false
    try {
      low = program(gl, FS_LOW, UNIFORMS_LOW)
      comp = program(gl, FS_COMP, UNIFORMS_COMP)
    } catch (e) {
      console.warn('[backdrop] disabled:', e)
      return false
    }
    tex = gl.createTexture()
    fbo = gl.createFramebuffer()
    gl.bindVertexArray(gl.createVertexArray())
    sizeTargets()
    return true
  }
  const sizeTargets = () => {
    if (!gl) return
    dpr = Math.min(window.devicePixelRatio || 1, C.maxDpr)
    cssW = Math.max(1, canvas.clientWidth)
    cssH = Math.max(1, canvas.clientHeight)
    const w = Math.round(cssW * dpr)
    const h = Math.round(cssH * dpr)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    lowW = Math.max(2, Math.ceil(cssW / C.lowResDivisor))
    lowH = Math.max(2, Math.ceil(cssH / C.lowResDivisor))
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, lowW, lowH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    needsDraw = true
  }

  // ---- state
  let needsDraw = true
  let darkNow = isDark() ? 1 : 0
  let darkTarget = darkNow
  let lastDraw = 0
  let lastScrollY = -1
  let revealed = false
  const t0 = performance.now()
  let bakeT = parseFloat(qs.get('t') ?? '') || C.staticTime
  let bakeScroll = parseFloat(qs.get('scroll') ?? '') || 0
  let glyphsOn = qs.get('glyphs') !== '0'

  const draw = (now: number) => {
    if (!gl || lost) return
    const t = reduced ? bakeT : C.staticTime + (now - t0) / 1000
    const sy = reduced ? bakeScroll : window.scrollY
    lastScrollY = sy
    updateLens()
    const unit = Math.max(cssW, 700)
    const rayO = C.rays

    // blob positions (drift): reuse the preallocated array
    for (let i = 0; i < NB; i++) {
      const b = C.blobs[i]
      blobArr[i * 4] = b.x + b.ax * Math.sin((2 * Math.PI * t) / b.px + i * 1.7)
      blobArr[i * 4 + 1] = b.y + b.ay * Math.cos((2 * Math.PI * t) / b.py + i * 2.3)
      blobArr[i * 4 + 2] = b.r
      blobArr[i * 4 + 3] = b.amp
    }

    // pass 1: low-res soft layers
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.viewport(0, 0, lowW, lowH)
    gl.useProgram(low.p)
    const a = low.u
    gl.uniform2f(a.uLow, lowW, lowH)
    gl.uniform2f(a.uView, cssW, cssH)
    gl.uniform1f(a.uUnit, unit)
    gl.uniform1f(a.uT, t)
    gl.uniform1f(a.uScrollB, sy * C.parallax.blobs)
    gl.uniform1f(a.uScrollR, sy * C.parallax.rays)
    gl.uniform1f(a.uRepeat, C.repeat)
    gl.uniform1f(a.uWarp, C.warp)
    gl.uniform1f(a.uFloorL, C.lumFloorLight)
    gl.uniform1f(a.uCeilD, C.lumCeilDark)
    gl.uniform1f(a.uGlowD, C.darkGlow)
    gl.uniform1f(a.uDark, darkNow)
    gl.uniform4fv(a.uBlob, blobArr)
    gl.uniform3fv(a.uPig, pigArr)
    gl.uniform3fv(a.uPaperL, C.paper.light)
    gl.uniform3fv(a.uPaperHi, C.paper.lightHi)
    gl.uniform3fv(a.uPaperD, C.paper.dark)
    gl.uniform4f(a.uRay, rayO.originX, rayO.originY, rayO.strength, rayO.fringe)
    gl.uniform1f(a.uRayD, rayO.darkStrength)
    gl.uniform1f(a.uDens, 1)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // pass 2: composite
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.useProgram(comp.p)
    const b = comp.u
    const G = C.glyphs
    const cell = Math.max(4, Math.round(G.cellPx * dpr))
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1i(b.uLowTex, 0)
    gl.uniform2f(b.uRes, canvas.width, canvas.height)
    gl.uniform1f(b.uDpr, dpr)
    gl.uniform1f(b.uCell, cell)
    gl.uniform1f(b.uOff, reduced ? 0 : Math.round(sy * C.parallax.glyphs * dpr))
    gl.uniform1f(b.uT, t)
    gl.uniform1f(b.uDark, darkNow)
    gl.uniform1f(b.uGlyphOn, glyphsOn ? 1 : 0)
    gl.uniform1f(b.uShootOn, reduced ? 0 : 1)
    gl.uniform3fv(b.uInkL, G.inkLight)
    gl.uniform3fv(b.uInkD, G.inkDark)
    gl.uniform1f(b.uMax, G.alpha)
    gl.uniform1f(b.uDensity, G.density)
    gl.uniform1f(b.uTwinkle, G.twinkle)
    gl.uniform1f(b.uConst, G.constellationChance)
    gl.uniform1f(b.uGrain, bake && !glyphsOn ? 0 : C.grain)
    gl.uniform4f(b.uThin, (cssW / 2) * dpr, Math.min(G.thinHalfWidth, cssW * 0.46) * dpr, G.thinFeather * dpr, G.thinFactor)
    gl.uniform2f(b.uShoot, G.shootingEvery, G.shootingFor)
    gl.uniform4fv(b.uLens, lensArr)
    gl.uniform1fv(b.uLensR, lensR)
    gl.uniform1i(b.uLensN, lensN)
    const L = C.lens
    gl.uniform4f(b.uLensP, L.edgePx * dpr, L.bendPx * dpr, L.magnify, L.splitPx * dpr)
    gl.uniform3f(b.uRim, L.rimPx * dpr, L.rimLight, L.rimDark)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    if (!revealed) {
      revealed = true
      canvas.dataset.ready = ''
    }
    if (bake) canvas.dataset.baked = ''
  }

  // Bake mode (scripts/bake-backdrop.mjs): redraw on demand with a chosen time, scroll and scheme, and return the pixels.
  if (bake) {
    ;(window as unknown as Record<string, unknown>).__bake = (t: number, scroll: number, dark: number, glyphs: boolean) => {
      bakeT = t
      bakeScroll = scroll
      darkNow = darkTarget = dark
      glyphsOn = glyphs
      sizeTargets()
      draw(performance.now())
      return canvas.toDataURL('image/png')
    }
  }

  // ---- loop
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    if (document.hidden || lost || !gl) return
    if (darkNow !== darkTarget) {
      darkNow = darkTarget > darkNow ? Math.min(darkTarget, darkNow + 0.06) : Math.max(darkTarget, darkNow - 0.06)
      needsDraw = true
    }
    const scrolling = !reduced && Math.abs(window.scrollY - lastScrollY) > 0.5
    const interval = reduced ? Infinity : 1000 / (scrolling ? (lensN > 0 ? 60 : C.fps.scroll) : C.fps.idle)
    if (!needsDraw && now - lastDraw < interval - 3) return
    if (needsDraw || !reduced) {
      needsDraw = false
      lastDraw = now
      draw(now)
    }
  }

  // ---- events
  const onVis = () => {
    if (!document.hidden) needsDraw = true
  }
  const onResize = () => {
    sizeTargets()
    needsDraw = true
  }
  const ro = new ResizeObserver(onResize)
  const onDarkChange = () => {
    darkTarget = isDark() ? 1 : 0
    if (reduced) darkNow = darkTarget
    needsDraw = true
  }
  const attrMo = new MutationObserver(onDarkChange)
  const onLost = (e: Event) => {
    e.preventDefault()
    lost = true
    html.removeAttribute('data-backdrop-lens')
    hooks.onFallback(true)
  }
  const onRestored = () => {
    if (disposed) return
    lost = false
    if (initGL()) {
      html.setAttribute('data-backdrop-lens', 'on')
      hooks.onFallback(false)
      needsDraw = true
    }
  }

  if (!initGL()) {
    hooks.onFallback(true)
    return () => {}
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)
  document.addEventListener('visibilitychange', onVis)
  darkMq.addEventListener('change', onDarkChange)
  attrMo.observe(html, { attributes: true, attributeFilter: ['data-reading'] })
  ro.observe(canvas)
  window.addEventListener('resize', onResize, { passive: true })
  if (!reduced) {
    mo.observe(document.body, { childList: true, subtree: true })
    rescan()
    html.setAttribute('data-backdrop-lens', 'on')
  }
  hooks.onFallback(false)
  raf = requestAnimationFrame(loop)

  return () => {
    disposed = true
    cancelAnimationFrame(raf)
    clearTimeout(rescanTimer)
    canvas.removeEventListener('webglcontextlost', onLost)
    canvas.removeEventListener('webglcontextrestored', onRestored)
    document.removeEventListener('visibilitychange', onVis)
    darkMq.removeEventListener('change', onDarkChange)
    window.removeEventListener('resize', onResize)
    attrMo.disconnect()
    mo.disconnect()
    io.disconnect()
    ro.disconnect()
    html.removeAttribute('data-backdrop-lens')
  }
}
