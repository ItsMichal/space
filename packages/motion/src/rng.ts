// Seeded randomness. Handcrafted motion must be deterministic: the same seed draws the same wobble every time, so a
// stroke never "re-rolls" mid-animation and frames can be reproduced (and tested).

/** mulberry32: small, fast, good enough for visual jitter. Returns floats in [0, 1). */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stateless hash of an integer to [0, 1). */
export function hash01(n: number, seed = 0) {
  let h = (Math.imul(n | 0, 0x27d4eb2d) ^ Math.imul(seed | 0, 0x165667b1)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

/** 1-D value noise in [-1, 1], smooth in x. */
export function noise1(x: number, seed = 0) {
  const i = Math.floor(x)
  const f = x - i
  const a = hash01(i, seed) * 2 - 1
  const b = hash01(i + 1, seed) * 2 - 1
  return a + (b - a) * fade(f)
}

/** Fractal 1-D noise in about [-1, 1]. */
export function fbm1(x: number, seed = 0, octaves = 3) {
  let sum = 0
  let amp = 1
  let norm = 0
  let f = 1
  for (let o = 0; o < octaves; o++) {
    sum += noise1(x * f, seed + o * 101) * amp
    norm += amp
    amp *= 0.5
    f *= 2.03
  }
  return sum / norm
}
