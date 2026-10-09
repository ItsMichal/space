import { DurableObject } from 'cloudflare:workers'
import {
  COLOR_COUNT,
  COORD_MAX,
  MAX_MSG_BYTES,
  MAX_PTS_PER_MSG,
  type PeerInfo,
  type ServerMsg,
} from '../lib/presence/protocol'

/**
 * Global presence room (Hibernation API).
 *
 * All durable state lives in per-socket attachments (serializeAttachment), so
 * the object can be evicted and rebuilt from `ctx.getWebSockets()` at any
 * time. The only in-memory state is a soft rate-limit counter, which is fine
 * to lose on wake.
 */

/** Max sockets that count as visitors. Beyond this, sockets are receive-only. */
const MAX_PARTICIPANTS = 200
/** Hard cap on total sockets (participants + receive-only). */
const MAX_SOCKETS = 400
/** Soft (drop) / hard (close) message rate per socket per second. */
const RATE_SOFT = 40
const RATE_HARD = 120

interface Attachment {
  id: string
  color: number
  ro: boolean
}

const ALLOWED_HOSTS = new Set(['michal.us', 'www.michal.us', 'localhost', '127.0.0.1', '[::1]'])

export function originAllowed(origin: string | null): boolean {
  if (!origin) return false
  let host: string
  try {
    host = new URL(origin).hostname
  } catch {
    return false
  }
  return ALLOWED_HOSTS.has(host) || host.endsWith('.workers.dev')
}

function randomId(): string {
  const b = new Uint8Array(6)
  crypto.getRandomValues(b)
  let s = ''
  for (const x of b) s += x.toString(36).padStart(2, '0')
  return s
}

export class PresenceRoom extends DurableObject {
  private rate = new WeakMap<WebSocket, { win: number; n: number }>()

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never)
    // ping/pong answered by the runtime without waking the object.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 })
    }
    if (!originAllowed(request.headers.get('Origin'))) {
      return new Response('Forbidden', { status: 403 })
    }

    const sockets = this.ctx.getWebSockets()
    if (sockets.length >= MAX_SOCKETS) {
      return new Response('Room full', { status: 503 })
    }
    const peers = this.peersOf(sockets)
    const ro = peers.length >= MAX_PARTICIPANTS

    const preferred = Number(new URL(request.url).searchParams.get('c'))
    const color = this.pickColor(peers, preferred)
    const id = randomId()

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ id, color, ro } satisfies Attachment)

    const n = peers.length + (ro ? 0 : 1)
    const welcome: ServerMsg = { t: 'welcome', id, color, peers, n, ...(ro ? { ro: 1 as const } : {}) }
    server.send(JSON.stringify(welcome))
    if (!ro) this.broadcast({ t: 'join', id, color, n }, server)

    return new Response(null, { status: 101, webSocket: client })
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string') return ws.close(1003, 'text only')
    if (message.length > MAX_MSG_BYTES) return ws.close(1009, 'too big')
    if (!this.allow(ws)) return // dropped (soft) or closed (hard)

    const att = ws.deserializeAttachment() as Attachment | null
    if (!att || att.ro) return

    let data: unknown
    try {
      data = JSON.parse(message)
    } catch {
      return
    }
    const msg = data as { t?: unknown; p?: unknown }
    if (msg.t !== 'm' || !Array.isArray(msg.p)) return

    const pts: [number, number][] = []
    for (const pt of msg.p.slice(0, MAX_PTS_PER_MSG)) {
      if (!Array.isArray(pt)) continue
      const x = Math.round(Number(pt[0]))
      const y = Math.round(Number(pt[1]))
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      pts.push([Math.min(COORD_MAX, Math.max(0, x)), Math.min(COORD_MAX, Math.max(0, y))])
    }
    if (pts.length === 0) return
    this.broadcast({ t: 'move', id: att.id, p: pts }, ws)
  }

  webSocketClose(ws: WebSocket, code: number, _reason: string, _wasClean?: boolean) {
    this.handleGone(ws)
    try {
      // 1005/1006 are reserved and cannot be sent back.
      ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye')
    } catch {
      /* already closed */
    }
  }

  webSocketError(ws: WebSocket) {
    this.handleGone(ws)
    try {
      ws.close(1011, 'error')
    } catch {
      /* already closed */
    }
  }

  // ---- helpers -----------------------------------------------------------

  private handleGone(ws: WebSocket) {
    const att = ws.deserializeAttachment() as Attachment | null
    if (!att || att.ro) return
    const others = this.ctx.getWebSockets().filter((s) => s !== ws)
    const n = this.peersOf(others).length
    this.broadcast({ t: 'leave', id: att.id, n }, ws)
  }

  /** Participants (non receive-only, still open) among the given sockets, from attachments. */
  private peersOf(sockets: WebSocket[]): PeerInfo[] {
    const out: PeerInfo[] = []
    for (const s of sockets) {
      if (s.readyState !== WebSocket.READY_STATE_OPEN) continue
      const a = s.deserializeAttachment() as Attachment | null
      if (a && !a.ro) out.push({ id: a.id, color: a.color })
    }
    return out
  }

  /** Least-used color; honour the preferred one when it is within one of the minimum. */
  private pickColor(peers: PeerInfo[], preferred: number): number {
    const counts = new Array<number>(COLOR_COUNT + 1).fill(0)
    for (const p of peers) counts[p.color]++
    let min = Infinity
    for (let c = 1; c <= COLOR_COUNT; c++) min = Math.min(min, counts[c])
    if (Number.isInteger(preferred) && preferred >= 1 && preferred <= COLOR_COUNT && counts[preferred] <= min + 1) {
      return preferred
    }
    const candidates: number[] = []
    for (let c = 1; c <= COLOR_COUNT; c++) if (counts[c] === min) candidates.push(c)
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  private broadcast(msg: ServerMsg, except?: WebSocket) {
    const text = JSON.stringify(msg)
    for (const s of this.ctx.getWebSockets()) {
      if (s === except || s.readyState !== WebSocket.READY_STATE_OPEN) continue
      try {
        s.send(text)
      } catch {
        /* closing */
      }
    }
  }

  /** Per-second counter. >RATE_SOFT dropped, >RATE_HARD closes the socket. */
  private allow(ws: WebSocket): boolean {
    const now = Date.now()
    let r = this.rate.get(ws)
    if (!r || now - r.win >= 1000) {
      r = { win: now, n: 0 }
      this.rate.set(ws, r)
    }
    r.n++
    if (r.n > RATE_HARD) {
      ws.close(1008, 'rate limit')
      return false
    }
    return r.n <= RATE_SOFT
  }
}
