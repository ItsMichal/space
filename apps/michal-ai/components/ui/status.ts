// A tiny external store the nav's status pill reads. Components publish what they are doing ("scrubbing the timeline",
// "reading section 3"); the pill decides how to show it. No React, so it can be imported anywhere.

export type StatusEntry = {
  /** Who is speaking. One entry per source. */
  source: string
  /** Higher wins when several sources speak. */
  priority: number
  title: string
  sub?: string
  /** 0..1 */
  progress?: number
}

type Listener = () => void

const entries = new Map<string, StatusEntry>()
const listeners = new Set<Listener>()
let snapshot: StatusEntry | null = null

function recompute() {
  let best: StatusEntry | null = null
  for (const e of entries.values()) if (!best || e.priority > best.priority) best = e
  snapshot = best
  listeners.forEach((l) => l())
}

/** Replace (or clear, with null) a source's entry. */
export function publishStatus(source: string, entry: Omit<StatusEntry, 'source'> | null) {
  if (!entry) entries.delete(source)
  else entries.set(source, { source, ...entry })
  recompute()
}

export const subscribeStatus = (l: Listener) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const getStatus = () => snapshot
export const getServerStatus = () => null

/** Progress and section for a long article: pure so it can be tested. `tops` are heading offsets from page top. */
export function sectionAt(tops: number[], y: number): number {
  let at = -1
  for (let i = 0; i < tops.length; i++) if (tops[i] <= y) at = i
  return at
}

/** 0..1 through an article body between its start and the point its end reaches the bottom of the viewport. */
export function readingProgress(scrollY: number, start: number, end: number, viewport: number): number {
  const span = end - viewport - start
  if (span <= 0) return scrollY > start ? 1 : 0
  return Math.min(1, Math.max(0, (scrollY - start) / span))
}
