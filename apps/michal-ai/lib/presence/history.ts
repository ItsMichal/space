// Rolling record of recent visits ("other visitors"). No session id is stored; dedupe uses a per-day set of salted
// hashes kept separately and dropped when the day changes.
import { LIVE_LIMITS } from './constants'

export interface PastVisit {
  lat: number
  lon: number
  city: string
  country: string
  emoji: string
  /** UTC day, YYYY-MM-DD. */
  day: string
}

export const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10)

/** Append a visit, drop entries older than `days`, keep only the newest `max`. Pure: returns a new array. */
export function addVisit(
  history: readonly PastVisit[],
  v: PastVisit,
  now: number,
  max: number = LIVE_LIMITS.historyMax,
  days: number = LIVE_LIMITS.historyDays,
): PastVisit[] {
  const cutoff = utcDay(now - days * 86_400_000)
  const next = [...history, v].filter((h) => h.day >= cutoff)
  return next.length > max ? next.slice(next.length - max) : next
}

export interface SeenSet {
  day: string
  ids: string[]
}

/** True the first time `id` is seen on `day`. Resets when the day changes; capped so it cannot grow without bound. */
export function markSeen(seen: SeenSet, id: string, day: string, cap = 5000): { seen: SeenSet; first: boolean } {
  const cur = seen.day === day ? seen : { day, ids: [] as string[] }
  if (cur.ids.includes(id)) return { seen: cur, first: false }
  const ids = cur.ids.length >= cap ? cur.ids.slice(1) : cur.ids.slice()
  ids.push(id)
  return { seen: { day, ids }, first: true }
}
