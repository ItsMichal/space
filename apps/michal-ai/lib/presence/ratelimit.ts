// Fixed-window limiter held in memory only. Keys are salted IP hashes (never raw IPs); nothing is persisted.
export interface Limiter {
  /** Count a hit. `ok` is false once the window's allowance is used up. */
  hit(key: string, now?: number): { ok: boolean; retryAfter: number }
  size(): number
}

export function createLimiter(limit: number, windowMs: number, maxKeys = 5000): Limiter {
  const m = new Map<string, { start: number; n: number }>()
  return {
    hit(key, now = Date.now()) {
      let e = m.get(key)
      if (!e || now - e.start >= windowMs) {
        if (!e && m.size >= maxKeys) {
          for (const [k, v] of m) if (now - v.start >= windowMs) m.delete(k)
          if (m.size >= maxKeys) m.delete(m.keys().next().value as string)
        }
        e = { start: now, n: 0 }
        m.set(key, e)
      }
      e.n++
      const ok = e.n <= limit
      return { ok, retryAfter: ok ? 0 : Math.max(1, Math.ceil((e.start + windowMs - now) / 1000)) }
    },
    size: () => m.size,
  }
}

/** Salted hash of an IP for in-memory limiting. The salt rotates daily, so hashes are not linkable across days. */
export async function ipKey(ip: string, salt: string, now = Date.now()): Promise<string> {
  const day = new Date(now).toISOString().slice(0, 10)
  const data = new TextEncoder().encode(`${salt}|${day}|${ip}`)
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', data))
  let s = ''
  for (let i = 0; i < 8; i++) s += d[i].toString(16).padStart(2, '0')
  return s
}
