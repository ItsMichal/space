// Trial: route changes crumple the page and burn it away into rising ASCII, the new page already behind it (see ./index.ts).
// Turn it off here; with the flag off nothing of it loads and links behave exactly as before.
export const PAPER_TRANSITION = true

/** The lead-in, in ms: the page slowly starts to crumple while the new route loads under it; the drop waits in it until it has. */
export const LEAD_MS = 150
/** The crumple after the lead-in: the drop into the ball, its one bounce and settling, in ms. */
export const CRUMPLE_MS = 780
/** When the fire catches, in ms from the start: late in the fall, so the crumple reads first, unlit. */
export const IGNITE_MS = LEAD_MS + 200
/** When the fire front has crossed the whole sheet, in ms from the start: as the ball comes down on its second landing (the drop lands
 * 295ms after it leaves, rebounds and lands again at 658ms), so the paper turns to glyphs through the whole impact, not in a snap. The
 * embers drift and go out through the rest of FIRE_MS. */
export const FRONT_MS = LEAD_MS + 660
/** The fire, from catching to the last ash fading, in ms. */
export const FIRE_MS = 2000
/** The whole animation, in ms: the fire overlaps the end of the crumple. The page capture comes on top, see ./engine.ts. */
export const PAPER_MS = IGNITE_MS + FIRE_MS

/** How often the burning glyphs flicker, a second: on twos, as hand-drawn fire is. The sheet itself moves every frame. */
export const PAPER_FPS = 12

/** How long a burnt spot lives on as a rising glyph, in burn units (the fire crosses the sheet in 1): long, as the front races across
 * and the ash takes most of FIRE_MS. */
export const PAPER_ASH = 5
