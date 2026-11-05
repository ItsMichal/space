// Trial: route changes crumple the page into a paper ball and toss it off screen, the new page already behind it (see ./index.ts).
// Turn it off here; with the flag off nothing of it loads and links behave exactly as before.
export const PAPER_TRANSITION = true

/** The whole animation (anticipation, crumple, wind-up, toss), in ms. The page capture comes on top, see ./engine.ts. */
export const PAPER_MS = 1250

/** Drawings per second: the sheet is drawn "on twos", held for two 24 fps frames, as hand animation is. */
export const PAPER_FPS = 12

/** Share of PAPER_MS per phase. */
export const PAPER_PHASES = { crumple: 0.52, windup: 0.18, toss: 0.3 } as const
