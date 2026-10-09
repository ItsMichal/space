/*
 * Liquid glass maths, ported from docs/design-system/components/bundle.js.
 *
 * The rim of the glass is a thin convex lens with a squircle profile
 * h(t) = (1 - (1 - t)^4)^(1/4), t = 0 at the edge, 1 at `bezel` px inside.
 * Its slope is the surface normal; rays bend by Snell's law (n = 1.5). The
 * resulting offset is packed into R (x) and G (y) of a map image that drives
 * feDisplacementMap on the backdrop.
 */

export function surfaceHeight(t: number): number {
  const u = 1 - Math.min(Math.max(t, 0), 1)
  return Math.pow(1 - Math.pow(u, 4), 0.25)
}

export function refractOffset(t: number, thickness: number): number {
  const e = 0.001
  const slope = (surfaceHeight(t + e) - surfaceHeight(t - e)) / (2 * e)
  const nAng = Math.atan(slope)
  const sinR = Math.sin(nAng) / 1.5
  const rAng = nAng - Math.asin(sinR)
  return Math.tan(rAng) * thickness * surfaceHeight(t)
}

/** Signed distance to a rounded rectangle of size w x h and corner radius r. */
export function sdRoundRect(px: number, py: number, w: number, h: number, r: number): number {
  const qx = Math.abs(px - w / 2) - (w / 2 - r)
  const qy = Math.abs(py - h / 2) - (h / 2 - r)
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  return Math.min(Math.max(qx, qy), 0) + Math.sqrt(ox * ox + oy * oy) - r
}

/** Raw RGBA bytes of the displacement map (R = x, G = y, 128 = no shift). */
export function displacementPixels(w: number, h: number, r: number, bezel: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4)
  const field = new Float32Array(w * h * 2)
  let max = 0

  // The profile only depends on t, so tabulate it once per map.
  const STEPS = 256
  const lut = new Float32Array(STEPS + 1)
  for (let i = 0; i <= STEPS; i++) lut[i] = refractOffset(i / STEPS, bezel)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const sd = sdRoundRect(px, py, w, h, r)
      if (sd > 0 || -sd > bezel) continue
      const i = (y * w + x) * 2
      const t = -sd / bezel
      const gx = sdRoundRect(px + 1, py, w, h, r) - sdRoundRect(px - 1, py, w, h, r)
      const gy = sdRoundRect(px, py + 1, w, h, r) - sdRoundRect(px, py - 1, w, h, r)
      const gl = Math.sqrt(gx * gx + gy * gy) || 1
      const mag = lut[Math.round(t * STEPS)]
      field[i] = (-gx / gl) * mag
      field[i + 1] = (-gy / gl) * mag
      max = Math.max(max, Math.abs(field[i]), Math.abs(field[i + 1]))
    }
  }
  max = max || 1
  for (let k = 0, p = 0; k < field.length; k += 2, p += 4) {
    out[p] = 128 + (field[k] / max) * 127
    out[p + 1] = 128 + (field[k + 1] / max) * 127
    out[p + 2] = 128
    out[p + 3] = 255
  }
  return out
}

const cache = new Map<string, string>()

/** PNG data URL of the displacement map, cached by geometry. */
export function displacementMapUrl(w: number, h: number, r: number, bezel: number): string | null {
  const key = `${w}x${h}r${r}b${bezel}`
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return null
  const img = ctx.createImageData(w, h)
  img.data.set(displacementPixels(w, h, r, bezel))
  ctx.putImageData(img, 0, 0)
  const url = c.toDataURL()
  if (cache.size > 24) cache.delete(cache.keys().next().value as string)
  cache.set(key, url)
  return url
}
