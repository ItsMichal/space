// The origami the sheet is folded into: thirteen flowers, one picked per run, each a list of straight folds made one after another.
// Pure: numbers in, numbers out. The sheet is cut along its creases into flat pieces (pieces) and each is placed by turning it about
// the creases it lies beyond (place); the engine draws them.
// A fold is a crease line in the sheet as it lies after the folds before it (px from the sheet's centre, y up), the side of it
// that moves (its normal points there), which way it goes (a valley folds up toward the camera and lands on top, a mountain folds
// back behind) and how far: all the way flat (1, half a turn) or only partway (below 1), so the petals stand open. The real
// models shape their petals with squash, petal and sink folds and curling; here each is made of plain hinged folds to its outline.

export type Fold = { c: [number, number]; n: [number, number]; valley: boolean; angle: number }

/** The most folds a flower has; the shader takes this many. */
export const MAX_FOLDS = 16

const unit = (x: number, y: number): [number, number] => {
  const l = Math.hypot(x, y)
  return [x / l, y / l]
}
const fold = (c: [number, number], n: [number, number], valley = true, angle = 1): Fold => ({ c, n, valley, angle })
/** The long sheet folded in half, its bottom half up onto its top: nearly a square, the box every flower is folded from. */
const half = (): Fold => fold([0, 0], [0, -1])
/** The box left by `half`, its middle and half sizes. */
const box = (w: number, h: number) => ({ x: 0, y: h / 4, a: w / 2, b: h / 4 })
type Box = ReturnType<typeof box>
const CORNERS = [
  [1, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
] as const
/** A box's corners to its middle (a blintz), `angle` of the way; `only` picks the corners by which way up they are. */
const blintz = (o: Box, angle = 1, valley = true, only?: 1 | -1): Fold[] =>
  CORNERS.filter(([, sy]) => !only || sy === only).map(([sx, sy]) =>
    fold([o.x + (sx * o.a) / 2, o.y + (sy * o.b) / 2], unit(sx * o.b, sy * o.a), valley, angle),
  )
/** The four points of the diamond a blintz leaves (or the four sides of a box) folded to its middle, `angle` of the way; `axis` picks
 * the left and right ones (x) or the top and bottom ones (y). */
const tips = (o: Box, angle = 1, valley = true, axis: 'xy' | 'x' | 'y' = 'xy'): Fold[] => [
  ...(axis === 'y' ? [] : [fold([o.x + o.a / 2, o.y], [1, 0], valley, angle), fold([o.x - o.a / 2, o.y], [-1, 0], valley, angle)]),
  ...(axis === 'x' ? [] : [fold([o.x, o.y + o.b / 2], [0, 1], valley, angle), fold([o.x, o.y - o.b / 2], [0, -1], valley, angle)]),
]
/** The box a second blintz (or tips) leaves: half as big. */
const inner = (o: Box): Box => ({ ...o, a: o.a / 2, b: o.b / 2 })

/** The flowers for a sheet `w` by `h` px. Each is folded in half to nearly a square, folded down to a small base whose layers lie
 * flat, and then only its petals are lifted partway, so it ends compact and reads as a flower: lit petals over a shaded base. */
export const PATTERNS: Record<string, (w: number, h: number) => Fold[]> = {
  // the two bottom corners in, a cup pointing down, its two top corners turned down partway as the petal tips
  tulip: (w, h) => [half(), ...blintz(box(w, h), 1, true, -1), ...blintz(box(w, h), 0.4, true, 1)],
  // blintzed twice, then the four corners of the small square lifted into a ring of petals
  lotus: (w, h) => [half(), ...blintz(box(w, h)), ...tips(box(w, h)), ...blintz(inner(box(w, h)), 0.4)],
  // blintzed once, the four points half lifted
  waterLily: (w, h) => [half(), ...blintz(box(w, h)), ...tips(box(w, h), 0.35)],
  // blintzed twice, the four sides of the small square raised into a cup
  morningGlory: (w, h) => [half(), ...blintz(box(w, h)), ...tips(box(w, h)), ...tips(inner(box(w, h)), 0.3)],
  // blintzed, the side points in, the top and bottom ones standing up as falls and standards
  iris: (w, h) => [half(), ...blintz(box(w, h)), ...tips(box(w, h), 1, true, 'x'), ...tips(box(w, h), 0.5, true, 'y')],
  // blintzed, the four points curled back behind, as a lily's petals curl
  lily: (w, h) => [half(), ...blintz(box(w, h)), ...tips(box(w, h), 0.55, false)],
  // blintzed twice, the corners turned in partway round, like a bud's wrapped petals
  rose: (w, h) => {
    const o = inner(box(w, h))
    return [
      half(),
      ...blintz(box(w, h)),
      ...tips(box(w, h)),
      fold([o.x + o.a / 2, o.y + o.b / 4], unit(1, 0.4), true, 0.5),
      fold([o.x - o.a / 4, o.y + o.b / 2], unit(-0.4, 1), true, 0.5),
      fold([o.x - o.a / 2, o.y - o.b / 4], unit(-1, -0.4), true, 0.5),
      fold([o.x + o.a / 4, o.y - o.b / 2], unit(0.4, -1), true, 0.5),
    ]
  },
  // blintzed twice, the small square's corners bent back as five-petal blossoms open flat
  cherryBlossom: (w, h) => [half(), ...blintz(box(w, h)), ...tips(box(w, h)), ...blintz(inner(box(w, h)), 0.3, false)],
  // the four corners to the middle and not quite down, the petals hovering open
  daisy: (w, h) => [half(), ...blintz(box(w, h), 0.8)],
  // blintzed twice, the sides of the small square bent back round its face
  sunflower: (w, h) => [half(), ...blintz(box(w, h)), ...tips(box(w, h)), ...tips(inner(box(w, h)), 0.4, false)],
  // pleated like a fan, then pinched partway in half
  carnation: (w, h) => {
    const o = box(w, h)
    return [
      half(),
      fold([0, o.y + o.b / 2], [0, 1]),
      fold([0, o.y + o.b / 4], [0, 1], false),
      fold([0, o.y], [0, 1]),
      fold([0, o.y - o.b / 2], [0, -1]),
      fold([0, o.y], [1, 0], true, 0.6),
    ]
  },
  // blintzed, the four points lifted high, broad petals flared open
  hibiscus: (w, h) => [half(), ...blintz(box(w, h)), ...tips(box(w, h), 0.65)],
  // the bottom corners in for the bell, its sides bent back partway
  bellflower: (w, h) => [half(), ...blintz(box(w, h), 1, true, -1), ...tips(box(w, h), 0.4, false, 'x')],
}

/** Where a point of the flat sheet ends up once every fold is made all the way (still flat, layers ignored); a fold made only
 * partway leaves it where it was. */
export function folded(folds: Fold[], x: number, y: number): [number, number] {
  for (const f of folds) {
    const s = (x - f.c[0]) * f.n[0] + (y - f.c[1]) * f.n[1]
    if (s > 0 && f.angle >= 1) {
      x -= 2 * s * f.n[0]
      y -= 2 * s * f.n[1]
    }
  }
  return [x, y]
}

/** The middle of the finished flower and its size, px, as seen from the front: every piece's corners folded all the way. */
export function packet(folds: Fold[], w: number, h: number): { center: [number, number]; size: [number, number] } {
  const turn = turns(folds, folds.map(() => 1))
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const piece of pieces(folds, w, h))
    for (const [px, py] of piece.poly) {
      const [x, y] = place(folds, piece.moves, turn, px, py)
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
    }
  return { center: [(x0 + x1) / 2, (y0 + y1) / 2], size: [x1 - x0, y1 - y0] }
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

/** The turn of each fold when made `made` of the way (0 to 1 each), radians, up toward the camera above 0: what the shader takes. */
export function turns(folds: Fold[], made: number[]): number[] {
  return folds.map((f, k) => (f.valley ? 1 : -1) * f.angle * Math.PI * (made[k] ?? 0))
}

/** The height between two layers of the folded stack, px: each full fold lands its layers on top of all those under them, so the
 * stack doubles, about 26px for the lotus's eight full folds. Small, so the flower stays flat, and enough that layers never fight. */
export const LAYER = 0.1

/** A piece of the sheet: a convex polygon of the flat sheet (px from its centre, y up) that no crease crosses, so it folds as one
 * rigid plate, and for each fold whether it is on the side that moves. */
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

/** Where a point of piece `moves` is in 3D with each fold turned by `turn` (radians), the layers stacked: what the sheet draws. */
export function place(folds: Fold[], moves: boolean[], turn: number[], x: number, y: number): [number, number, number] {
  let p: [number, number, number] = [x, y, 0]
  let stack = 0
  folds.forEach((f, k) => {
    if (moves[k]) {
      const u = (p[0] - f.c[0]) * f.n[0] + (p[1] - f.c[1]) * f.n[1]
      const c = Math.cos(turn[k])
      const sn = Math.sin(turn[k])
      const du = u * c - p[2] * sn - u
      p = [p[0] + du * f.n[0], p[1] + du * f.n[1], u * sn + p[2] * c + Math.sign(turn[k]) * (2 * stack + LAYER) * (1 - c) * 0.5]
    }
    if (f.angle >= 1) stack = 2 * stack + LAYER
  })
  return p
}

/** Where a point of the flat sheet is in 3D with each fold turned by `turn`, as `place` puts it on its own piece. */
export function foldPoint(folds: Fold[], turn: number[], x: number, y: number): [number, number, number] {
  const moves: boolean[] = []
  folds.forEach((f, k) => {
    const [qx, qy] = mirrored(folds, moves, k, x, y)
    moves.push((qx - f.c[0]) * f.n[0] + (qy - f.c[1]) * f.n[1] > 0)
  })
  return place(folds, moves, turn, x, y)
}

/** A flat point as the full folds before fold `k` leave it, on the piece whose sides are `moves`. */
function mirrored(folds: Fold[], moves: boolean[], k: number, x: number, y: number): [number, number] {
  for (let j = 0; j < k; j++) {
    const f = folds[j]
    if (!moves[j] || f.angle < 1) continue
    const s = (x - f.c[0]) * f.n[0] + (y - f.c[1]) * f.n[1]
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
