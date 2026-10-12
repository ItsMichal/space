// Small typed browser client for /api/live/*. No dependencies. Nothing here runs during SSR.
import { DEFAULT_VISIT_EMOJI } from './constants'
import type { LivePin, PastPin, ReactionResult, ReactionTotals, ServerMsg } from './protocol'
import { MemoryReactionStore } from './reactions-core'
import { REACTION_IDS } from './constants'

const SID_KEY = 'live.sid'
const EMOJI_KEY = 'live.emoji'

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

/** Anonymous random id for this browser tab session. sessionStorage only; falls back to memory. */
let memSid = ''
export function sessionId(): string {
  const have = safe(() => sessionStorage.getItem(SID_KEY), null) ?? memSid
  if (have && /^[A-Za-z0-9_-]{16,32}$/.test(have)) return have
  const b = new Uint8Array(15)
  crypto.getRandomValues(b)
  const id = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  memSid = id
  safe(() => sessionStorage.setItem(SID_KEY, id), undefined)
  return id
}

export function savedEmoji(): string {
  return safe(() => sessionStorage.getItem(EMOJI_KEY), null) ?? DEFAULT_VISIT_EMOJI
}
export function saveEmoji(id: string) {
  safe(() => sessionStorage.setItem(EMOJI_KEY, id), undefined)
}

/** True for crawlers and automation, which never open sockets or write. */
export function isAutomated(): boolean {
  return typeof navigator !== 'undefined' && navigator.webdriver === true
}

export interface PresenceState {
  status: 'idle' | 'connecting' | 'live' | 'off'
  you: LivePin | null
  where: { city: string; region: string; country: string }
  live: LivePin[]
  past: PastPin[]
  /** Everyone online now, including you and visitors with no known location. */
  n: number
}

export const EMPTY_PRESENCE: PresenceState = { status: 'idle', you: null, where: { city: '', region: '', country: '' }, live: [], past: [], n: 0 }

export interface PresenceClient {
  start(): void
  /** Close the socket (tab hidden / card off screen). State stays as last seen. */
  pause(): void
  setEmoji(id: string): void
  destroy(): void
  getState(): PresenceState
  subscribe(fn: () => void): () => void
}

const wsUrl = () => `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/live/presence`

export function createPresenceClient(): PresenceClient {
  let state: PresenceState = EMPTY_PRESENCE
  const subs = new Set<() => void>()
  let ws: WebSocket | null = null
  let ping: ReturnType<typeof setInterval> | null = null
  let retry: ReturnType<typeof setTimeout> | null = null
  let tries = 0
  let wanted = false
  let dead = false
  const live = new Map<string, LivePin>()
  let youPin: LivePin | null = null
  let nOnline = 0

  const emit = (patch: Partial<PresenceState>) => {
    state = { ...state, ...patch }
    subs.forEach((f) => f())
  }
  const publish = () => emit({ live: [...live.values()], you: youPin, n: Math.max(nOnline, live.size + (youPin ? 1 : 0)) })

  async function probe(): Promise<'ok' | 'off'> {
    // A plain GET: 426 means the socket endpoint is there; 204 is the kill switch; anything else (404 in dev, 5xx) hides the card.
    try {
      const r = await fetch('/api/live/presence', { cache: 'no-store' })
      return r.status === 426 ? 'ok' : 'off'
    } catch {
      return 'off'
    }
  }

  async function open() {
    if (dead || !wanted || ws) return
    if (isAutomated()) return emit({ status: 'off' })
    emit({ status: state.status === 'live' ? 'live' : 'connecting' })
    if (tries === 0 && (await probe()) === 'off') {
      dead = true
      return emit({ status: 'off' })
    }
    if (!wanted) return
    const sock = new WebSocket(wsUrl())
    ws = sock
    sock.onopen = () => {
      tries = 0
      sock.send(JSON.stringify({ t: 'hi', sid: sessionId(), emoji: savedEmoji() }))
      ping = setInterval(() => sock.readyState === 1 && sock.send('{"t":"ping"}'), 25_000)
    }
    sock.onmessage = (e) => {
      let m: ServerMsg
      try {
        m = JSON.parse(String(e.data))
      } catch {
        return
      }
      if (m.t === 'welcome') {
        live.clear()
        for (const p of m.live) if (p.id) live.set(p.id, p)
        youPin = m.you
        nOnline = m.live.length + 1
        emit({ status: 'live', where: m.where, past: m.past })
        publish()
      } else if (m.t === 'd') {
        for (const p of m.add ?? []) if (!youPin || p.id !== youPin.id) live.set(p.id, p)
        for (const id of m.rm ?? []) live.delete(id)
        for (const [id, em] of m.em ?? []) {
          const p = live.get(id)
          if (p) live.set(id, { ...p, emoji: em })
        }
        nOnline = m.n
        publish()
      }
    }
    const closed = () => {
      if (ws !== sock) return
      ws = null
      if (ping) clearInterval(ping)
      ping = null
      if (wanted && !dead) {
        tries++
        if (tries > 6) {
          dead = true
          return emit({ status: 'off' })
        }
        const delay = Math.min(30_000, 1000 * 2 ** tries) * (0.7 + Math.random() * 0.6)
        retry = setTimeout(open, delay)
      }
    }
    sock.onclose = closed
    sock.onerror = () => sock.close()
  }

  return {
    start() {
      wanted = true
      if (retry) clearTimeout(retry)
      retry = null
      void open()
    },
    pause() {
      wanted = false
      if (retry) clearTimeout(retry)
      retry = null
      if (ping) clearInterval(ping)
      ping = null
      const s = ws
      ws = null
      s?.close(1000, 'hidden')
      if (state.status === 'live') emit({ status: 'idle' })
    },
    setEmoji(id) {
      saveEmoji(id)
      if (youPin) {
        youPin = { ...youPin, emoji: id }
        publish()
      }
      if (ws?.readyState === 1) ws.send(JSON.stringify({ t: 'em', emoji: id }))
    },
    destroy() {
      dead = true
      this.pause()
      subs.clear()
    },
    getState: () => state,
    subscribe(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }
}

// ---- reactions -------------------------------------------------------------

const MINE_KEY = (slug: string) => `live.mine.${slug}`

export function readMine(slug: string): Record<string, string[]> {
  return safe(() => JSON.parse(sessionStorage.getItem(MINE_KEY(slug)) ?? '{}') as Record<string, string[]>, {})
}
export function writeMine(slug: string, mine: Record<string, string[]>) {
  safe(() => sessionStorage.setItem(MINE_KEY(slug), JSON.stringify(mine)), undefined)
}

export type ReactionsApi = {
  totals(slug: string): Promise<ReactionTotals | null>
  react(slug: string, target: string, emoji: string, on: boolean): Promise<ReactionResult | null>
}

/** The real API. Returns null on any failure so callers roll back / hide. */
export const reactionsApi: ReactionsApi = {
  async totals(slug) {
    try {
      const r = await fetch(`/api/live/reactions?slug=${encodeURIComponent(slug)}`)
      if (r.status !== 200) return null
      return (await r.json()) as ReactionTotals
    } catch {
      return null
    }
  },
  async react(slug, target, emoji, on) {
    try {
      const r = await fetch('/api/live/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, target, emoji, sid: sessionId(), on }),
      })
      if (r.status !== 200) return null
      return (await r.json()) as ReactionResult
    } catch {
      return null
    }
  },
}

/** In-memory stand-in for the demo route when no Worker is running. Same shape, same semantics. */
export function createMockReactionsApi(seed: Record<string, Record<string, number>> = {}): ReactionsApi {
  const store = new MemoryReactionStore()
  const base = seed
  const counts = (target: string) => {
    const out: Record<string, number> = { ...(base[target] ?? {}) }
    for (const [e, n] of Object.entries(store.counts()[target] ?? {})) out[e] = (out[e] ?? 0) + n
    return out
  }
  return {
    async totals(slug) {
      const post = counts('post')
      const blocks: Record<string, Record<string, number>> = {}
      const targets = new Set([...Object.keys(base), ...Object.keys(store.counts())])
      targets.delete('post')
      for (const t of targets) blocks[t] = counts(t)
      return { v: 1, slug, post, blocks }
    },
    async react(_slug, target, emoji, on) {
      if (!REACTION_IDS.includes(emoji)) return null
      store.set(target, emoji, sessionId(), on)
      return { v: 1, target, counts: counts(target), mine: store.mine(sessionId())[target] ?? [] }
    },
  }
}
