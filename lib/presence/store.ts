// Client-side presence store: a module singleton shared by the globe
// (imperative, per-frame reads of trails) and React (via hooks/usePresence.ts).
// Only membership changes notify React; pointer moves never do.

import { COLOR_COUNT, COORD_MAX, MAX_PTS_PER_MSG, type PeerInfo, type ServerMsg } from './protocol'

export const TRAIL_LEN = 40
/** A trail sample is fully faded this long after it was taken. */
export const TRAIL_LIFE_MS = 2000

const SEND_INTERVAL_MS = 100
const SAMPLE_INTERVAL_MS = 1000 / 15
const PING_INTERVAL_MS = 25_000
const HIDDEN_GRACE_MS = 10_000
const GIVE_UP_AFTER = 4 // consecutive handshakes that never opened (e.g. `next dev`)
const COLOR_KEY = 'presence-color'

export interface PresenceSnapshot {
  connected: boolean
  selfId: string | null
  /** 1..6; 0 until the store has been acquired on the client. */
  selfColor: number
  /** Other visitors, join order. */
  others: PeerInfo[]
  /** Total visitors incl. you (>=1 once acquired). */
  count: number
}

export interface Trail {
  color: number
  xs: Float32Array
  ys: Float32Array
  ts: Float64Array
  head: number // next write index
  len: number
}

const SSR_SNAPSHOT: PresenceSnapshot = { connected: false, selfId: null, selfColor: 0, others: [], count: 1 }

let snapshot: PresenceSnapshot = SSR_SNAPSHOT
const listeners = new Set<() => void>()
const trails = new Map<string, Trail>()
export const SELF = 'self'

let refs = 0
let ws: WebSocket | null = null
let selfColor = 0
let selfId: string | null = null
let serverCount = 0
let others: PeerInfo[] = []
let connected = false
let readOnly = false

let backoff = 0
let everOpened = false
let failures = 0
let retryTimer: ReturnType<typeof setTimeout> | undefined
let hiddenTimer: ReturnType<typeof setTimeout> | undefined
let flushTimer: ReturnType<typeof setInterval> | undefined
let pingTimer: ReturnType<typeof setInterval> | undefined
let gaveUp = false
let pending: [number, number][] = []
let lastSampleAt = 0

function emit() {
  const count = connected ? Math.max(1, serverCount) : 1
  snapshot = { connected, selfId, selfColor, others, count }
  listeners.forEach((l) => l())
}

export function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
export const getSnapshot = () => snapshot
export const getServerSnapshot = () => SSR_SNAPSHOT

export function getTrails(): ReadonlyMap<string, Trail> {
  return trails
}

// ---- trails ---------------------------------------------------------------

let activityCb: (() => void) | null = null
/** Notified whenever a trail sample is added (used to wake a paused/idle renderer). */
export function onTrailActivity(cb: (() => void) | null) {
  activityCb = cb
}

function pushTrail(key: string, color: number, x: number, y: number, t: number) {
  let tr = trails.get(key)
  if (!tr) {
    tr = {
      color,
      xs: new Float32Array(TRAIL_LEN),
      ys: new Float32Array(TRAIL_LEN),
      ts: new Float64Array(TRAIL_LEN),
      head: 0,
      len: 0,
    }
    trails.set(key, tr)
  }
  tr.color = color
  tr.xs[tr.head] = x
  tr.ys[tr.head] = y
  tr.ts[tr.head] = t
  tr.head = (tr.head + 1) % TRAIL_LEN
  if (tr.len < TRAIL_LEN) tr.len++
  activityCb?.()
}

/** Newest sample time of a trail (or -Infinity). */
export function trailNewest(tr: Trail): number {
  return tr.len ? tr.ts[(tr.head - 1 + TRAIL_LEN) % TRAIL_LEN] : -Infinity
}

/** Drop trails that have fully faded. Returns true while any trail is still visible. */
export function pruneTrails(now: number): boolean {
  for (const [k, tr] of trails) {
    if (now - trailNewest(tr) > TRAIL_LIFE_MS) trails.delete(k)
  }
  return trails.size > 0
}

// ---- self pointer ---------------------------------------------------------

/** Call with viewport-normalized (0..1) pointer coordinates. Throttled to ~15/s. */
export function pushSelfPointer(nx: number, ny: number) {
  const now = performance.now()
  if (now - lastSampleAt < SAMPLE_INTERVAL_MS) return
  lastSampleAt = now
  const x = Math.min(1, Math.max(0, nx))
  const y = Math.min(1, Math.max(0, ny))
  pushTrail(SELF, selfColor || 1, x, y, now)
  if (ws && ws.readyState === WebSocket.OPEN && !readOnly) {
    pending.push([Math.round(x * COORD_MAX), Math.round(y * COORD_MAX)])
    if (pending.length > MAX_PTS_PER_MSG) pending = pending.slice(-MAX_PTS_PER_MSG)
  }
}

function flush() {
  if (!ws || ws.readyState !== WebSocket.OPEN || pending.length === 0) return
  const p = pending
  pending = []
  try {
    ws.send(JSON.stringify({ t: 'm', p }))
  } catch {
    /* closing */
  }
}

// ---- connection -----------------------------------------------------------

function readStoredColor(): number {
  try {
    const v = Number(sessionStorage.getItem(COLOR_KEY))
    if (Number.isInteger(v) && v >= 1 && v <= COLOR_COUNT) return v
  } catch {
    /* storage unavailable */
  }
  return 0
}
function storeColor(c: number) {
  try {
    sessionStorage.setItem(COLOR_KEY, String(c))
  } catch {
    /* storage unavailable */
  }
}

function connect() {
  if (ws || gaveUp || typeof WebSocket === 'undefined' || document.hidden) return
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  let socket: WebSocket
  try {
    socket = new WebSocket(`${proto}://${location.host}/api/presence?c=${selfColor}`)
  } catch {
    return
  }
  ws = socket
  let opened = false

  socket.onopen = () => {
    opened = true
    everOpened = true
    failures = 0
    backoff = 0
    pingTimer = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send('ping')
    }, PING_INTERVAL_MS)
    flushTimer = setInterval(flush, SEND_INTERVAL_MS)
  }

  socket.onmessage = (ev) => {
    if (typeof ev.data !== 'string' || ev.data === 'pong') return
    let msg: ServerMsg
    try {
      msg = JSON.parse(ev.data)
    } catch {
      return
    }
    handle(msg)
  }

  socket.onclose = (ev) => {
    if (ws === socket) ws = null
    resetConnectionState()
    emit()
    if (refs === 0) return
    if (ev.code === 1008) {
      gaveUp = true // we were rate-limited; do not hammer
      return
    }
    if (!opened) {
      failures++
      if (!everOpened && failures >= GIVE_UP_AFTER) {
        gaveUp = true // endpoint is not there (next dev, offline); stay quiet
        return
      }
    }
    scheduleRetry()
  }
  socket.onerror = () => {
    /* handled by onclose; deliberately silent */
  }
}

function scheduleRetry() {
  if (retryTimer || document.hidden) return
  backoff = Math.min(30_000, backoff ? backoff * 2 : 1000)
  const delay = backoff * (0.75 + Math.random() * 0.5)
  retryTimer = setTimeout(() => {
    retryTimer = undefined
    connect()
  }, delay)
}

function handle(msg: ServerMsg) {
  const now = performance.now()
  switch (msg.t) {
    case 'welcome':
      selfId = msg.id
      selfColor = msg.color
      storeColor(msg.color)
      others = msg.peers.filter((p) => p.id !== msg.id)
      serverCount = msg.n
      readOnly = !!msg.ro
      connected = true
      emit()
      break
    case 'join':
      if (!others.some((p) => p.id === msg.id)) others = [...others, { id: msg.id, color: msg.color }]
      serverCount = msg.n
      emit()
      break
    case 'leave':
      others = others.filter((p) => p.id !== msg.id)
      serverCount = msg.n
      emit() // its trail is left to fade out on its own
      break
    case 'move': {
      const peer = others.find((p) => p.id === msg.id)
      if (!peer) return
      const k = msg.p.length
      // Spread the batch over the send interval so the trail reads as motion.
      for (let i = 0; i < k; i++) {
        const t = now - ((k - 1 - i) * SEND_INTERVAL_MS) / k
        pushTrail(msg.id, peer.color, msg.p[i][0] / COORD_MAX, msg.p[i][1] / COORD_MAX, t)
      }
      break
    }
  }
}

function resetConnectionState() {
  clearInterval(pingTimer)
  clearInterval(flushTimer)
  connected = false
  selfId = null
  serverCount = 0
  others = []
  readOnly = false
  pending = []
}

/** Deliberate close: detaches handlers so no retry is scheduled. */
function closeSocket(code = 1000, reason = 'hidden') {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = undefined
  }
  if (!ws) return
  const s = ws
  ws = null
  s.onopen = s.onmessage = s.onclose = s.onerror = null
  try {
    s.close(code, reason)
  } catch {
    /* ignore */
  }
  resetConnectionState()
  emit()
}

function onVisibility() {
  if (document.hidden) {
    hiddenTimer = setTimeout(() => closeSocket(), HIDDEN_GRACE_MS)
  } else {
    clearTimeout(hiddenTimer)
    hiddenTimer = undefined
    if (!ws && refs > 0) {
      backoff = 0
      connect()
    }
  }
}

export function acquire() {
  if (refs++ > 0) return
  selfColor = selfColor || readStoredColor() || 1 + Math.floor(Math.random() * COLOR_COUNT)
  storeColor(selfColor)
  gaveUp = false
  failures = 0
  if (process.env.NEXT_PUBLIC_PRESENCE !== 'off') {
    document.addEventListener('visibilitychange', onVisibility)
    connect()
  }
  emit()
}

export function release() {
  if (--refs > 0) return
  document.removeEventListener('visibilitychange', onVisibility)
  clearTimeout(hiddenTimer)
  closeSocket(1000, 'unmount')
}
