// The origami the sheet is folded into: a flower, one picked per run, each a list of straight folds made one after another.
// Pure: numbers in, numbers out. The sheet is cut along its creases into flat pieces (pieces), those into a fine mesh (mesh), and
// each point is placed by bending it about the creases it lies beyond (place); the engine draws them.
// A fold is a crease line in the sheet as it lies after the folds before it (px from the sheet's centre, y up), the side of it
// that moves (its normal points there), which way it goes (a valley folds up toward the camera and lands on top, a mountain folds
// back behind) and how far: all the way flat (1, half a turn) or only partway (below 1), so the petals stand open. A fold can be
// made of some of the layers only, a flap, as an origamist folds the top layer down: `only` names the folds before it whose moving
// side the paper it moves must be on (or, false, must not be). Folds marked `with` are made at the same moment as the fold before
// them, so a crease can take its layers different ways at once: a reverse fold turns a flap's front layers one way about it and
// its back layers the other, as a neck or head is pulled out of the body.
// Paper does not hinge: a flap being folded rolls over a soft bend that tightens into the crease as it is pressed down, and a petal
// left standing keeps a little of that curl.

import { BIRD, CRANE, LILY } from './models'

export type Fold = {
  c: [number, number]
  n: [number, number]
  valley: boolean
  angle: number
  only?: [number, boolean][]
  with?: boolean
}

/** A model folded from its real crease pattern, every crease at once, as no list of flat folds can make it (a crane's petal
 * folds): the pattern's flat corners (x, y in a square of side 2 about its middle, y up), its triangles, counter-clockwise, and
 * where its corners are in 3D at even steps of the folding, in the same units (./models.ts). */
export type Baked = { flat: number[]; tris: number[]; keys: number[][] }

/** A model: its folds, and how far it is turned in the sheet's plane to stand the right way up once folded, radians. A baked one's
 * folds only square the page, and the pattern is folded from that square, its middle `c` and side `a`, px. */
export type Design = {
  folds: Fold[]
  turn: number
  baked?: { model: Baked; c: [number, number]; a: number }
}

/** The most folds a flower has. */
export const MAX_FOLDS = 16

const unit = (x: number, y: number): [number, number] => {
  const l = Math.hypot(x, y)
  return [x / l, y / l]
}
const fold = (c: [number, number], n: [number, number], valley = true, angle = 1): Fold => ({ c, n, valley, angle })
/** Whether paper that the folds before took the sides `moves` of is among the layers fold `f` folds. */
const among = (f: Fold, moves: boolean[]) => !f.only || f.only.every(([j, side]) => moves[j] === side)
/** The paper's stack grows with each full fold: it doubles where a fold goes through it all, but a fold only lays a few layers on
 * the part it covers, so the growth is kept to that, and a flap wraps no more than a few sheets. */
const grow = (stack: number) => Math.min(2 * stack + LAYER, stack + 4 * LAYER, 4 * LAYER)

/** The page folded down to a square, face up, as an origamist squares a sheet: in half behind across its long side, then the strip
 * that leaves past the square behind too. The folds, and the square's middle and side. */
export function square(w: number, h: number): { folds: Fold[]; c: [number, number]; a: number } {
  const folds: Fold[] = []
  const [x0, y1] = [-w / 2, h / 2]
  let [x1, y0] = [w / 2, -h / 2]
  if (h >= w) {
    folds.push(fold([0, 0], [0, -1], false))
    y0 = 0
  } else {
    folds.push(fold([0, 0], [1, 0], false))
    x1 = 0
  }
  const W = x1 - x0
  const H = y1 - y0
  if (H > W + 1) {
    folds.push(fold([0, y1 - W], [0, -1], false))
    y0 = y1 - W
  } else if (W > H + 1) {
    folds.push(fold([x0 + H, 0], [1, 0], false))
    x1 = x0 + H
  }
  return { folds, c: [(x0 + x1) / 2, (y0 + y1) / 2], a: Math.min(W, H) }
}

/** The square stood on a corner, unfolded: `at(p, q)` is a point `p` toward its right corner and `q` toward its top one from its
 * middle, both in shares of its half diagonal (its corners at (+-1, 0) and (0, +-1)), once turned an eighth; `dir` a direction the
 * same way. */
function diamond(w: number, h: number) {
  const s = square(w, h)
  const H = s.a / Math.SQRT2
  const e = [Math.SQRT1_2, -Math.SQRT1_2]
  const up = [Math.SQRT1_2, Math.SQRT1_2]
  const at = (p: number, q: number): [number, number] => [s.c[0] + H * (p * e[0] + q * up[0]), s.c[1] + H * (p * e[1] + q * up[1])]
  const dir = (p: number, q: number) => unit(p * e[0] + q * up[0], p * e[1] + q * up[1])
  return { folds: s.folds, at, dir, turn: Math.PI / 4 }
}

/** The square folded corner to corner into a triangle (the top right corner behind), seen point down once the model is turned an
 * eighth, in the diamond's shares: (0, -1) its point, (+-1, 0) its corners. */
function triangle(w: number, h: number) {
  const d = diamond(w, h)
  return { ...d, folds: [...d.folds, fold(d.at(0, 0), d.dir(0, 1), false)] }
}

/** A fold along the crease through `a` and `b` (triangle shares), the side `toward` lies on moving. */
function crease(t: ReturnType<typeof diamond>, a: [number, number], b: [number, number], toward: [number, number], valley = true, angle = 1): Fold {
  const [dp, dq] = [b[0] - a[0], b[1] - a[1]]
  let [np, nq] = [dq, -dp]
  if ((toward[0] - a[0]) * np + (toward[1] - a[1]) * nq < 0) [np, nq] = [-np, -nq]
  return fold(t.at(...a), t.dir(np, nq), valley, angle)
}

/** The page squared, then folded from the crease pattern `model`. */
function baked(w: number, h: number, model: Baked): Design {
  const s = square(w, h)
  return { folds: s.folds, turn: 0, baked: { model, c: s.c, a: s.a } }
}

/** The tulip and its kin: the triangle stood point up on its folded edge, and its two bottom corners folded up beside the point,
 * so three tips stand at the top (a petal each side of the middle one) over shoulders that narrow to the base. In the triangle's
 * shares its point is (0, -1), here turned to the top. A corner (1, 0) swings up about a pivot on the base a little to its own side,
 * so the two flaps never cross, and stands `tilt` off upright beside the point, its fold made to `angle`, a little open. */
function bloom(w: number, h: number, tilt: number, angle: number): Design {
  const t = triangle(w, h)
  const petal = (side: 1 | -1) => {
    const b = 0.06
    const r = 1 - b
    const to: [number, number] = [side * (b + r * Math.sin(tilt)), -r * Math.cos(tilt)]
    const m: [number, number] = [(side + to[0]) / 2, to[1] / 2]
    return crease(t, [side * b, 0], m, [side, 0], true, angle)
  }
  return { turn: t.turn + Math.PI, folds: [...t.folds, petal(1), petal(-1)] }
}

/** The models for a sheet `w` by `h` px, one picked per run, all traditional: the crane and flapping bird from their crease patterns, the lily from the frog base, the tulip, the bud, the swan and the dog's face. */
export const PATTERNS: Record<string, (w: number, h: number) => Design> = {
  // the traditional crane and flapping bird, folded from their crease patterns
  crane: (w, h) => baked(w, h, CRANE),
  bird: (w, h) => baked(w, h, BIRD),
  // the traditional lily, folded from the frog base
  lily: (w, h) => baked(w, h, LILY),
  // the classic flat tulip: the triangle stood point up on its folded edge, and its two bottom corners folded up beside the point,
  // so three tips stand at the top (a petal each side of the middle one) over shoulders that narrow to the base; the side petals
  // are left a little open
  // the traditional flat tulip, its corners folded up at an angle beside the point as the side petals
  tulip: (w, h) => bloom(w, h, 0.4, 0.96),
  // the same tulip with its corners folded straight up to the point, as the simplest version has it, a bud
  bud: (w, h) => bloom(w, h, 0.12, 0.98),
  // the traditional swan: the square on its corner folded into a kite (its lower edges behind to the middle line), the kite's new
  // edges folded to the middle again in front, so it runs long and narrow to the neck's tip, then folded in half behind along the
  // middle, the neck pulled up out of the body and the head pulled forward out of the neck, each by a reverse fold. In the
  // diamond's shares the tail is at (0, 1), the neck's tip at (0, -1) and the middle line along p = 0, its fold the keel
  swan: (w, h) => {
    const t = diamond(w, h)
    const folds = [...t.folds]
    const add = (f: Fold) => folds.push(f) - 1
    // the lower edges to the middle line, about creases a sixteenth and then a thirty-second of a turn off it
    for (const [slope, valley] of [
      [Math.tan(Math.PI / 8), false],
      [Math.tan(Math.PI / 16), true],
    ] as const)
      for (const side of [1, -1]) add(crease(t, [0, -1], [side * slope, 0], [side, 0], valley))
    const half = add(crease(t, [0, 0], [0, 1], [1, 0], false))
    // a reverse fold about the crease through `a` along `d`, the end past it toward `tip` turned out: the front layers (`front`
    // of the fold that made them) toward the camera and the back ones behind, at once
    const reverse = (a: [number, number], d: [number, number], tip: [number, number], front: [number, boolean][], back: [number, boolean][]) => {
      const b: [number, number] = [a[0] + d[0], a[1] + d[1]]
      const k = add({ ...crease(t, a, b, tip, true), only: front })
      add({ ...crease(t, a, b, tip, false), only: back, with: true })
      return k
    }
    const flip = (pt: [number, number], a: [number, number], d: [number, number]): [number, number] => {
      const [x, y] = [pt[0] - a[0], pt[1] - a[1]]
      const l = x * d[0] + y * d[1]
      return [a[0] + 2 * l * d[0] - x, a[1] + 2 * l * d[1] - y]
    }
    const norm = (x: number, y: number): [number, number] => {
      const l = Math.hypot(x, y)
      return [x / l, y / l]
    }
    // the neck up, standing a little back toward the tail (up is -p, the keel's side +p)
    const base: [number, number] = [0, -0.2]
    const rise = norm(-1, 0.12)
    const neckD = norm(rise[0], rise[1] - 1)
    const tip = flip([0, -1], base, neckD)
    const neck = reverse(base, neckD, [0, -1], [[half, false]], [[half, true]])
    // the head forward and a little down, out of the neck's last stretch
    const head: [number, number] = [tip[0] - rise[0] * 0.17, tip[1] - rise[1] * 0.17]
    const look = norm(0.3, -0.95)
    reverse(
      head,
      norm(rise[0] + look[0], rise[1] + look[1]),
      tip,
      [
        [half, false],
        [neck, true],
      ],
      [
        [half, true],
        [neck + 1, true],
      ],
    )
    return { turn: t.turn - Math.PI / 2, folds }
  },
  // the traditional dog's face: the triangle point down, its two top corners folded down beside the face as ears that hang a little past its
  // sides, and the point folded up a little for the nose. The ears' creases leave the top edge 35 degrees down, so each ear hangs
  // 70 degrees down; they are left a little open, floppy
  dog: (w, h) => {
    const t = triangle(w, h)
    const ear = (side: 1 | -1) => crease(t, [side * 0.4, 0], [side * 0.753, -0.247], [side, 0], true, 0.9)
    const nose = crease(t, [0, -0.76], [1, -0.76], [0, -1], true, 0.97)
    return { turn: t.turn, folds: [...t.folds, ear(1), ear(-1), nose] }
  },
}

/** Where a point of the flat sheet ends up once every fold is made all the way (still flat, layers ignored); a fold made only
 * partway leaves it where it was. */
export function folded(folds: Fold[], x: number, y: number): [number, number] {
  return mirrored(folds, sides(folds, x, y), folds.length, x, y)
}

/** For a point of the flat sheet, whether each fold moves it. */
export function sides(folds: Fold[], x: number, y: number): boolean[] {
  const moves: boolean[] = []
  folds.forEach((f, k) => {
    const [qx, qy] = mirrored(folds, moves, k, x, y)
    moves.push((qx - f.c[0]) * f.n[0] + (qy - f.c[1]) * f.n[1] > 0 && among(f, moves))
  })
  return moves
}

/** How far each of `count` folds is made, 0 to 1, at `t` (0 flat, 1 folded): one after another in order, each eased in and out,
 * the next starting just before the last is down, so each reads on its own and the folding never stops. */
export function foldsAt(t: number, count: number): number[] {
  const OVERLAP = 0.15
  const g = Math.min(1, Math.max(0, t)) * (count - (count - 1) * OVERLAP)
  return Array.from({ length: count }, (_, k) => {
    const f = Math.min(1, Math.max(0, g - k * (1 - OVERLAP)))
    return f * f * (3 - 2 * f)
  })
}

/** How far each fold is made at `t`: a fold marked `with` goes with the one before it, the rest one after another (foldsAt). */
export function foldsMade(folds: Fold[], t: number): number[] {
  const step: number[] = []
  folds.forEach((f, k) => step.push(k > 0 && f.with ? step[k - 1] : (step[k - 1] ?? -1) + 1))
  const at = foldsAt(t, (step.at(-1) ?? -1) + 1)
  return step.map((k) => at[k])
}

/** The share of the folding a baked model spends squaring the page before its pattern folds. */
export const SQUARING = 0.2

/** A baked model's sheet in triangles: the page cut along the squaring folds and along the pattern's triangles where it lies on
 * them once squared, so every triangle rides one of the pattern's. Each vertex's flat point on the page (x, y), the pattern
 * triangle it rides, its weights on that triangle's corners, and how far off it it lies, px (the squaring's layers behind it). */
export function bakedMesh(
  d: Design,
  w: number,
  h: number,
  cell: number,
): {
  flat: Float32Array<ArrayBuffer>
  of: Uint16Array<ArrayBuffer>
  on: Uint16Array<ArrayBuffer>
  weights: Float32Array<ArrayBuffer>
  off: Float32Array<ArrayBuffer>
  index: Uint32Array<ArrayBuffer>
} {
  const { folds } = d
  const { model, c, a } = d.baked!
  const half = a / 2
  const all = pieces(folds, w, h)
  const done = pose(
    folds,
    folds.map(() => 1),
    reaches(folds, all),
  )
  const F = model.flat
  const flat: number[] = []
  const on: number[] = []
  const weights: number[] = []
  const off: number[] = []
  const index: number[] = []
  const of: number[] = []
  // the pattern's outer edges, each in one triangle only
  const edge = (i: number, j: number) => Math.min(i, j) * 65536 + Math.max(i, j)
  const rim = new Set<number>()
  for (let t = 0; t < model.tris.length; t += 3)
    for (let i = 0; i < 3; i++) {
      const e = edge(model.tris[t + i], model.tris[t + ((i + 1) % 3)])
      if (rim.has(e)) rim.delete(e)
      else rim.add(e)
    }
  all.forEach((p, piece) => {
    // the piece where the squaring lays it, in the pattern's units: mirrored about the creases themselves, not past the layers
    // they wrap, so the layers behind lie on the square
    const mirror = (x: number, y: number, back: boolean): [number, number] => {
      for (let j = 0; j < folds.length; j++) {
        const f = folds[back ? folds.length - 1 - j : j]
        if (!p.moves[back ? folds.length - 1 - j : j]) continue
        const d = (x - f.c[0]) * f.n[0] + (y - f.c[1]) * f.n[1]
        x -= 2 * d * f.n[0]
        y -= 2 * d * f.n[1]
      }
      return [x, y]
    }
    const there = p.poly.map(([x, y]): [number, number] => {
      const [fx, fy] = mirror(x, y, false)
      return [(fx - c[0]) / half, (fy - c[1]) / half]
    })
    for (let t = 0; t < model.tris.length; t += 3) {
      const [A, B, C] = [0, 1, 2].map((j): [number, number] => [F[2 * model.tris[t + j]], F[2 * model.tris[t + j] + 1]])
      const det = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0])
      // cut by its inner edges only: past the pattern's own edge lie the layers wrapped round a squaring crease, a hair over it
      let poly = there
      for (const [i, j] of [
        [0, 1],
        [1, 2],
        [2, 0],
      ]) {
        if (rim.has(edge(model.tris[t + i], model.tris[t + j]))) continue
        const [P, Q] = [[A, B, C][i], [A, B, C][j]]
        poly = clip(poly, ([x, y]) => Math.sign(det) * ((Q[0] - P[0]) * (y - P[1]) - (Q[1] - P[1]) * (x - P[0])))
      }
      if (poly.length < 3 || area(poly) < 1e-7) continue
      // cut fine too, so the squaring's bends curve
      const g = cell / half
      const [u0, u1] = [Math.min(...poly.map(([u]) => u)), Math.max(...poly.map(([u]) => u))]
      const [v0, v1] = [Math.min(...poly.map(([, v]) => v)), Math.max(...poly.map(([, v]) => v))]
      for (let gy = Math.floor(v0 / g); gy * g < v1; gy++)
        for (let gx = Math.floor(u0 / g); gx * g < u1; gx++) {
          let bit = poly
          bit = clip(bit, ([u]) => u - gx * g)
          bit = clip(bit, ([u]) => (gx + 1) * g - u)
          bit = clip(bit, ([, v]) => v - gy * g)
          bit = clip(bit, ([, v]) => (gy + 1) * g - v)
          if (bit.length < 3 || area(bit) < 1e-9) continue
          const first = on.length
          for (const [u, v] of bit) {
            const [x, y] = unmirrored(folds, p.moves, c[0] + u * half, c[1] + v * half)
            const wb = ((u - A[0]) * (C[1] - A[1]) - (v - A[1]) * (C[0] - A[0])) / det
            const wc = ((B[0] - A[0]) * (v - A[1]) - (B[1] - A[1]) * (u - A[0])) / det
            flat.push(x, y)
            of.push(piece)
            on.push(t / 3)
            weights.push(1 - wb - wc, wb, wc)
            off.push(place(folds, p.moves, done, x, y)[2])
          }
          for (let i = 1; i + 1 < bit.length; i++) index.push(first, first + i, first + i + 1)
        }
    }
  })
  return {
    flat: new Float32Array(flat),
    of: new Uint16Array(of),
    on: new Uint16Array(on),
    weights: new Float32Array(weights),
    off: new Float32Array(off),
    index: new Uint32Array(index),
  }
}

/** The pattern's corners in 3D at `t` (0 flat to 1 folded), between its baked steps on a curve through them (Catmull-Rom), so a
 * flap turning over a few steps swings round rather than cutting across. */
export function bakedAt(model: Baked, t: number): Float32Array<ArrayBuffer> {
  const { keys } = model
  const g = Math.min(1, Math.max(0, t)) * (keys.length - 1)
  const k = Math.min(keys.length - 2, Math.floor(g))
  const f = g - k
  const [p0, p1, p2, p3] = [keys[Math.max(0, k - 1)], keys[k], keys[k + 1], keys[Math.min(keys.length - 1, k + 2)]]
  const [f2, f3] = [f * f, f * f * f]
  const [w0, w1, w2, w3] = [(-f3 + 2 * f2 - f) / 2, (3 * f3 - 5 * f2 + 2) / 2, (-3 * f3 + 4 * f2 + f) / 2, (f3 - f2) / 2]
  const out = new Float32Array(p1.length)
  for (let i = 0; i < p1.length; i++) out[i] = w0 * p0[i] + w1 * p1[i] + w2 * p2[i] + w3 * p3[i]
  return out
}

/** Where every vertex of a baked mesh is at `t` (0 the page flat, 1 the model folded), px: the squaring folds made first, as the
 * flat folds are, then the pattern folds the square, the layers the squaring laid behind it riding along on their triangles. */
export function bakedPlace(d: Design, m: ReturnType<typeof bakedMesh>, all: Piece[], reach: number[], t: number, out: Float32Array) {
  const { folds } = d
  const { model, c, a } = d.baked!
  const half = a / 2
  const n = m.on.length
  if (t < SQUARING) {
    const at = pose(folds, foldsAt(t / SQUARING, folds.length), reach)
    for (let v = 0; v < n; v++) out.set(place(folds, all[m.of[v]].moves, at, m.flat[2 * v], m.flat[2 * v + 1]), 3 * v)
    return
  }
  const P = bakedAt(model, (t - SQUARING) / (1 - SQUARING))
  // the pattern's first step is the square flat about its middle; recentred steps keep it there
  for (let v = 0; v < n; v++) {
    const tri = 3 * m.on[v]
    const [i, j, k] = [3 * model.tris[tri], 3 * model.tris[tri + 1], 3 * model.tris[tri + 2]]
    const [wa, wb, wc] = [m.weights[3 * v], m.weights[3 * v + 1], m.weights[3 * v + 2]]
    const ux = P[j] - P[i]
    const uy = P[j + 1] - P[i + 1]
    const uz = P[j + 2] - P[i + 2]
    const vx = P[k] - P[i]
    const vy = P[k + 1] - P[i + 1]
    const vz = P[k + 2] - P[i + 2]
    let [nx, ny, nz] = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]
    const l = Math.hypot(nx, ny, nz) || 1
    nx /= l
    ny /= l
    nz /= l
    const o = m.off[v]
    out[3 * v] = c[0] + half * (wa * P[i] + wb * P[j] + wc * P[k]) + o * nx
    out[3 * v + 1] = c[1] + half * (wa * P[i + 1] + wb * P[j + 1] + wc * P[k + 1]) + o * ny
    out[3 * v + 2] = half * (wa * P[i + 2] + wb * P[j + 2] + wc * P[k + 2]) + o * nz
  }
}

/** The paper's thickness, px: each full fold lands its layers on top of all those under them, so the stack doubles. */
export const LAYER = 0.6
/** How soft the bend of a flap being folded is, as a share of its reach past the crease, at the start of the fold; it tightens
 * into the crease as the fold is made. */
const BEND = 0.45
/** The curl a petal left standing keeps, as a share of its reach. */
const CURL = 0.04

/** How the folds stand at a moment: each one's turn, radians (up toward the camera above 0), and the softness of its bend, px. */
export type Pose = { turn: number[]; bend: number[] }

/** The pose with each fold made `made` of the way (0 to 1 each); `reach` is how far each flap runs past its crease (reaches). */
export function pose(folds: Fold[], made: number[], reach: number[]): Pose {
  return {
    turn: folds.map((f, k) => (f.valley ? 1 : -1) * f.angle * Math.PI * (made[k] ?? 0)),
    bend: folds.map((f, k) => reach[k] * (BEND * (1 - (made[k] ?? 0)) + (f.angle < 1 ? CURL * (made[k] ?? 0) : 0))),
  }
}

/** A piece of the sheet: a convex polygon of the flat sheet (px from its centre, y up) that no crease crosses, and for each fold
 * whether it is on the side that moves. */
export type Piece = { poly: [number, number][]; moves: boolean[] }

/** The sheet cut along every crease into pieces, each fold's crease found in the sheet as the full folds before it left it. */
export function pieces(folds: Fold[], w: number, h: number): Piece[] {
  let out: Piece[] = [
    {
      poly: [
        [-w / 2, -h / 2],
        [w / 2, -h / 2],
        [w / 2, h / 2],
        [-w / 2, h / 2],
      ],
      moves: [],
    },
  ]
  folds.forEach((f, k) => {
    const next: Piece[] = []
    for (const piece of out) {
      // the side of the crease, px: an affine function of the flat point on a piece, as the folds before are mirrors
      const side = ([x, y]: [number, number]) => {
        const [qx, qy] = mirrored(folds, piece.moves, k, x, y)
        return (qx - f.c[0]) * f.n[0] + (qy - f.c[1]) * f.n[1]
      }
      // layers this fold leaves are not cut by it
      if (!among(f, piece.moves)) {
        next.push({ poly: piece.poly, moves: [...piece.moves, false] })
        continue
      }
      for (const moves of [true, false]) {
        const poly = clip(piece.poly, (p) => (moves ? side(p) : -side(p)))
        if (area(poly) > 0.5) next.push({ poly, moves: [...piece.moves, moves] })
      }
    }
    out = next
  })
  return out
}

/** How far each fold's flap runs past its crease, px: the furthest corner of the pieces it moves. */
export function reaches(folds: Fold[], all: Piece[]): number[] {
  return folds.map((f, k) => {
    let r = 1
    for (const p of all)
      if (p.moves[k])
        for (const [x, y] of p.poly) {
          const [qx, qy] = mirrored(folds, p.moves, k, x, y)
          r = Math.max(r, (qx - f.c[0]) * f.n[0] + (qy - f.c[1]) * f.n[1])
        }
    return r
  })
}

/** The pieces in small triangles about `cell` px across, so the bends curve: each piece's own vertices (flat x, y), the piece each
 * belongs to, and the triangles, counter-clockwise from the front. The grid is laid on the folded model, not the open sheet, so the
 * layers stacked at a spot are cut at the same places and bend along the same chords: cut apart, a curl's chords would sag through
 * the layer under it. */
export function mesh(
  folds: Fold[],
  all: Piece[],
  cell: number,
): {
  flat: Float32Array<ArrayBuffer>
  of: Uint16Array<ArrayBuffer>
  index: Uint32Array<ArrayBuffer>
} {
  const flat: number[] = []
  const of: number[] = []
  const index: number[] = []
  all.forEach((p, k) => {
    const seen = new Map<string, number>()
    const vertex = ([x, y]: [number, number]) => {
      const key = `${Math.round(x * 64)},${Math.round(y * 64)}`
      let i = seen.get(key)
      if (i == null) {
        i = of.length
        seen.set(key, i)
        flat.push(x, y)
        of.push(k)
      }
      return i
    }
    const there = p.poly.map(([x, y]) => mirrored(folds, p.moves, folds.length, x, y))
    const xs = there.map((v) => v[0])
    const ys = there.map((v) => v[1])
    for (let gx = Math.floor(Math.min(...xs) / cell); gx * cell < Math.max(...xs); gx++)
      for (let gy = Math.floor(Math.min(...ys) / cell); gy * cell < Math.max(...ys); gy++) {
        let poly = there
        const [x0, y0] = [gx * cell, gy * cell]
        poly = clip(poly, ([x]) => x - x0)
        poly = clip(poly, ([x]) => x0 + cell - x)
        poly = clip(poly, ([, y]) => y - y0)
        poly = clip(poly, ([, y]) => y0 + cell - y)
        if (poly.length < 3 || area(poly) < 1e-3) continue
        const ids = poly.map(([x, y]) => vertex(unmirrored(folds, p.moves, x, y)))
        for (let i = 1; i + 1 < ids.length; i++) index.push(ids[0], ids[i], ids[i + 1])
      }
  })
  return {
    flat: new Float32Array(flat),
    of: new Uint16Array(of),
    index: new Uint32Array(index),
  }
}

/** Where a point of piece `moves` is in 3D in pose `at`, the layers stacked: what the sheet draws. Each fold rolls the flap over a
 * bend of radius its softness plus the layers already under it, so a flap folded all the way lands on top of them. */
export function place(folds: Fold[], moves: boolean[], at: Pose, x: number, y: number): [number, number, number] {
  let [px, py, pz] = [x, y, 0]
  let stack = 0
  folds.forEach((f, k) => {
    const th = at.turn[k]
    if (moves[k] && th !== 0) {
      const u = (px - f.c[0]) * f.n[0] + (py - f.c[1]) * f.n[1]
      let nu: number
      let nz: number
      if (u <= 0) {
        // past the crease the wrong way (a tilted layer): turned rigidly about it
        nu = u * Math.cos(th) - pz * Math.sin(th)
        nz = u * Math.sin(th) + pz * Math.cos(th)
      } else {
        // the bend, a circle's arc from the crease, then straight on along its end for the rest of the flap
        const rho = Math.sign(th) * ((2 * stack + LAYER) / 2 + at.bend[k])
        const s = th * rho
        const phi = s > 1e-9 ? (th * Math.min(u, s)) / s : th
        const rest = Math.max(0, u - s)
        const [sn, c] = [Math.sin(phi), Math.cos(phi)]
        nu = rho * sn + rest * c - pz * sn
        nz = rho * (1 - c) + rest * sn + pz * c
      }
      px += (nu - u) * f.n[0]
      py += (nu - u) * f.n[1]
      pz = nz
    }
    if (f.angle >= 1) stack = grow(stack)
  })
  return [px, py, pz]
}

/** The middle of the finished flower and its size, px, as seen from the front once it is turned `turn` to stand up; the middle is
 * given back in the sheet, before the turn, so the flower moved there and then turned sits centred. */
export function packet(folds: Fold[], w: number, h: number, turn = 0): { center: [number, number]; size: [number, number] } {
  const [c, s] = [Math.cos(turn), Math.sin(turn)]
  const all = pieces(folds, w, h)
  const done = pose(
    folds,
    folds.map(() => 1),
    reaches(folds, all),
  )
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const piece of all)
    for (const [px, py] of piece.poly) {
      const [fx, fy] = place(folds, piece.moves, done, px, py)
      const [x, y] = [fx * c - fy * s, fx * s + fy * c]
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
    }
  const [mx, my] = [(x0 + x1) / 2, (y0 + y1) / 2]
  return {
    center: [mx * c + my * s, -mx * s + my * c],
    size: [x1 - x0, y1 - y0],
  }
}

/** Where a point of the flat sheet is in 3D in pose `at`, as `place` puts it on its own piece. */
export function foldPoint(folds: Fold[], at: Pose, x: number, y: number): [number, number, number] {
  return place(folds, sides(folds, x, y), at, x, y)
}

/** Where each full fold lays its flap, px past its crease: the paper turning round the layers under it uses up half a turn of
 * them, so the flap lands mirrored about a line that far out, not about the crease itself (0 for a fold made only partway). */
const seamsOf = new WeakMap<Fold[], number[]>()
function seams(folds: Fold[]): number[] {
  let h = seamsOf.get(folds)
  if (!h) {
    let stack = 0
    h = folds.map((f) => {
      if (f.angle < 1) return 0
      const r = (Math.PI * (2 * stack + LAYER)) / 4
      stack = grow(stack)
      return r
    })
    seamsOf.set(folds, h)
  }
  return h
}

/** A flat point as the full folds before fold `k` leave it, on the piece whose sides are `moves`. */
function mirrored(folds: Fold[], moves: boolean[], k: number, x: number, y: number): [number, number] {
  const h = seams(folds)
  for (let j = 0; j < k; j++) {
    const f = folds[j]
    if (!moves[j] || f.angle < 1) continue
    const s = (x - f.c[0]) * f.n[0] + (y - f.c[1]) * f.n[1] - h[j]
    x -= 2 * s * f.n[0]
    y -= 2 * s * f.n[1]
  }
  return [x, y]
}

/** A point of the folded model back on the open sheet, for the piece whose sides are `moves`: the full folds undone, last first. */
function unmirrored(folds: Fold[], moves: boolean[], x: number, y: number): [number, number] {
  const h = seams(folds)
  for (let j = folds.length - 1; j >= 0; j--) {
    const f = folds[j]
    if (!moves[j] || f.angle < 1) continue
    const s = (x - f.c[0]) * f.n[0] + (y - f.c[1]) * f.n[1] - h[j]
    x -= 2 * s * f.n[0]
    y -= 2 * s * f.n[1]
  }
  return [x, y]
}

/** The part of a convex polygon where the affine `keep` is above 0. */
function clip(poly: [number, number][], keep: (p: [number, number]) => number): [number, number][] {
  const out: [number, number][] = []
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length]
    const ka = keep(a)
    const kb = keep(b)
    if (ka > 0) out.push(a)
    if (ka > 0 !== kb > 0) {
      const t = ka / (ka - kb)
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  })
  return out
}

function area(poly: [number, number][]): number {
  let a = 0
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]
    a += p[0] * q[1] - q[0] * p[1]
  })
  return Math.abs(a) / 2
}
