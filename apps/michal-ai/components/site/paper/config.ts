// Trial: route changes crumple the page and burn it away into rising ASCII, the new page already behind it (see ./index.ts).
// Turn it off here; with the flag off nothing of it loads and links behave exactly as before.
export const PAPER_TRANSITION = true

/** The lead-in, in ms: the page slowly starts to crumple while the new route loads under it; the drop waits in it until it has. */
export const LEAD_MS = 150
/** The folding, from the end of the lead-in, in ms: the lifted page folds into its flower one fold after another. */
export const FOLD_MS = 650
/** When the folded flower is let go, in ms from the start: as its last folds close, so it falls from rest. */
export const DROP_AT = LEAD_MS + 500
/** The drop after the folding: the fall, its one bounce and settling, in ms from DROP_AT. */
export const CRUMPLE_MS = 780
/** When the fire catches, in ms from the start: once the flower has come down and rests after its bounce (the drop lands 295ms
 * after it leaves, rebounds and lands again at 658ms), so the finished origami holds still for a moment, unlit. */
export const IGNITE_MS = DROP_AT + 720
/** When the fire front has crossed the whole sheet, in ms from the start: a steady spread over the resting flower, so the paper turns
 * to glyphs from the catch outward, not in a snap. The embers drift and go out through the rest of FIRE_MS. */
export const FRONT_MS = IGNITE_MS + 420
/** The fire, from catching to the last ash fading, in ms. */
export const FIRE_MS = 2000
/** The whole animation, in ms: the fire overlaps the end of the crumple. The page capture comes on top, see ./engine.ts. */
export const PAPER_MS = IGNITE_MS + FIRE_MS

/** How often the burning glyphs flicker, a second: on twos, as hand-drawn fire is. The sheet itself moves every frame. */
export const PAPER_FPS = 12

/** How long a burnt spot lives on as a rising glyph, in burn units (the fire crosses the sheet in 1): long, as the front races across
 * and the ash takes most of FIRE_MS. */
export const PAPER_ASH = 5
