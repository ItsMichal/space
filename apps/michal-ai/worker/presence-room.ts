import { DurableObject } from 'cloudflare:workers'
import { LIVE_LIMITS } from '../lib/presence/constants'
import { publicPoint, type Place } from '../lib/presence/geo'
import { addVisit, markSeen, utcDay, type PastVisit, type SeenSet } from '../lib/presence/history'
import type { LivePin, PastPin, ServerMsg } from '../lib/presence/protocol'
import { ipKey } from '../lib/presence/ratelimit'
import { parseClientMsg } from '../lib/presence/validate'

/**
 * Global presence room (WebSocket Hibernation API).
 *
 * Live sessions live only in socket attachments, so the object can be evicted and rebuilt from `ctx.getWebSockets()`.
 * Nothing about a live session is written to storage. Storage holds exactly two things: the rolling visit history
 * (snapped point, city, country, emoji, day; no session id) and a per-day set of salted session hashes used only to
 * count one visit per session per day (dropped when the day changes).
 *
 * Privacy: the Worker passes the edge-derived place already snapped to a 0.5 degree grid; the room adds deterministic jitter
 * keyed by a random per-connection id. IP addresses are never seen here: the Worker sends a salted, daily-rotating hash,
 * kept only in the socket attachment for the per-IP connection cap.
 */

interface Att {
  id: string
  ipk: string
  /** Edge-derived place (already snapped). */
  place: Place | null
  /** Set once the client has said hello. */
  pin?: LivePin
  joined: number
  seen: number
}

const HIST_KEY = 'hist'
const SEEN_KEY = 'seen'
const SWEEP_MS = 30_000
const HELLO_GRACE_MS = 15_000

function randomId(): string {
  const b = new Uint8Array(8)
  crypto.getRandomValues(b)
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

interface Env {
  LIVE_SALT?: string
}

export class PresenceRoom extends DurableObject<Env> {
  private rate = new WeakMap<WebSocket, { win: number; n: number }>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private pend = { add: new Map<string, LivePin>(), rm: new Set<string>(), em: new Map<string, string>() }

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // ping/pong answered by the runtime without waking the object.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'))
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket upgrade', { status: 426 })
    const ipk = request.headers.get('x-live-ipk') ?? ''
    let place: Place | null = null
    try {
      const raw = request.headers.get('x-live-place')
      place = raw ? (JSON.parse(raw) as Place) : null
    } catch {
      place = null
    }

    const socks = this.ctx.getWebSockets()
    if (socks.length >= LIVE_LIMITS.maxLive) return new Response('Full', { status: 503, headers: { 'Retry-After': '30' } })
    if (ipk && socks.filter((s) => (s.deserializeAttachment() as Att | null)?.ipk === ipk).length >= LIVE_LIMITS.maxSocketsPerIp) {
      return new Response('Too many connections', { status: 429, headers: { 'Retry-After': '30' } })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    const now = Date.now()
    server.serializeAttachment({ id: randomId(), ipk, place, joined: now, seen: now } satisfies Att)
    await this.ensureAlarm()
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string') return ws.close(1003, 'text only')
    if (message.length > LIVE_LIMITS.maxMsgBytes) return ws.close(1009, 'too big')
    if (!this.allow(ws)) return
    const att = ws.deserializeAttachment() as Att | null
    if (!att) return
    att.seen = Date.now()
    const msg = parseClientMsg(message)
    if (!msg || msg.t === 'ping') {
      ws.serializeAttachment(att)
      return
    }

    if (msg.t === 'em') {
      if (!att.pin) return
      att.pin = { ...att.pin, emoji: msg.emoji }
      ws.serializeAttachment(att)
      this.queue(() => this.pend.em.set(att.id, msg.emoji))
      await this.updateHistoryEmoji(att.pin)
      return
    }

    // hello (once)
    if (att.pin) return
    const p = att.place ? publicPoint(att.place.lat, att.place.lon, att.id) : null
    const pin: LivePin = {
      id: att.id,
      lat: p?.lat ?? 0,
      lon: p?.lon ?? 0,
      city: att.place?.city ?? '',
      country: att.place?.country ?? '',
      emoji: msg.emoji,
    }
    if (p) att.pin = pin
    else att.pin = { ...pin, lat: NaN, lon: NaN } // present but unlocated: counted, not drawn
    ws.serializeAttachment(att)

    const sidHash = await ipKey(msg.sid, this.env.LIVE_SALT ?? 'space-live')
    const past = await this.recordVisit(sidHash, p ? pin : null)
    const welcome: ServerMsg = {
      t: 'welcome',
      you: p ? pin : null,
      where: { city: att.place?.city ?? '', region: att.place?.region ?? '', country: att.place?.country ?? '' },
      live: this.livePins(ws),
      past,
    }
    ws.send(JSON.stringify(welcome))
    if (p) this.queue(() => this.pend.add.set(att.id, pin))
    else this.queue(() => {})
  }

  webSocketClose(ws: WebSocket, code: number) {
    this.gone(ws)
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye')
    } catch {
      /* already closed */
    }
  }

  webSocketError(ws: WebSocket) {
    this.gone(ws)
    try {
      ws.close(1011, 'error')
    } catch {
      /* already closed */
    }
  }

  async alarm() {
    const now = Date.now()
    const socks = this.ctx.getWebSockets()
    for (const ws of socks) {
      const att = ws.deserializeAttachment() as Att | null
      if (!att) continue
      const auto = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0
      const last = Math.max(att.seen, auto)
      const stale = now - last > LIVE_LIMITS.idleMs
      const mute = !att.pin && now - att.joined > HELLO_GRACE_MS
      if (stale || mute) {
        this.gone(ws)
        try {
          ws.close(1001, 'idle')
        } catch {
          /* already closed */
        }
      }
    }
    if (this.ctx.getWebSockets().length > 0) await this.ctx.storage.setAlarm(now + SWEEP_MS)
  }

  // ---- helpers ------------------------------------------------------------

  private async ensureAlarm() {
    if ((await this.ctx.storage.getAlarm()) == null) await this.ctx.storage.setAlarm(Date.now() + SWEEP_MS)
  }

  private livePins(except?: WebSocket): LivePin[] {
    const out: LivePin[] = []
    for (const s of this.ctx.getWebSockets()) {
      if (s === except || s.readyState !== WebSocket.READY_STATE_OPEN) continue
      const a = s.deserializeAttachment() as Att | null
      if (a?.pin && Number.isFinite(a.pin.lat)) out.push(a.pin)
    }
    return out
  }

  private count(): number {
    let n = 0
    for (const s of this.ctx.getWebSockets()) {
      if (s.readyState !== WebSocket.READY_STATE_OPEN) continue
      if ((s.deserializeAttachment() as Att | null)?.pin) n++
    }
    return n
  }

  private gone(ws: WebSocket) {
    const att = ws.deserializeAttachment() as Att | null
    if (!att?.pin) return
    this.queue(() => {
      this.pend.rm.add(att.id)
      this.pend.add.delete(att.id)
    })
  }

  /** Coalesce changes and flush at most once per `flushMs`. */
  private queue(mutate: () => void) {
    mutate()
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.flush()
    }, LIVE_LIMITS.flushMs)
  }

  private flush() {
    const { add, rm, em } = this.pend
    this.pend = { add: new Map(), rm: new Set(), em: new Map() }
    const msg: ServerMsg = {
      t: 'd',
      n: this.count(),
      ...(add.size ? { add: [...add.values()] } : {}),
      ...(rm.size ? { rm: [...rm] } : {}),
      ...(em.size ? { em: [...em.entries()] } : {}),
    }
    const text = JSON.stringify(msg)
    for (const s of this.ctx.getWebSockets()) {
      if (s.readyState !== WebSocket.READY_STATE_OPEN) continue
      if (!(s.deserializeAttachment() as Att | null)?.pin) continue
      try {
        s.send(text)
      } catch {
        /* closing */
      }
    }
  }

  private async recordVisit(sidHash: string, pin: LivePin | null): Promise<PastPin[]> {
    const now = Date.now()
    const day = utcDay(now)
    let hist = (await this.ctx.storage.get<PastVisit[]>(HIST_KEY)) ?? []
    if (pin) {
      const seen = (await this.ctx.storage.get<SeenSet>(SEEN_KEY)) ?? { day, ids: [] }
      const r = markSeen(seen, sidHash, day)
      if (r.first) {
        hist = addVisit(hist, { lat: pin.lat, lon: pin.lon, city: pin.city, country: pin.country, emoji: pin.emoji, day }, now)
        await this.ctx.storage.put({ [HIST_KEY]: hist, [SEEN_KEY]: r.seen })
      }
    }
    // Everyone currently online is shown as live, so do not also show them as past: drop entries that match a live pin.
    const liveKeys = new Set(this.livePins().map((p) => `${p.lat},${p.lon}`))
    return hist.filter((h) => !liveKeys.has(`${h.lat},${h.lon}`)).map((h) => ({ ...h }))
  }

  private async updateHistoryEmoji(pin: LivePin) {
    if (!Number.isFinite(pin.lat)) return
    const hist = await this.ctx.storage.get<PastVisit[]>(HIST_KEY)
    if (!hist) return
    const day = utcDay(Date.now())
    for (let i = hist.length - 1; i >= 0; i--) {
      if (hist[i].lat === pin.lat && hist[i].lon === pin.lon && hist[i].day === day) {
        hist[i] = { ...hist[i], emoji: pin.emoji }
        await this.ctx.storage.put(HIST_KEY, hist)
        return
      }
    }
  }

  /** Per-socket window. Over the allowance messages are dropped; far over closes the socket. */
  private allow(ws: WebSocket): boolean {
    const now = Date.now()
    let r = this.rate.get(ws)
    if (!r || now - r.win >= LIVE_LIMITS.msgWindowMs) {
      r = { win: now, n: 0 }
      this.rate.set(ws, r)
    }
    r.n++
    if (r.n > LIVE_LIMITS.msgPerWindow * 4) {
      ws.close(1008, 'rate limit')
      return false
    }
    return r.n <= LIVE_LIMITS.msgPerWindow
  }
}
