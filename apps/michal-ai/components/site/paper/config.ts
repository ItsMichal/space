// Trial: route changes crumple the page and burn it away into rising ASCII, the new page already behind it (see ./index.ts).
// Turn it off here; with the flag off nothing of it loads and links behave exactly as before.
export const PAPER_TRANSITION = true

/** The lead-in, in ms: the page slowly starts to crumple while the new route loads under it; the drop waits here until it has. */
export const LEAD_MS = 150
/** The crumple after the lead-in: the drop into the ball, its one bounce and settling, in ms. */
export const CRUMPLE_MS = 400
/** When the fire catches, in ms from the start: just before the drop leaves, so it is burning through the fall (a slow route holds it at a spark). */
export const IGNITE_MS = LEAD_MS - 30
/** The fire, from catching to the last ash fading, in ms. */
export const FIRE_MS = 2000
/** The whole animation, in ms: the fire overlaps the end of the crumple. The page capture comes on top, see ./engine.ts. */
export const PAPER_MS = IGNITE_MS + FIRE_MS

/** How often the burning glyphs flicker, a second: on twos, as hand-drawn fire is. The sheet itself moves every frame. */
export const PAPER_FPS = 12

/** How long a burnt spot lives on as a rising glyph, in burn units (the fire crosses the sheet in 1). */
export const PAPER_ASH = 0.8
