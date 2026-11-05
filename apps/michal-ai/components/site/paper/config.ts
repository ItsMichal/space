// Trial: route changes crumple the page and burn it away into rising ASCII, the new page already behind it (see ./index.ts).
// Turn it off here; with the flag off nothing of it loads and links behave exactly as before.
export const PAPER_TRANSITION = true

/** The whole animation (three crumples, the burn, the last ash fading), in ms. The page capture comes on top, see ./engine.ts. */
export const PAPER_MS = 1500

/** Drawings per second: the sheet is drawn "on twos", held for two 24 fps frames, as hand animation is. */
export const PAPER_FPS = 12

/** How long a burnt spot lives on as a rising glyph, in burn units (the fire crosses the sheet in 1). */
export const PAPER_ASH = 0.5
