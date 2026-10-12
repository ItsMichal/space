'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { isAutomated, reactionsApi, readMine, writeMine, type ReactionsApi } from '@/lib/presence/client'
import type { ReactionTotals } from '@/lib/presence/protocol'

// One shared store per post postId, used by the ReactionBar and the highlight reactions.
export interface ReactionsState {
  status: 'idle' | 'loading' | 'ready' | 'off'
  post: Record<string, number>
  blocks: Record<string, Record<string, number>>
  mine: Record<string, string[]>
  /** Visits counted so far; null when the Worker does not publish them (VIEWS_PUBLIC=0). */
  views: number | null
}

const EMPTY: ReactionsState = { status: 'idle', post: {}, blocks: {}, mine: {}, views: null }

interface Entry {
  state: ReactionsState
  subs: Set<() => void>
  inflight: Map<string, boolean>
  want: Map<string, boolean>
}
const entries = new Map<string, Entry>()
let api: ReactionsApi = reactionsApi
/** Swap the transport (the demo route uses an in-memory one when no Worker is running). */
export function setReactionsApi(next: ReactionsApi) {
  api = next
  entries.clear()
}

function entry(postId: string): Entry {
  let e = entries.get(postId)
  if (!e) {
    e = { state: { ...EMPTY }, subs: new Set(), inflight: new Map(), want: new Map() }
    entries.set(postId, e)
  }
  return e
}
function set(postId: string, patch: Partial<ReactionsState>) {
  const e = entry(postId)
  e.state = { ...e.state, ...patch }
  e.subs.forEach((f) => f())
}

async function load(postId: string) {
  const e = entry(postId)
  if (e.state.status !== 'idle') return
  if (isAutomated()) return set(postId, { status: 'off' })
  set(postId, { status: 'loading', mine: readMine(postId) })
  const t: ReactionTotals | null = await api.totals(postId)
  if (!t) return set(postId, { status: 'off' })
  set(postId, { status: 'ready', post: t.post, blocks: t.blocks, views: typeof t.views === 'number' ? t.views : null })
}

const countsOf = (s: ReactionsState, target: string) => (target === 'post' ? s.post : (s.blocks[target] ?? {}))

/** Optimistic toggle. Requests for one (target, emoji) are serialised; the last desired state wins. Rolls back on failure. */
export async function toggle(postId: string, target: string, emoji: string) {
  const e = entry(postId)
  const key = `${target}|${emoji}`
  const had = (e.state.mine[target] ?? []).includes(emoji)
  const on = !had
  applyLocal(postId, target, emoji, on)
  e.want.set(key, on)
  if (e.inflight.has(key)) return
  while (e.want.has(key)) {
    const desired = e.want.get(key)!
    e.want.delete(key)
    e.inflight.set(key, desired)
    const r = await api.react(postId, target, emoji, desired)
    e.inflight.delete(key)
    if (!r) {
      // Roll back to the last confirmed state: re-read from the server on the next load, and undo the optimistic change now.
      applyLocal(postId, target, emoji, !desired)
      e.want.delete(key)
      break
    }
    if (!e.want.has(key)) {
      // Reconcile with the authoritative result.
      const mine = { ...e.state.mine, [target]: r.mine }
      writeMine(postId, mine)
      if (target === 'post') set(postId, { post: r.counts, mine })
      else set(postId, { blocks: { ...e.state.blocks, [target]: r.counts }, mine })
    }
  }
}

function applyLocal(postId: string, target: string, emoji: string, on: boolean) {
  const e = entry(postId)
  const s = e.state
  const counts = { ...countsOf(s, target) }
  counts[emoji] = Math.max(0, (counts[emoji] ?? 0) + (on ? 1 : -1))
  const cur = s.mine[target] ?? []
  const nextMine = on ? [...new Set([...cur, emoji])] : cur.filter((x) => x !== emoji)
  const mine = { ...s.mine, [target]: nextMine }
  writeMine(postId, mine)
  if (target === 'post') set(postId, { post: counts, mine })
  else set(postId, { blocks: { ...s.blocks, [target]: counts }, mine })
}

/** Current state of a post's reactions store (tests and non-React callers). */
export const getReactionsState = (postId: string): ReactionsState => entry(postId).state
/** Load totals now (the hook does this when the row scrolls near). */
export const loadReactions = (postId: string) => load(postId)

export function useReactions(postId: string, enabled = true): ReactionsState {
  const e = entry(postId)
  const state = useSyncExternalStore(
    (cb) => {
      e.subs.add(cb)
      return () => e.subs.delete(cb)
    },
    () => e.state,
    () => EMPTY,
  )
  useEffect(() => {
    if (enabled) void load(postId)
  }, [postId, enabled])
  return state
}
