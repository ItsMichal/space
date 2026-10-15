// Minutes-left estimate for the nav's reading pill. Pure, so the arithmetic is tested; useReading does the DOM measuring.
//
// The article header prints `round(words / 220)` minutes (lib/content/index.ts). The estimate below uses the same speed
// and, when handed that number as the anchor, is scaled so the whole article adds up to exactly the header's figure.
// The two numbers therefore agree at 0%, and the pill counts down from there.

/** Words per minute: the figure the article header uses. */
export const WPM = 220
/** A common allowance for looking at an image or figure. */
export const IMAGE_SECONDS = 12

/** One measured piece of the article body, in page coordinates. */
export type ReadBlock = { top: number; height: number; words: number; images: number }

export const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length

/** Seconds to read a block as a whole. */
const blockSeconds = (b: ReadBlock, wpm: number) => (b.words / wpm) * 60 + b.images * IMAGE_SECONDS

/**
 * Seconds of reading below `line` (a page y). A block the line cuts through counts for the part still below it.
 * `anchorMinutes`, when given, rescales the total to that figure (the header's reading time).
 */
export function secondsLeft(blocks: ReadBlock[], line: number, opts: { wpm?: number; anchorMinutes?: number } = {}): number {
  const wpm = opts.wpm ?? WPM
  let total = 0
  let left = 0
  for (const b of blocks) {
    const s = blockSeconds(b, wpm)
    total += s
    const read = b.height > 0 ? Math.min(1, Math.max(0, (line - b.top) / b.height)) : line >= b.top ? 1 : 0
    left += s * (1 - read)
  }
  if (total <= 0) return 0
  const scale = opts.anchorMinutes && opts.anchorMinutes > 0 ? (opts.anchorMinutes * 60) / total : 1
  return left * scale
}

/** The page y the reader has read down to: sweeps from near the top of the viewport to its bottom edge as progress goes 0 to 1. */
export function readLine(scrollY: number, viewport: number, progress: number): number {
  return scrollY + viewport * (0.15 + 0.85 * progress)
}

/**
 * "8 min left", "1 min left", "under a minute", "done". Rounds to the nearest minute (never to 0 while there is more than
 * 45 seconds left), so the figure only steps when the reader has really crossed a half minute.
 */
export function leftLabel(seconds: number): string {
  if (seconds <= 5) return 'done'
  if (seconds < 45) return 'under a minute'
  return `${Math.max(1, Math.round(seconds / 60))} min left`
}
