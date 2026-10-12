import { createSpring, isSettled, type Spring } from '@space/motion/spring'
import { DEFAULT_VARIANT, VARIANT_INDEX, type ShaderTuning, type ShaderVariant } from './config'
import { FRAG, VERT } from './shaders'

export type ItemOptions = ShaderTuning & { seed: number }

type Item = {
  frame: HTMLElement
  img: HTMLImageElement
  opts: ItemOptions
  spring: Spring
  tex: WebGLTexture | null
  texSrc: string
  near: boolean
  lastTarget: number
  focus: [number, number]
  focusKey: string
  scanStart: number
  scanEnd: number
  io: IntersectionObserver
  cleanup: () => void
}

export type ItemHandle = { update(opts: ItemOptions): void; destroy(): void; scan(): void }

const MAX_TEXTURES = 8
const SCAN_MS = 3200

const hex = (s: string, fallback: [number, number, number]): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(s.trim())
  if (!m) return fallback
  const n = parseInt(m[1], 16)
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

const smooth = (x: number) => x * x * (3 - 2 * x)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/**
 * One WebGL2 context, one fixed transparent canvas, many images. Each registered frame wraps a real <img>; while an
 * image is near the viewport its pixels are uploaded once (from the already-decoded <img>), drawn as a quad at the
 * img's live bounding rect with the treatment shader, and the DOM image fades out underneath. Rendering only runs
 * while something is moving (scroll, resize, a spring, a scan), then idles.
 */
export class ShaderRenderer {
  readonly canvas: HTMLCanvasElement
  private gl: WebGL2RenderingContext
  private prog: WebGLProgram
  private u: Record<string, WebGLUniformLocation | null> = {}
  private items = new Set<Item>()
  private raf = 0
  private last = 0
  private lastInput = 0
  private dpr = 1
  private paper: [number, number, number] = [0.957, 0.945, 0.91]
  private ink: [number, number, number] = [0.094, 0.129, 0.106]
  private moss: [number, number, number] = [0.239, 0.416, 0.208]
  defaultVariant: ShaderVariant = DEFAULT_VARIANT
  onLost: (() => void) | null = null
  /** Rolling frame cost (ms of JS+GL submit) for the dev page. */
  private arrival = new WeakMap<object, number>()
  private breath = new WeakMap<object, number>()
  frameMs = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' })
    if (!gl) throw new Error('webgl2 unavailable')
    this.gl = gl
    const vs = this.compile(gl.VERTEX_SHADER, VERT)
    const fs = this.compile(gl.FRAGMENT_SHADER, FRAG)
    const p = gl.createProgram()!
    gl.attachShader(p, vs)
    gl.attachShader(p, fs)
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link failed')
    this.prog = p
    for (const n of ['uRect', 'uView', 'uTex', 'uSize', 'uCover', 'uP', 'uScan', 'uSeed', 'uVariant', 'uArrive', 'uBreath', 'uPaper', 'uInk', 'uMoss']) this.u[n] = gl.getUniformLocation(p, n)
    gl.useProgram(p)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    this.readTheme()
    window.addEventListener('scroll', this.kick, { passive: true })
    window.addEventListener('resize', this.kick, { passive: true })
    canvas.addEventListener('webglcontextlost', this.lost)
  }

  private compile(type: number, src: string) {
    const gl = this.gl
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'compile failed')
    return s
  }

  private readTheme() {
    const cs = getComputedStyle(document.documentElement)
    this.paper = hex(cs.getPropertyValue('--paper'), this.paper)
    this.ink = hex(cs.getPropertyValue('--ink'), this.ink)
    this.moss = hex(cs.getPropertyValue('--accent'), this.moss)
  }

  private lost = (e: Event) => {
    e.preventDefault()
    cancelAnimationFrame(this.raf)
    for (const it of this.items) {
      it.tex = null
      it.frame.removeAttribute('data-gl')
    }
    this.onLost?.()
  }

  private kick = () => {
    this.lastInput = performance.now()
    this.request()
  }

  private request() {
    if (!this.raf) {
      this.last = performance.now()
      this.raf = requestAnimationFrame(this.frame)
    }
  }

  add(frame: HTMLElement, opts: ItemOptions): ItemHandle | null {
    const img = frame.querySelector('img')
    if (!img) return null
    const item: Item = {
      frame,
      img,
      opts,
      spring: createSpring(0, { response: 1.1, damping: 1 }),
      tex: null,
      texSrc: '',
      near: false,
      lastTarget: -1,
      focus: [0.5, 0.5],
      focusKey: '',
      scanStart: 0,
      scanEnd: 0,
      io: new IntersectionObserver(
        (es) => {
          for (const e of es) {
            item.near = e.isIntersecting
            if (!item.near) this.release(item)
          }
          this.kick()
        },
        { rootMargin: '100% 0px 100% 0px' }
      ),
      cleanup: () => {},
    }
    // Start from the resolved state if the image is already in the upper part of the viewport at registration.
    item.io.observe(img)
    const onLoad = () => this.kick()
    img.addEventListener('load', onLoad)
    const trigger = frame.closest('a') ?? frame.parentElement ?? frame
    const onEnter = (e: Event) => {
      if ((e as PointerEvent).pointerType === 'touch' || e.type === 'pointerenter' || e.type === 'pointerdown') this.startScan(item)
    }
    trigger.addEventListener('pointerenter', onEnter)
    trigger.addEventListener('pointerdown', onEnter)
    item.cleanup = () => {
      img.removeEventListener('load', onLoad)
      trigger.removeEventListener('pointerenter', onEnter)
      trigger.removeEventListener('pointerdown', onEnter)
      item.io.disconnect()
    }
    this.items.add(item)
    this.kick()
    return {
      update: (o) => {
        item.opts = o
        this.kick()
      },
      scan: () => this.startScan(item),
      destroy: () => {
        item.cleanup()
        this.release(item)
        frame.removeAttribute('data-gl')
        this.items.delete(item)
        // One more frame, so the shared canvas is cleared: without it the last drawn image stays on the fixed canvas
        // after a client-side navigation, floating over the next page.
        this.kick()
      },
    }
  }

  private startScan(item: Item) {
    const now = performance.now()
    if (now < item.scanEnd + 4000) return
    const speed = item.opts.speed ?? 1
    item.scanStart = now
    item.scanEnd = now + SCAN_MS / Math.max(0.2, speed)
    this.request()
  }

  private release(item: Item) {
    if (item.tex) {
      this.gl.deleteTexture(item.tex)
      item.tex = null
      item.texSrc = ''
      item.frame.removeAttribute('data-gl')
    }
  }

  private upload(item: Item) {
    const img = item.img
    if (!img.complete || !img.naturalWidth) return
    const src = img.currentSrc || img.src
    if (item.tex && item.texSrc === src) return
    const gl = this.gl
    // Bound the number of live textures: drop the farthest-from-viewport first.
    let live = 0
    for (const it of this.items) if (it.tex) live++
    if (live >= MAX_TEXTURES) {
      const vh = window.innerHeight
      let far: Item | null = null
      let farD = -1
      for (const it of this.items) {
        if (!it.tex || it === item) continue
        const r = it.img.getBoundingClientRect()
        const d = Math.abs(r.top + r.height / 2 - vh / 2)
        if (d > farD) {
          farD = d
          far = it
        }
      }
      if (far) this.release(far)
    }
    if (item.tex) gl.deleteTexture(item.tex)
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    } catch {
      gl.deleteTexture(tex)
      return
    }
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    item.tex = tex
    item.texSrc = src
  }

  private frame = (now: number) => {
    this.raf = 0
    const t0 = performance.now()
    const dt = Math.min(Math.max((now - this.last) / 1000, 0), 1 / 20)
    this.last = now
    const gl = this.gl
    const vw = window.innerWidth
    const vh = window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const bw = Math.round(vw * dpr)
    const bh = Math.round(vh * dpr)
    if (this.canvas.width !== bw || this.canvas.height !== bh || this.dpr !== dpr) {
      this.canvas.width = bw
      this.canvas.height = bh
      this.dpr = dpr
    }
    gl.viewport(0, 0, bw, bh)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform2f(this.u.uView, vw, vh)
    gl.uniform3fv(this.u.uPaper, this.paper)
    gl.uniform3fv(this.u.uInk, this.ink)
    gl.uniform3fv(this.u.uMoss, this.moss)
    gl.uniform1i(this.u.uTex, 0)
    gl.activeTexture(gl.TEXTURE0)

    let moving = false
    for (const item of this.items) {
      if (!item.near) continue
      this.upload(item)
      if (!item.tex) continue
      const r = item.img.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) continue
      const visible = r.bottom > -8 && r.top < vh + 8 && r.right > 0 && r.left < vw
      const o = item.opts

      // Scroll-linked target: begins as the top edge enters the bottom 5% of the viewport, complete at 45%.
      let target: number
      if (o.progress != null) target = clamp01(o.progress)
      else target = smooth(clamp01((vh * 0.96 - r.top) / (vh * 0.2))) // resolves within the first fifth of a screen of travel: no half-soaked smudge while scrolling
      const strength = o.intensity ?? 1
      target = 1 - (1 - target) * strength
      if (target !== item.lastTarget) {
        // First sight of an image already mostly on screen resolves instantly (no flash of points at load).
        if (item.lastTarget < 0 && target > 0.98) item.spring.set(target)
        else item.spring.to(target)
        item.lastTarget = target
      }
      const speed = Math.max(0.2, o.speed ?? 1)
      item.spring.configure({ response: 1.1 / speed, damping: 1 })
      const s = item.spring.step(dt)
      if (!isSettled(s)) moving = true
      else item.spring.set(s.target)

      if (!visible) continue

      // object-fit: cover + object-position as uv scale/offset
      const key = `${r.width.toFixed(0)}x${r.height.toFixed(0)}`
      if (item.focusKey !== key) {
        item.focusKey = key
        const pos = getComputedStyle(item.img).objectPosition.split(' ')
        const f = (v: string | undefined) => (v && v.endsWith('%') ? parseFloat(v) / 100 : 0.5)
        item.focus = [f(pos[0]), f(pos[1])]
      }
      const nw = item.img.naturalWidth
      const nh = item.img.naturalHeight
      const sc = Math.max(r.width / nw, r.height / nh)
      const sw = nw * sc
      const sh = nh * sc
      const us = r.width / sw
      const vs = r.height / sh
      const uo = (1 - us) * item.focus[0]
      const vo = (1 - vs) * item.focus[1]

      let scan = -1
      if (now < item.scanEnd) {
        const k = clamp01((now - item.scanStart) / (item.scanEnd - item.scanStart))
        scan = k * k * (3 - 2 * k)
        moving = true
      }

      // Slow arrival, once: opacity over 1.4s, a settle from 1.02 over 2.4s (long-tailed ease-out).
      let st = this.arrival.get(item)
      if (st == null) {
        st = now
        this.arrival.set(item, st)
      }
      const ak = clamp01((now - st) / 1400)
      const sk = clamp01((now - st) / 2400)
      const arrive = ak * ak * (3 - 2 * ak)
      if (sk < 1) moving = true
      // Breathing edge: the feather opens a little under hover, focus or press, and settles back slowly.
      const link = item.img.closest('a')
      const want = link && (link.matches(':hover') || link.matches(':focus-visible') || link.matches(':active')) ? 1 : 0
      const b0 = this.breath.get(item) ?? 0
      const b1 = b0 + (want - b0) * Math.min(1, dt * (want ? 2.2 : 1.2))
      this.breath.set(item, b1)
      if (Math.abs(b1 - want) > 0.004) moving = true
      const grow = 1 + 0.02 * Math.pow(1 - sk, 3) + 0.006 * b1
      const gw = r.width * grow
      const gh = r.height * grow
      const gl0 = r.left - (gw - r.width) / 2
      const gt0 = r.top - (gh - r.height) / 2

      gl.bindTexture(gl.TEXTURE_2D, item.tex)
      gl.uniform4f(this.u.uRect, gl0, gt0, gw, gh)
      gl.uniform2f(this.u.uSize, gw, gh)
      gl.uniform1f(this.u.uArrive, arrive)
      gl.uniform1f(this.u.uBreath, b1)
      gl.uniform4f(this.u.uCover, us, vs, uo, vo)
      gl.uniform1f(this.u.uP, clamp01(s.value))
      gl.uniform1f(this.u.uScan, scan)
      gl.uniform1f(this.u.uSeed, (item.opts.seed % 997) / 61)
      gl.uniform1i(this.u.uVariant, VARIANT_INDEX[o.variant ?? this.defaultVariant])
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      if (!item.frame.hasAttribute('data-gl')) item.frame.setAttribute('data-gl', '')
    }

    this.frameMs = this.frameMs * 0.9 + (performance.now() - t0) * 0.1
    if (moving || performance.now() - this.lastInput < 160) this.request()
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('scroll', this.kick)
    window.removeEventListener('resize', this.kick)
    this.canvas.removeEventListener('webglcontextlost', this.lost)
    for (const it of this.items) {
      it.cleanup()
      it.frame.removeAttribute('data-gl')
    }
    this.items.clear()
    this.gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
