'use client'
import { useEffect, useState } from 'react'
import { uiBus } from '@/lib/editor/ui-bus'

type Toast = { id: number; message: string; kind?: 'error' }

/** Listens for uiBus 'toast' events ({ message, kind? }) from anywhere, including extension modules. */
export function Toasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  useEffect(
    () =>
      uiBus.on('toast', (payload) => {
        const t = payload as Omit<Toast, 'id'>
        const id = Date.now() + Math.random()
        setToasts((all) => [...all.slice(-2), { ...t, id }])
        setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), t.kind === 'error' ? 6000 : 3200)
      }),
    []
  )
  return (
    <div className="ed-toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`ed-glass ed-toast${t.kind === 'error' ? ' is-error' : ''}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
