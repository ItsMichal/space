// Client side of view counting. One view per visitor per post per UTC day (the server enforces the same rule; this just
// avoids sending what it would drop). A view is sent only after the page has been visible for `delayMs` in total, never
// for a prefetch or prerender, never for automation. DOM access goes through the arguments so it is testable.
import { sessionId } from './client'

const KEY = (id: string) => `live.v.${id}`
export const VIEW_DELAY_MS = 5000

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10)

export function alreadyCounted(id: string, now = Date.now()): boolean {
  return safe(() => localStorage.getItem(KEY(id)) === utcDay(now), false)
}
function markCounted(id: string, now = Date.now()) {
  safe(() => localStorage.setItem(KEY(id), utcDay(now)), undefined)
}

export type ViewSender = (id: string, vid: string) => void

/** Fire-and-forget POST that survives the page going away. Errors are swallowed: a missed view is fine. */
export const sendView: ViewSender = (id, vid) => {
  try {
    void fetch('/api/live/views', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, vid }),
    }).catch(() => {})
  } catch {
    /* blocked by an extension or offline: nothing to do */
  }
}

interface Env {
  doc: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'> & { prerendering?: boolean }
  automated: boolean
  send: ViewSender
  delayMs: number
}

/** Starts counting visible time; returns a cancel function. Calls `send` at most once. */
export function scheduleView(id: string, env: Partial<Env> = {}): () => void {
  const doc: Env['doc'] = env.doc ?? document
  const send = env.send ?? sendView
  const delay = env.delayMs ?? VIEW_DELAY_MS
  const automated = env.automated ?? (typeof navigator !== 'undefined' && navigator.webdriver === true)
  if (automated || alreadyCounted(id)) return () => {}
  let timer: ReturnType<typeof setTimeout> | null = null
  let remaining = delay
  let startedAt = 0
  let done = false
  const stop = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  const fire = () => {
    if (done) return
    done = true
    cleanup()
    markCounted(id)
    send(id, sessionId())
  }
  const run = () => {
    stop()
    if (done || doc.visibilityState !== 'visible' || doc.prerendering) return
    startedAt = Date.now()
    timer = setTimeout(fire, remaining)
  }
  const onVis = () => {
    if (doc.visibilityState === 'visible') run()
    else if (timer) {
      remaining = Math.max(0, remaining - (Date.now() - startedAt))
      stop()
    }
  }
  const cleanup = () => {
    stop()
    doc.removeEventListener('visibilitychange', onVis)
    doc.removeEventListener('prerenderingchange', onVis)
  }
  doc.addEventListener('visibilitychange', onVis)
  doc.addEventListener('prerenderingchange', onVis)
  run()
  return () => {
    done = true
    cleanup()
  }
}
