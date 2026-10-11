'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { acquire, getServerSnapshot, getSnapshot, release, subscribe, type PresenceSnapshot } from '@/lib/presence/store'

/**
 * Subscribes to presence (membership only; pointer moves never re-render).
 * The first mounted consumer opens the WebSocket, the last one closes it.
 * Safe during SSR: nothing connects until an effect runs in the browser.
 */
export function usePresence(): PresenceSnapshot {
  useEffect(() => {
    acquire()
    return release
  }, [])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export type { PresenceSnapshot }
