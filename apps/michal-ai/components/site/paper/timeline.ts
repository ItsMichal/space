// Pure timing for the paper transition: what the sheet looks like at a moment of each phase. No DOM, no GL.

export type SheetState = {
  /** 0 flat sheet, 1 paper ball. */
  ball: number
  /** Large noise folds, 0 to 1. */
  fold: number
  /** Fine crease relief and normal map strength, 0 to 1. */
  wrinkle: number
  /** Smoothing sweep from the centre out, 0 (all wrinkled) to 1 (all smooth). */
  smooth: number
  /** Old page texture 0, new page texture 1. */
  mix: number
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

/** Step one: the flat old page wrinkles, folds and is squeezed into a ball. `t` runs 0 to 1. */
export function crumpleAt(t: number): SheetState {
  t = clamp01(t)
  return { ball: smoothstep(0.08, 1, t) ** 1.3, fold: smoothstep(0, 0.45, t), wrinkle: smoothstep(0, 0.3, t), smooth: 0, mix: 0 }
}

/** Step two, first half: the ball opens into the new page, which lands flat but still creased. `t` runs 0 to 1. */
export function unfoldAt(t: number): SheetState {
  t = clamp01(t)
  return { ball: 1 - easeOutCubic(t), fold: 1 - smoothstep(0.15, 1, t), wrinkle: 1, smooth: 0, mix: smoothstep(0, 0.1, t) }
}

/** Step two, second half: the creases are pressed out from the centre until the page is flat and clean. `t` runs 0 to 1. */
export function smoothAt(t: number): SheetState {
  t = clamp01(t)
  return { ball: 0, fold: 0, wrinkle: 1, smooth: easeInOutCubic(t), mix: 1 }
}

/** Local wrinkle left at a point `d` (0 centre, 1 corner) of the sheet while the smoothing sweep is at `smooth`. */
export function wrinkleLeft(smooth: number, d: number): number {
  return 1 - smoothstep(0, 1, smooth * 1.6 - d * 0.6)
}
