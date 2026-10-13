/**
 * Article reactions (the row at the end of each article) and view counting. ON. The Worker side is `/api/live/*`; the
 * emergency switch is the Worker var LIVE_KILL=1 (every route answers 204 and the client hides the row, no deploy of the pages).
 */
export const LIVE_REACTIONS_ENABLED = true

/**
 * Reactions on single paragraphs (hover or tap a block). OFF: built, not shown. Turning it on needs this flag and the Worker
 * var LIVE_BLOCK_REACTIONS=1 (the server refuses block targets otherwise).
 */
export const LIVE_BLOCK_REACTIONS = false

/**
 * Decorative dots on the hero globe: live visitors. Off by default so the globe ships without the realtime
 * backend (the globe itself renders from static data and needs no network beyond /globe/land.bin).
 */
export const PRESENCE_PINS = false
