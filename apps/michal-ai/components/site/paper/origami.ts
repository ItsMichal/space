// The origami the sheet is folded into: a flower, one picked per run, each a list of straight folds made one after another.
// Pure: numbers in, numbers out. The sheet is cut along its creases into flat pieces (pieces), those into a fine mesh (mesh), and
// each point is placed by bending it about the creases it lies beyond (place); the engine draws them.
// A fold is a crease line in the sheet as it lies after the folds before it (px from the sheet's centre, y up), the side of it
// that moves (its normal points there), which way it goes (a valley folds up toward the camera and lands on top, a mountain folds
// back behind) and how far: all the way flat (1, half a turn) or only partway (below 1), so the petals stand open.
// Paper does not hinge: a flap being folded rolls over a soft bend that tightens into the crease as it is pressed down, and a petal
// left standing keeps a little of that curl.

export type Fold = { c: [number, number]; n: [number, number]; valley: boolean; angle: number }

/** A model: its folds, and how far it is turned in the sheet's plane to stand the right way up once folded, radians. */
export type Design = { folds: Fold[]; turn: number }

/** The most folds a flower has. */
export const MAX_FOLDS = 16

const unit = (x: number, y: number): [number, number] => {
  const l = Math.hypot(x, y)
  return [x / l, y / l]
}
const fold = (c: [number, number], n: [number, number], valley = true, angle = 1): Fold => ({ c, n, valley, angle })

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

/** The square folded corner to corner into a triangle (the top right corner behind), seen point down once the model is turned an
 * eighth: `at(p, q)` is a point `p` along its top edge (toward the right corner) and `q` up from it, both in shares of the
 * triangle's half width, and `dir` a direction the same way. */
function triangle(w: number, h: number) {
  const s = square(w, h)
  const H = s.a / Math.SQRT2
  const e = [Math.SQRT1_2, -Math.SQRT1_2]
  const up = [Math.SQRT1_2, Math.SQRT1_2]
  const at = (p: number, q: number): [number, number] => [s.c[0] + H * (p * e[0] + q * up[0]), s.c[1] + H * (p * e[1] + q * up[1])]
  const dir = (p: number, q: number) => unit(p * e[0] + q * up[0], p * e[1] + q * up[1])
  return { folds: [...s.folds, fold(s.c, dir(0, 1), false)], at, dir, turn: Math.PI / 4 }
}

/** A fold along the crease through `a` and `b` (triangle shares), the side `toward` lies on moving. */
function crease(t: ReturnType<typeof triangle>, a: [number, number], b: [number, number], toward: [number, number], valley = true, angle = 1): Fold {
  const [dp, dq] = [b[0] - a[0], b[1] - a[1]]
  let [np, nq] = [dq, -dp]
  if ((toward[0] - a[0]) * np + (toward[1] - a[1]) * nq < 0) [np, nq] = [-np, -nq]
  return fold(t.at(...a), t.dir(np, nq), valley, angle)
}

/** The models for a sheet `w` by `h` px, one picked per run. */
export const PATTERNS: Record<string, (w: number, h: number) => Design> = {
  // the classic flat tulip: the triangle stood point up on its folded edge, and its two bottom corners folded up beside the point,
  // so three tips stand at the top (a petal each side of the middle one) over shoulders that narrow to the base; the side petals
  // are left a little open
  tulip: (w, h) => {
    const t = triangle(w, h)
    // in the triangle's shares its point is (0, -1), here turned to the top. A corner (1, 0) swings up about a pivot on the base
    // a little to its own side, so the two flaps never cross, and stands `tilt` off upright beside the point
    const petal = (side: 1 | -1) => {
      const [b, tilt] = [0.06, 0.4]
      const r = 1 - b
      const to: [number, number] = [side * (b + r * Math.sin(tilt)), -r * Math.cos(tilt)]
      const m: [number, number] = [(side + to[0]) / 2, to[1] / 2]
      return crease(t, [side * b, 0], m, [side, 0], true, 0.96)
    }
    return { turn: t.turn + Math.PI, folds: [...t.folds, petal(1), petal(-1)] }
  },
  // the paper cup: the triangle point up, each bottom corner folded across to touch the opposite side so its top edge lies level,
  // then the point folded down in front over them, a tab on the cup's rim. Worked out with the point up, in the triangle's shares
  // turned half round (x = -p, y = -q): a corner lands level on the far side when its crease leans 67.5 degrees, which puts it
  // through (0.171, 0) and (0.414, 0.586)
  cup: (w, h) => {
    const t = triangle(w, h)
    const up = (x: number, y: number): [number, number] => [-x, -y]
    const corner = (side: 1 | -1) => crease(t, up(side * 0.171, 0), up(side * 0.414, 0.586), up(side, 0), true, 0.97)
    const rim = crease(t, up(0, 0.586), up(1, 0.586), up(0, 1), true, 0.96)
    return { turn: t.turn + Math.PI, folds: [...t.folds, corner(1), corner(-1), rim] }
  },
  // the dog's face: the triangle point down, its two top corners folded down beside the face as ears that hang a little past its
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
  const h = seams(folds)
  for (const [k, f] of folds.entries()) {
    const s = (x - f.c[0]) * f.n[0] + (y - f.c[1]) * f.n[1] - h[k]
    if (s > -h[k] && f.angle >= 1) {
      x -= 2 * s * f.n[0]
      y -= 2 * s * f.n[1]
    }
  }
  return [x, y]
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
export function mesh(folds: Fold[], all: Piece[], cell: number): { flat: Float32Array<ArrayBuffer>; of: Uint16Array<ArrayBuffer>; index: Uint32Array<ArrayBuffer> } {
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
  return { flat: new Float32Array(flat), of: new Uint16Array(of), index: new Uint32Array(index) }
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
    if (f.angle >= 1) stack = 2 * stack + LAYER
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
  return { center: [mx * c + my * s, -mx * s + my * c], size: [x1 - x0, y1 - y0] }
}

/** Where a point of the flat sheet is in 3D in pose `at`, as `place` puts it on its own piece. */
export function foldPoint(folds: Fold[], at: Pose, x: number, y: number): [number, number, number] {
  const moves: boolean[] = []
  folds.forEach((f, k) => {
    const [qx, qy] = mirrored(folds, moves, k, x, y)
    moves.push((qx - f.c[0]) * f.n[0] + (qy - f.c[1]) * f.n[1] > 0)
  })
  return place(folds, moves, at, x, y)
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
      stack = 2 * stack + LAYER
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
