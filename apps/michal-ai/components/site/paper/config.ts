// Trial: route changes crumple the page into a paper ball and unfold the ball into the next page (see ./index.ts).
// Turn it off here; with the flag off nothing of it loads and links behave exactly as before.
export const PAPER_TRANSITION = true

/** The whole animation (crumple, unfold, smoothing), in ms. The two page captures come on top, see ./engine.ts. */
export const PAPER_MS = 1600

/** Share of PAPER_MS per phase: the crumple is step one; the unfold and the smoothing are step two. */
export const PAPER_PHASES = { crumple: 0.44, unfold: 0.32, smooth: 0.24 } as const
