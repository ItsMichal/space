/*
 * One shared WebGL2 context for every glass field on the page (browsers cap live contexts at ~16, and
 * a page can hold dozens of glass buttons). Fields render into an offscreen canvas and copy the result
 * out with drawImage in the same task, so no drawing buffer needs to be preserved.
 */

import { FRAG, MAX_SHAPES, VERT } from './shaders'
import { RIM_PEAK } from './geometry'
import type { RGBA } from './backdrop'

export type DrawParams = {
  pass: 0 | 1
  n: number
  rect: Float32Array
  par: Float32Array
  tint: Float32Array
  misc: Float32Array
  fold: Float32Array
  k: number
  unionK: number
  /** css-space window: x, y, w, h */
  win: [number, number, number, number]
  /** device px per css px */
  px: number
  bezel: number
  light: [number, number]
  lightK: number
  tintLight: RGBA
  tintDark: RGBA
  rim: RGBA
  edge: RGBA
  shadow: [number, number, number]
  shadowCol: [number, number, number]
  glow: RGBA
  themeDark: number
  frost: boolean
  readback?: boolean
}

const UNIFORMS = [
  'uPass', 'uN', 'uRect', 'uPar', 'uTint', 'uMisc', 'uFold', 'uK', 'uUnionK', 'uWin', 'uWinPx', 'uPx', 'uBezel',
  'uPeak', 'uLight', 'uLightK', 'uTintLight', 'uTintDark', 'uRim', 'uEdge', 'uShadow', 'uShadowCol', 'uGlow',
  'uThemeDark', 'uReadback', 'uFrost',
] as const

type UName = (typeof UNIFORMS)[number]

export type MapTicket = {
  pbo: WebGLBuffer
  fence: WebGLSync
  w: number
  h: number
  meta: unknown
}

export class GlassGL {
  readonly canvas: HTMLCanvasElement | OffscreenCanvas
  private gl: WebGL2RenderingContext
  private prog: WebGLProgram
  private loc = {} as Record<UName, WebGLUniformLocation | null>
  private lost = false
  private pboPool: WebGLBuffer[] = []
  onLost: (() => void) | null = null

  private constructor(canvas: HTMLCanvasElement | OffscreenCanvas, gl: WebGL2RenderingContext, prog: WebGLProgram) {
    this.canvas = canvas
    this.gl = gl
    this.prog = prog
    for (const n of UNIFORMS) this.loc[n] = gl.getUniformLocation(prog, n)
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.lost = true
      this.onLost?.()
    })
  }

  /** `factory` lets a worker supply an OffscreenCanvas; the default is a detached <canvas>. */
  static create(factory?: () => HTMLCanvasElement | OffscreenCanvas): GlassGL | null {
    const canvas = factory ? factory() : document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: true,
    })
    if (!gl) return null
    try {
      const compile = (type: number, src: string) => {
        const s = gl.createShader(type)!
        gl.shaderSource(s, src)
        gl.compileShader(s)
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
        return s
      }
      const prog = gl.createProgram()!
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
      gl.bindAttribLocation(prog, 0, 'aPos')
      gl.linkProgram(prog)
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link')
      const vao = gl.createVertexArray()
      gl.bindVertexArray(vao)
      const buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
      gl.useProgram(prog)
      gl.disable(gl.BLEND)
      gl.clearColor(0, 0, 0, 0)
      return new GlassGL(canvas, gl, prog)
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.warn('[glass] WebGL2 init failed', err)
      return null
    }
  }

  get isLost() {
    return this.lost
  }

  /** Grow-only backing store; returns the y offset of the rendered window inside the canvas. */
  private fit(w: number, h: number) {
    const gl = this.gl
    const max = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number)
    const nw = Math.min(max, Math.max(this.canvas.width, Math.ceil(w / 64) * 64))
    const nh = Math.min(max, Math.max(this.canvas.height, Math.ceil(h / 64) * 64))
    if (nw !== this.canvas.width || nh !== this.canvas.height) {
      this.canvas.width = nw
      this.canvas.height = nh
    }
  }

  /**
   * Renders the displacement map and starts an asynchronous readback into a pixel buffer. Nothing
   * blocks: the CPU only learns the pixels once the GPU fence signals, normally a frame later.
   */
  issueMap(p: DrawParams, wpx: number, hpx: number, meta: unknown): MapTicket | null {
    const gl = this.gl
    this.draw({ ...p, readback: true }, wpx, hpx)
    const pbo = this.pboPool.pop() ?? gl.createBuffer()
    if (!pbo) return null
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo)
    gl.bufferData(gl.PIXEL_PACK_BUFFER, wpx * hpx * 4, gl.STREAM_READ)
    gl.readPixels(0, 0, wpx, hpx, gl.RGBA, gl.UNSIGNED_BYTE, 0)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
    const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
    if (!fence) {
      this.pboPool.push(pbo)
      return null
    }
    gl.flush()
    return { pbo, fence, w: wpx, h: hpx, meta }
  }

  isMapReady(t: MapTicket): boolean {
    const r = this.gl.clientWaitSync(t.fence, 0, 0)
    return r === this.gl.ALREADY_SIGNALED || r === this.gl.CONDITION_SATISFIED
  }

  /** Copies the pixels out (top-down RGBA) and recycles the ticket. */
  readMap(t: MapTicket, into: Uint8ClampedArray<ArrayBuffer>): void {
    const gl = this.gl
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, t.pbo)
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, into, 0, t.w * t.h * 4)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
  }

  releaseMap(t: MapTicket): void {
    this.gl.deleteSync(t.fence)
    if (this.pboPool.length < 4) this.pboPool.push(t.pbo)
    else this.gl.deleteBuffer(t.pbo)
  }

  /**
   * Renders one pass. Returns the source y of the window in `canvas` (WebGL's origin is bottom-left,
   * so a window of height `hpx` lives at canvas.height - hpx).
   */
  draw(p: DrawParams, wpx: number, hpx: number): number {
    const gl = this.gl
    this.fit(wpx, hpx)
    gl.viewport(0, 0, wpx, hpx)
    gl.clear(gl.COLOR_BUFFER_BIT)
    const L = this.loc
    gl.uniform1i(L.uPass, p.pass)
    gl.uniform1i(L.uN, p.n)
    gl.uniform4fv(L.uRect, p.rect)
    gl.uniform4fv(L.uPar, p.par)
    gl.uniform4fv(L.uTint, p.tint)
    gl.uniform4fv(L.uMisc, p.misc)
    gl.uniform4fv(L.uFold, p.fold)
    gl.uniform1f(L.uK, p.k)
    gl.uniform1f(L.uUnionK, p.unionK)
    gl.uniform4f(L.uWin, p.win[0], p.win[1], p.win[2], p.win[3])
    gl.uniform2f(L.uWinPx, wpx, hpx)
    gl.uniform1f(L.uPx, p.px)
    gl.uniform1f(L.uBezel, p.bezel)
    gl.uniform1f(L.uPeak, RIM_PEAK)
    gl.uniform2f(L.uLight, p.light[0], p.light[1])
    gl.uniform1f(L.uLightK, p.lightK)
    gl.uniform4f(L.uTintLight, ...p.tintLight)
    gl.uniform4f(L.uTintDark, ...p.tintDark)
    gl.uniform4f(L.uRim, ...p.rim)
    gl.uniform4f(L.uEdge, ...p.edge)
    gl.uniform4f(L.uShadow, p.shadow[0], p.shadow[1], p.shadow[2], 0)
    gl.uniform3f(L.uShadowCol, ...p.shadowCol)
    gl.uniform4f(L.uGlow, ...p.glow)
    gl.uniform1f(L.uThemeDark, p.themeDark)
    gl.uniform1i(L.uReadback, p.readback ? 1 : 0)
    gl.uniform1i(L.uFrost, p.frost ? 1 : 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    return this.canvas.height - hpx
  }
}

export const MAX = MAX_SHAPES
