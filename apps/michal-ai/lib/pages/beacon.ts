// The private page beacon (docs/private-pages.md): what a /p/<token> page tells /api/pages/event. Browser only, no cookies, no
// storage: the visit id is made up per page load and kept in memory. Events:
//   view   once, with the referrer (the Worker keeps only its host)
//   beat   every 15 s while the tab is visible, with the visible time so far
//   hide   when the tab is hidden or the page is left, with the visible time so far (sendBeacon, so it survives unload)
//   click  a click on any link, with its target (the Worker keeps a path, or a host and path)
import { useEffect } from 'react'
import { PAGE_TOKEN_RE } from '@/lib/content/pages.mjs'
import type { PageEvent } from './stats'

export const PAGE_EVENT_URL = '/api/pages/event'
const BEAT_MS = 15_000

function newVid(): string {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  return [...crypto.getRandomValues(new Uint8Array(20))].map((b) => a[b & 63]).join('')
}

/** The token in the address bar, or null (the prerendered key, a dev preview, anything else). */
export function tokenFromPath(pathname: string): string | null {
  const m = /^\/p\/([^/.]+)$/.exec(pathname)
  return m && PAGE_TOKEN_RE.test(m[1]) ? m[1] : null
}

function send(ev: PageEvent, unloading = false) {
  const body = JSON.stringify(ev)
  try {
    if (unloading && navigator.sendBeacon?.(PAGE_EVENT_URL, new Blob([body], { type: 'text/plain' }))) return
    void fetch(PAGE_EVENT_URL, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' }, credentials: 'omit' }).catch(() => undefined)
  } catch {}
}

/** Visible-time clock: runs only while the document is visible. */
export function visibleClock(now: () => number = () => performance.now()) {
  let total = 0
  let since: number | null = null
  return {
    start() {
      if (since === null) since = now()
    },
    stop() {
      if (since !== null) total += now() - since
      since = null
    },
    ms: () => Math.round(total + (since === null ? 0 : now() - since)),
  }
}

/** Mount once on a private page. Does nothing unless the address bar holds a token. */
export function usePageBeacon() {
  useEffect(() => {
    const t = tokenFromPath(location.pathname)
    if (!t) return
    const v = newVid()
    const clock = visibleClock()
    if (document.visibilityState === 'visible') clock.start()
    send({ t, v, e: 'view', ref: document.referrer || '' })
    let lastSent = -1
    const report = (e: 'beat' | 'hide', unloading = false) => {
      const ms = clock.ms()
      if (ms === lastSent) return
      lastSent = ms
      send({ t, v, e, ms }, unloading)
    }
    const beat = setInterval(() => {
      if (document.visibilityState === 'visible') report('beat')
    }, BEAT_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') clock.start()
      else {
        clock.stop()
        report('hide', true)
      }
    }
    const onHide = () => {
      clock.stop()
      report('hide', true)
    }
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      // A link on this site goes as its path, whatever host serves the page; the Worker keeps a host for any other.
      if (a) send({ t, v, e: 'click', href: a.origin === location.origin ? a.pathname : a.href }, true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onHide)
    document.addEventListener('click', onClick, true)
    document.addEventListener('auxclick', onClick, true)
    return () => {
      clearInterval(beat)
      clock.stop()
      report('hide', true)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('auxclick', onClick, true)
    }
  }, [])
}
