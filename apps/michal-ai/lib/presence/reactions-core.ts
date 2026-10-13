// Reaction semantics, independent of storage. The Durable Object implements the same behaviour on SQLite.
import { REACTION_IDS } from './constants'

export const POST_TARGET = 'post'

export interface ReactionStore {
  /** Set one reaction on or off for a session. Returns true when state changed. */
  set(target: string, emoji: string, sid: string, on: boolean): boolean
  counts(): Record<string, Record<string, number>>
  mine(sid: string): Record<string, string[]>
}

export class MemoryReactionStore implements ReactionStore {
  private rows = new Set<string>()
  private targets = new Set<string>()
  constructor(
    private maxRows = 50_000,
    private maxTargets = 400,
  ) {}

  set(target: string, emoji: string, sid: string, on: boolean): boolean {
    const k = `${target}\u0000${emoji}\u0000${sid}`
    if (!on) return this.rows.delete(k)
    if (this.rows.has(k)) return false
    if (this.rows.size >= this.maxRows) return false
    if (target !== POST_TARGET && !this.targets.has(target) && this.targets.size >= this.maxTargets) return false
    this.targets.add(target)
    this.rows.add(k)
    return true
  }
  counts() {
    const out: Record<string, Record<string, number>> = {}
    for (const k of this.rows) {
      const [t, e] = k.split('\u0000')
      const row = (out[t] ??= {})
      row[e] = (row[e] ?? 0) + 1
    }
    return out
  }
  mine(sid: string) {
    const out: Record<string, string[]> = {}
    for (const k of this.rows) {
      const [t, e, s] = k.split('\u0000')
      if (s === sid) (out[t] ??= []).push(e)
    }
    return out
  }
}

/**
 * View counting semantics, independent of storage (the Durable Object does the same on SQLite): one view per visitor id per
 * UTC day, only the current day's visitors are remembered, and a per-day cap bounds memory.
 */
export class MemoryViewStore {
  total = 0
  private day = ''
  private seen = new Set<string>()
  constructor(private maxPerDay = 20_000) {}
  /** True when this visit was counted. */
  view(vid: string, day: string): boolean {
    if (day !== this.day) {
      this.day = day
      this.seen = new Set()
    }
    if (this.seen.has(vid) || this.seen.size >= this.maxPerDay) return false
    this.seen.add(vid)
    this.total++
    return true
  }
}

/** The emoji with the highest count (ties keep preset order). */
export function topReaction(counts: Record<string, number> | undefined): { id: string; n: number } | null {
  if (!counts) return null
  let best: { id: string; n: number } | null = null
  for (const id of REACTION_IDS) {
    const n = counts[id] ?? 0
    if (n > 0 && (!best || n > best.n)) best = { id, n }
  }
  return best
}

export const sumCounts = (counts: Record<string, number> | undefined) =>
  counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0
