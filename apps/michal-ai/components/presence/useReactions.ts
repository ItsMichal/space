'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { isAutomated, reactionsApi, readMine, writeMine, type ReactionsApi } from '@/lib/presence/client'
import type { ReactionTotals } from '@/lib/presence/protocol'

// One shared store per post slug, used by the ReactionBar and the highlight reactions.
export interface ReactionsState {
  status: 'idle' | 'loading' | 'ready' | 'off'
  post: Record<string, number>
  blocks: Record<string, Record<string, number>>
  mine: Record<string, string[]>
}

const EMPTY: ReactionsState = { status: 'idle', post: {}, blocks: {}, mine: {} }

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

function entry(slug: string): Entry {
  let e = entries.get(slug)
  if (!e) {
    e = { state: { ...EMPTY }, subs: new Set(), inflight: new Map(), want: new Map() }
    entries.set(slug, e)
  }
  return e
}
function set(slug: string, patch: Partial<ReactionsState>) {
  const e = entry(slug)
  e.state = { ...e.state, ...patch }
  e.subs.forEach((f) => f())
}

async function load(slug: string) {
  const e = entry(slug)
  if (e.state.status !== 'idle') return
  if (isAutomated()) return set(slug, { status: 'off' })
  set(slug, { status: 'loading', mine: readMine(slug) })
  const t: ReactionTotals | null = await api.totals(slug)
  if (!t) return set(slug, { status: 'off' })
  set(slug, { status: 'ready', post: t.post, blocks: t.blocks })
}

const countsOf = (s: ReactionsState, target: string) => (target === 'post' ? s.post : (s.blocks[target] ?? {}))

/** Optimistic toggle. Requests for one (target, emoji) are serialised; the last desired state wins. Rolls back on failure. */
export async function toggle(slug: string, target: string, emoji: string) {
  const e = entry(slug)
  const key = `${target}|${emoji}`
  const had = (e.state.mine[target] ?? []).includes(emoji)
  const on = !had
  applyLocal(slug, target, emoji, on)
  e.want.set(key, on)
  if (e.inflight.has(key)) return
  while (e.want.has(key)) {
    const desired = e.want.get(key)!
    e.want.delete(key)
    e.inflight.set(key, desired)
    const r = await api.react(slug, target, emoji, desired)
    e.inflight.delete(key)
    if (!r) {
      // Roll back to the last confirmed state: re-read from the server on the next load, and undo the optimistic change now.
      applyLocal(slug, target, emoji, !desired)
      e.want.delete(key)
      break
    }
    if (!e.want.has(key)) {
      // Reconcile with the authoritative result.
      const mine = { ...e.state.mine, [target]: r.mine }
      writeMine(slug, mine)
      if (target === 'post') set(slug, { post: r.counts, mine })
      else set(slug, { blocks: { ...e.state.blocks, [target]: r.counts }, mine })
    }
  }
}

function applyLocal(slug: string, target: string, emoji: string, on: boolean) {
  const e = entry(slug)
  const s = e.state
  const counts = { ...countsOf(s, target) }
  counts[emoji] = Math.max(0, (counts[emoji] ?? 0) + (on ? 1 : -1))
  const cur = s.mine[target] ?? []
  const nextMine = on ? [...new Set([...cur, emoji])] : cur.filter((x) => x !== emoji)
  const mine = { ...s.mine, [target]: nextMine }
  writeMine(slug, mine)
  if (target === 'post') set(slug, { post: counts, mine })
  else set(slug, { blocks: { ...s.blocks, [target]: counts }, mine })
}

export function useReactions(slug: string, enabled = true): ReactionsState {
  const e = entry(slug)
  const state = useSyncExternalStore(
    (cb) => {
      e.subs.add(cb)
      return () => e.subs.delete(cb)
    },
    () => e.state,
    () => EMPTY,
  )
  useEffect(() => {
    if (enabled) void load(slug)
  }, [slug, enabled])
  return state
}
