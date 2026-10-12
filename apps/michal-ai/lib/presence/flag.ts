/**
 * Ships dark. While false the post template renders nothing extra and the Markdown pipeline adds no block ids, so the
 * static HTML is identical to before. Flip to true (and set up the Worker side) to enable article reactions.
 * Separate from the Worker kill switch (LIVE_KILL=1), which turns every /api/live/* route off without a deploy of the pages.
 */
export const LIVE_REACTIONS_ENABLED = false

/**
 * Decorative dots on the hero globe: live visitors and the Hawthorne mark. Off by default so the globe ships without the realtime
 * backend (the globe itself renders from static data and needs no network beyond /globe/land.bin).
 */
export const PRESENCE_PINS = false
