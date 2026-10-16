/**
 * Paper tooth: a tileable 8-bit texture, generated once at start (no download), sampled one texel per canvas pixel by the
 * composite pass. Three scales in one channel, mean 0.5 so the paper's average colour is unchanged:
 *  - fine grain, one value per pixel (triangular distribution, so there are few hard outliers),
 *  - mottle, soft blotches 30 to 70 px across (uneven pulp / sizing),
 *  - fibres, a few hundred short faint curved strokes, mostly darker, some lighter.
 * The grid is periodic (everything wraps), the size is 1024, so no repeat is visible, and it is static: nothing moves or
 * shimmers. Seeded, so every visit and every device gets the same sheet.
 */
export const TOOTH_SIZE = 1024

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeTooth(): Uint8Array {
  const N = TOOTH_SIZE
  const r = mulberry32(0x70a9e2)
  const v = new Float32Array(N * N)

  // fine grain
  for (let i = 0; i < v.length; i++) v[i] = 0.62 * (r() + r() - 1)

  // mottle: periodic value noise at two scales
  for (const [cell, amp] of [[32, 0.2], [64, 0.2]] as const) {
    const g = N / cell
    const lat = new Float32Array(g * g)
    for (let i = 0; i < lat.length; i++) lat[i] = r() * 2 - 1
    for (let y = 0; y < N; y++) {
      const fy = y / cell
      const y0 = Math.floor(fy)
      const ty = fy - y0
      const sy = ty * ty * (3 - 2 * ty)
      for (let x = 0; x < N; x++) {
        const fx = x / cell
        const x0 = Math.floor(fx)
        const tx = fx - x0
        const sx = tx * tx * (3 - 2 * tx)
        const a = lat[(y0 % g) * g + (x0 % g)]
        const b = lat[(y0 % g) * g + ((x0 + 1) % g)]
        const c = lat[((y0 + 1) % g) * g + (x0 % g)]
        const d = lat[((y0 + 1) % g) * g + ((x0 + 1) % g)]
        v[y * N + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy)
      }
    }
  }

  // fibres: short curved strokes, one pixel wide, splatted bilinearly with wrap-around
  const splat = (x: number, y: number, w: number) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < 2; i++) {
        const xx = (((x0 + i) % N) + N) % N
        const yy = (((y0 + j) % N) + N) % N
        v[yy * N + xx] += w * (i ? fx : 1 - fx) * (j ? fy : 1 - fy)
      }
    }
  }
  for (let f = 0; f < 420; f++) {
    let x = r() * N
    let y = r() * N
    let th = r() * Math.PI
    const len = 10 + r() * 34
    const bend = (r() - 0.5) * 0.06
    const w = (r() < 0.72 ? -1 : 1) * (0.28 + r() * 0.3)
    for (let s = 0; s < len; s += 0.7) {
      splat(x, y, w * Math.sin((Math.PI * s) / len)) // fade in and out along the fibre
      x += Math.cos(th) * 0.7
      y += Math.sin(th) * 0.7
      th += bend
    }
  }

  let mean = 0
  for (let i = 0; i < v.length; i++) mean += v[i]
  mean /= v.length // fibres are mostly dark: re-centre so the sheet averages exactly to the paper colour
  const out = new Uint8Array(N * N)
  for (let i = 0; i < out.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(127.5 + 127.5 * Math.max(-1, Math.min(1, v[i] - mean)))))
  return out
}
