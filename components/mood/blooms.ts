/**
 * Wildflowers built from brush marks, not circles: pointed petals, leaf blades, tapered stems and a few water drops.
 * Units: a plant is about 100 high, origin at its base, y grows downward (stems use negative y).
 * Every mark has a head position (it follows stem growth) plus an offset (petals unfolding outward from the head).
 */
export type Species = 'lupine' | 'poppy' | 'campion'
export type ColorKey = 'lupine' | 'lupineSoft' | 'poppy' | 'cream' | 'campion' | 'stem' | 'leaf' | 'aqua'

export type Mark = {
  kind: 'petal' | 'leaf' | 'stem' | 'drop'
  hx: number
  hy: number
  ox: number
  oy: number
  rot: number // radians; 0 points up
  len: number
  wid: number // half width as a fraction of len
  /** stems only: polyline points x0,y0,x1,y1,... and base width */
  pts?: number[]
  color: ColorKey
  alpha: number
  delay: number // 0..1: when this mark starts to open within the bloom's progress
  gloss: boolean
  rnd: number
  vx: number
}

export function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GOLDEN = 2.399963

export function makeBloom(species: Species, seed: number): Mark[] {
  const rnd = mulberry32(seed)
  const marks: Mark[] = []
  const add = (m: Partial<Mark> & Pick<Mark, 'kind' | 'color' | 'len'>) =>
    marks.push({
      hx: 0,
      hy: 0,
      ox: 0,
      oy: 0,
      rot: 0,
      wid: 0.4,
      alpha: 0.8,
      delay: 0,
      gloss: false,
      rnd: rnd(),
      vx: rnd() * 2 - 1,
      ...m,
    })

  /** A hand-drawn stem: gentle S-curve with a little tremble, drawn as a tapering ribbon. Returns the tip. */
  const stem = (len: number, bend: number, width = 1.5): [number, number] => {
    const pts: number[] = []
    const n = 12
    let tx = 0
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const x = bend * Math.sin(t * 1.7) + (rnd() - 0.5) * 0.5
      pts.push(x, -t * len)
      tx = x
    }
    add({ kind: 'stem', color: 'stem', len, pts, wid: width, alpha: 0.62, delay: 0 })
    return [tx, -len]
  }
  const blade = (x: number, y: number, rot: number, len: number, delay: number, wid = 0.2) =>
    add({ kind: 'leaf', color: rnd() > 0.5 ? 'leaf' : 'stem', hx: x, hy: y, ox: 0, oy: 0, rot, len, wid, alpha: 0.5, delay, gloss: true })

  if (species === 'lupine') {
    // palmate leaf: a fan of narrow blades at the base
    for (let i = 0; i < 9; i++) {
      const a = -1.25 + (i / 8) * 2.5
      blade(0, -2, a, 24 + rnd() * 8, 0.04 + Math.abs(a) * 0.03, 0.13)
    }
    const [tx] = stem(60, (rnd() - 0.5) * 6, 1.5)
    // raceme: pea-like florets (two petals each) up the spike, wide at the base, tapering, opening from the bottom
    const floretN = 22
    for (let j = 0; j < floretN; j++) {
      const t = j / (floretN - 1)
      const y = 46 + t * 52
      const side = j % 2 ? 1 : -1
      const spread = (1 - 0.5 * t) * 0.9
      const len = 8.2 * (1 - 0.55 * t) + 2.2
      const col: ColorKey = j % 5 === 0 ? 'lupineSoft' : 'lupine'
      const cx = tx + 0.2 * (y - 58)
      for (const s of [-1, 1]) {
        add({
          kind: 'petal',
          color: s === side ? col : 'lupineSoft',
          hx: cx,
          hy: -y,
          ox: 0,
          oy: 0,
          rot: side * spread + s * 0.5 + (rnd() - 0.5) * 0.25,
          len,
          wid: 0.34,
          alpha: 0.78,
          delay: 0.3 + 0.5 * t + rnd() * 0.04,
          gloss: true,
        })
      }
    }
    // one water drop on a leaf blade
    add({ kind: 'drop', color: 'aqua', hx: 7, hy: -11, len: 4.6, wid: 0.7, alpha: 0.9, delay: 0.55, gloss: true })
  } else if (species === 'poppy') {
    const dir = rnd() > 0.5 ? 1 : -1
    const [tx, ty] = stem(58, 7 * dir, 1.5)
    for (const s of [-1, 1]) blade(0, -4, s * 1.0, 20, 0.08, 0.2)
    // cup of five broad overlapping petals, cream with a warm yellow throat
    const rot = rnd() * 0.6
    for (let p = 0; p < 5; p++) {
      const a = rot + (p / 5) * Math.PI * 2
      add({
        kind: 'petal',
        color: p % 2 ? 'cream' : 'poppy',
        hx: tx,
        hy: ty - 6,
        ox: Math.sin(a) * 2,
        oy: -Math.cos(a) * 2,
        rot: a * 0.55 + (rnd() - 0.5) * 0.2,
        len: 19 + rnd() * 3,
        wid: 0.66,
        alpha: p % 2 ? 0.86 : 0.7,
        delay: 0.45 + p * 0.02,
        gloss: true,
      })
    }
    for (let i = 0; i < 9; i++) {
      const a = i * GOLDEN
      add({
        kind: 'petal',
        color: 'poppy',
        hx: tx,
        hy: ty - 6,
        ox: Math.cos(a) * 1.6,
        oy: Math.sin(a) * 1.2,
        rot: a,
        len: 3.2,
        wid: 0.3,
        alpha: 0.95,
        delay: 0.7,
      })
    }
    add({ kind: 'drop', color: 'aqua', hx: tx + 5, hy: ty - 1, len: 4, wid: 0.72, alpha: 0.9, delay: 0.75, gloss: true })
  } else {
    // moss campion: a low green cushion with small five-petal flowers pressed into it
    for (let i = 0; i < 16; i++) {
      const a = -1.5 + (i / 15) * 3
      blade(0, -2, a, 16 + rnd() * 6, 0.03 + Math.abs(a) * 0.02, 0.22)
    }
    for (let i = 0; i < 13; i++) {
      const rr = Math.sqrt((i + 0.5) / 13) * 22
      const th = i * GOLDEN
      const fx = Math.cos(th) * rr
      const fy = -7 - Math.abs(Math.sin(th)) * rr * 0.62 - 3
      const d = 0.25 + (rr / 22) * 0.5 + rnd() * 0.05
      for (let p = 0; p < 5; p++) {
        add({
          kind: 'petal',
          color: 'campion',
          hx: fx,
          hy: fy,
          ox: 0,
          oy: 0,
          rot: (p / 5) * Math.PI * 2 + i,
          len: 4.3,
          wid: 0.52,
          alpha: 0.82,
          delay: d,
          gloss: p === 0,
        })
      }
    }
  }
  return marks
}
