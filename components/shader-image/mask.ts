// CSS fallback mask: an irregular, softly blurred blob as an SVG data URI, used as `mask-image` on the real <img>.
// Works with no WebGL, before the GL frame is ready, and under prefers-reduced-motion. Deterministic per seed
// (server and client agree), so no hydration mismatch.

function rng(seed: number) {
  let s = (seed >>> 0) || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

const cache = new Map<number, string>()

export function maskUrl(seed: number): string {
  const key = Math.abs(Math.floor(seed)) % 8
  const hit = cache.get(key)
  if (hit) return hit
  const rand = rng(key * 7919 + 13)
  // Walk the rectangle perimeter (inset) and push points in/out a little: a hand-torn, low-frequency edge.
  const n = 28
  const inset = 2.2
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const t = i / n
    const side = Math.floor(t * 4)
    const u = t * 4 - side
    const a = inset + (rand() - 0.5) * 1.4
    const b = 100 - inset + (rand() - 0.5) * 1.4
    const k = inset + u * (100 - 2 * inset)
    const j = (rand() - 0.5) * 1.4
    const p: [number, number] = side === 0 ? [k, a + j] : side === 1 ? [b + j, k] : side === 2 ? [100 - k, b + j] : [a + j, 100 - k]
    pts.push(p)
  }
  // Closed Catmull-Rom to cubic bezier.
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
  }
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>` +
    `<filter id='b' x='-10%' y='-10%' width='120%' height='120%'><feGaussianBlur stdDeviation='1.1'/></filter>` +
    `<path d='${d}Z' fill='#fff' filter='url(#b)'/></svg>`
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  cache.set(key, url)
  return url
}

/** Stable small hash of a string, for per-image seeds. */
export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
