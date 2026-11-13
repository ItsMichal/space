// Fitting a resume to its pages. The sheet's look has two knobs (lib/resume/doc.ts ResumeSetting): `space` scales the gaps and
// `type` scales the text. The fitter walks one fixed path through them, so a fit is always the same tasteful compromise: when the
// sheet runs over it first tightens the gaps, then eases the type down a little with them, and never past LIMITS; when it is short
// it opens the gaps (and the type a touch) so the page ends near the bottom instead of a third of the way up. Bisection on the path
// needs one layout per step, about a dozen in all, which the editor runs on every change.
import { LIMITS } from './doc'

export type Knobs = { type: number; space: number }
/** The sheet's laid-out height in px at these knobs. */
export type Measure = (k: Knobs) => number

/** Tighten: gaps first, then type and gaps together, to the floor. */
const SHRINK: Knobs[] = [
  { type: 1, space: 1 },
  { type: 1, space: 0.72 },
  { type: 0.95, space: 0.62 },
  { type: LIMITS.type[0], space: LIMITS.space[0] },
]
/** Loosen: gaps first, then a touch of type. Never as far as the limits: a short resume should not look padded. */
const GROW: Knobs[] = [
  { type: 1, space: 1 },
  { type: 1, space: 1.45 },
  { type: 1.04, space: 1.7 },
]

/** The point `t` of the way (0 to 1) along a piecewise-linear path. */
export function along(path: Knobs[], t: number): Knobs {
  const x = Math.min(1, Math.max(0, t)) * (path.length - 1)
  const n = Math.min(path.length - 2, Math.floor(x))
  const f = x - n
  const lerp = (a: number, b: number) => +(a + (b - a) * f).toFixed(4)
  return { type: lerp(path[n].type, path[n + 1].type), space: lerp(path[n].space, path[n + 1].space) }
}

export type Fit = Knobs & {
  /** Height at the result and the room it had, in px. */
  height: number
  room: number
  /** Whether it fits at all; when not, it is set as tight as allowed and `over` says by how much (px). */
  fits: boolean
  over: number
}

/**
 * The knobs that make the sheet fill `room` px: the loosest point on the grow path that still fits, or the first point on the
 * shrink path that does. `fill` (0 to 1) keeps that share of the spare space as a bottom margin on the grow side, so a sheet that
 * already nearly fits is not stretched for a few pixels.
 */
export function fitSheet(measure: Measure, room: number, { steps = 12, fill = 0.98 }: { steps?: number; fill?: number } = {}): Fit {
  const at = (k: Knobs): Fit => {
    const height = measure(k)
    return { ...k, height, room, fits: height <= room + 0.5, over: Math.max(0, height - room) }
  }
  const base = at({ type: 1, space: 1 })
  if (base.fits) {
    const target = room * fill
    if (base.height >= target) return base
    let lo = 0
    let hi = 1
    let best = base
    const end = at(along(GROW, 1))
    if (end.height <= target) return end
    for (let n = 0; n < steps; n++) {
      const mid = (lo + hi) / 2
      const r = at(along(GROW, mid))
      if (r.height <= target) {
        lo = mid
        best = r
      } else hi = mid
    }
    return best
  }
  const floor = at(along(SHRINK, 1))
  if (!floor.fits) return floor
  let lo = 0
  let hi = 1
  let best = floor
  for (let n = 0; n < steps; n++) {
    const mid = (lo + hi) / 2
    const r = at(along(SHRINK, mid))
    if (r.fits) {
      hi = mid
      best = r
    } else lo = mid
  }
  return best
}

/* ------------------------------------------------------------------------------------------------- line hints */

/** One wrapped paragraph or bullet: how many lines it takes and how full its last line is (0 to 1). */
export type Lines = { lines: number; last: number; chars: number }
export type Hint = { cut: number; lines: number }

/**
 * A paragraph whose last line holds only a few words costs a whole line for them. When the last line is under `under` full, cutting
 * about that many characters (plus a word's slack) saves the line. Returns null when there is nothing worth saying.
 */
export function widowHint({ lines, last, chars }: Lines, under = 0.3): Hint | null {
  if (lines < 2 || last <= 0 || last >= under || chars <= 0) return null
  const perLine = chars / (lines - 1 + last)
  return { cut: Math.ceil(perLine * last) + 2, lines }
}

/** Lines of one element as laid out (browser only): line count from the text's client rects, the last line's fill. */
export function measureLines(el: Element): Lines {
  const range = el.ownerDocument.createRange()
  range.selectNodeContents(el)
  const rects = [...range.getClientRects()].filter((r) => r.width > 0.5)
  const box = el.getBoundingClientRect()
  const indent = parseFloat(getComputedStyle(el).paddingLeft) || 0
  const width = box.width - indent
  if (!rects.length || width <= 0) return { lines: 0, last: 0, chars: 0 }
  // Rects on one line share a vertical middle (within half a line); group them.
  const rows: { mid: number; left: number; right: number }[] = []
  for (const r of rects) {
    const mid = r.top + r.height / 2
    const row = rows.find((x) => Math.abs(x.mid - mid) < r.height / 2)
    if (row) {
      row.left = Math.min(row.left, r.left)
      row.right = Math.max(row.right, r.right)
    } else rows.push({ mid, left: r.left, right: r.right })
  }
  rows.sort((a, b) => a.mid - b.mid)
  const tail = rows[rows.length - 1]
  return { lines: rows.length, last: (tail.right - (box.left + indent)) / width, chars: (el.textContent ?? '').length }
}
