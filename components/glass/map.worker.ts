/// <reference lib="webworker" />
/*
 * Displacement-map worker: renders the SDF-union lens map with the same WebGL2 fragment shader on an
 * OffscreenCanvas and PNG-encodes it, so the GPU readback (which can stall for several ms while the
 * page's other GL work drains) never blocks the main thread. The main thread only receives a Blob.
 */

import { GlassGL, type DrawParams } from './gl'

type Req = { id: number; params: DrawParams; w: number; h: number }

let renderer: GlassGL | null | undefined
let out: OffscreenCanvas | null = null

self.onmessage = async (e: MessageEvent<Req>) => {
  const { id, params, w, h } = e.data
  try {
    if (renderer === undefined) renderer = GlassGL.create(() => new OffscreenCanvas(64, 64))
    if (!renderer) {
      ;(self as unknown as Worker).postMessage({ id, error: 'webgl2' })
      return
    }
    const sy = renderer.draw(params, w, h)
    if (!out) out = new OffscreenCanvas(w, h)
    if (out.width !== w || out.height !== h) {
      out.width = w
      out.height = h
    }
    const ctx = out.getContext('2d')!
    ctx.globalCompositeOperation = 'copy'
    ctx.drawImage(renderer.canvas, 0, sy, w, h, 0, 0, w, h)
    const blob = await out.convertToBlob({ type: 'image/png' })
    ;(self as unknown as Worker).postMessage({ id, blob })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, error: String(err) })
  }
}
