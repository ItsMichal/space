// Trial: route changes crumple the page and burn it away into rising ASCII, the new page already behind it (see ./index.ts).
// Turn it off here; with the flag off nothing of it loads and links behave exactly as before.
export const PAPER_TRANSITION = true

/** The lead-in, in ms: the page slowly starts to crumple while the new route loads under it; the drop waits in it until it has. */
export const LEAD_MS = 150
/** The crumple after the lead-in: the drop into the ball, its one bounce and settling, in ms. */
export const CRUMPLE_MS = 480
/** When the fire catches, in ms from the start: 60ms before the drop leaves, so it is burning through the fall. A slow route holds the
 * sheet just before this, unlit (./engine.ts). */
export const IGNITE_MS = LEAD_MS - 60
/** When the fire front has crossed the whole sheet, in ms from the start: just before the drop lands (180ms after it leaves, timeline
 * FALL_MS), so the page is consumed before it is fully balled up. The ash rises and fades through the rest of FIRE_MS. */
export const FRONT_MS = LEAD_MS + 160
/** The fire, from catching to the last ash fading, in ms. */
export const FIRE_MS = 2000
/** The whole animation, in ms: the fire overlaps the end of the crumple. The page capture comes on top, see ./engine.ts. */
export const PAPER_MS = IGNITE_MS + FIRE_MS

/** How often the burning glyphs flicker, a second: on twos, as hand-drawn fire is. The sheet itself moves every frame. */
export const PAPER_FPS = 12

/** How long a burnt spot lives on as a rising glyph, in burn units (the fire crosses the sheet in 1): long, as the front races across
 * and the ash takes most of FIRE_MS. */
export const PAPER_ASH = 5
