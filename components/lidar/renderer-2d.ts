import {
  COLS,
  DEPTH_MAX,
  DEPTH_MIN,
  HALF_X,
  HALF_Z,
  POINTS,
  buildPoints,
  camera,
  project,
  scanGlow,
  scanPos,
  smoothstep,
  terrain,
  type FrameState,
  type Renderer,
} from './field'

/** Canvas2D fallback: same point set, terrain and camera as the WebGL2 path. */
export function create2DRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const pts = buildPoints()
  const cell = (HALF_X * 2) / (COLS - 1)
  const tmp = [0, 0]
  let w = 1
  let h = 1
  let dpr = 1

  return {
    resize(cssW, cssH, d) {
      w = cssW
      h = cssH
      dpr = d
      canvas.width = Math.max(1, Math.round(cssW * d))
      canvas.height = Math.max(1, Math.round(cssH * d))
    },
    draw(f: FrameState) {
      const cam = camera(f, w / h)
      const s = f.scan ? scanPos(f.t) : -2
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const { dot, ink, accent } = f.colors
      for (let i = 0; i < POINTS; i++) {
        const gx = pts[i * 4]
        const gz = pts[i * 4 + 1]
        const x = gx * HALF_X + pts[i * 4 + 2] * cell
        const z = gz * HALF_Z + pts[i * 4 + 3] * cell
        const y = terrain(x, z, f.t)
        const d = project(cam, x, y, z, tmp)
        if (d < 0) continue
        const sx = (tmp[0] * 0.5 + 0.5) * w
        const sy = (0.5 - tmp[1] * 0.5) * h
        if (sx < -8 || sx > w + 8 || sy < -8 || sy > h + 8) continue

        const near = 1 - smoothstep(DEPTH_MIN, DEPTH_MAX, d)
        const nd = Math.min(1, Math.max(0, (d - DEPTH_MIN) / (DEPTH_MAX - DEPTH_MIN)))
        const glow = s > -1 ? scanGlow(nd, s) : 0
        const edge = (1 - smoothstep(0.7, 1, Math.abs(gx))) * (1 - smoothstep(0.7, 1, Math.abs(gz)))
        let alpha = (0.45 + 0.45 * near) * edge
        alpha = Math.max(alpha, glow * 0.85 * edge)
        if (alpha < 0.01) continue
        const k = smoothstep(0.35, 0.85, near)
        const g = glow * 0.95
        const r = ((dot[0] + (ink[0] - dot[0]) * k) * (1 - g) + accent[0] * g) * 255
        const gg = ((dot[1] + (ink[1] - dot[1]) * k) * (1 - g) + accent[1] * g) * 255
        const b = ((dot[2] + (ink[2] - dot[2]) * k) * (1 - g) + accent[2] * g) * 255
        const size = (1.7 + 16 / d) * (1 + 0.7 * glow)
        ctx.globalAlpha = alpha
        ctx.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`
        ctx.beginPath()
        ctx.arc(sx, sy, size / 2, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    },
    destroy() {},
  }
}
