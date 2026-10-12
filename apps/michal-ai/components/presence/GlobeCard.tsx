'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { DEFAULT_VISIT_EMOJI } from '@/lib/presence/constants'
import { createPresenceClient, EMPTY_PRESENCE, savedEmoji, type PresenceClient } from '@/lib/presence/client'
import { createMockPresence } from '@/lib/presence/mock'
import { EmojiPicker } from './EmojiPicker'
import { GlobeView } from './GlobeView'
import './presence.css'

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? ''
  } catch {
    return ''
  }
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia('(prefers-reduced-motion: reduce)')
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}

/**
 * The visitors card: greeting, globe, who is here, and the emoji for your visit.
 * Connects only while the card is near the viewport and the tab is visible. Hides itself when the feature is off.
 */
export function GlobeCard({ mock = false, className = '' }: { mock?: boolean; className?: string }) {
  const root = useRef<HTMLElement>(null)
  const client = useMemo<PresenceClient>(() => (mock ? createMockPresence() : createPresenceClient()), [mock])
  const state = useSyncExternalStore(client.subscribe, client.getState, () => EMPTY_PRESENCE)
  const reduced = useReducedMotion()
  const [near, setNear] = useState(false)
  const [visible, setVisible] = useState(true)
  const [emoji, setEmoji] = useState<string>(DEFAULT_VISIT_EMOJI)

  useEffect(() => setEmoji(savedEmoji()), [])
  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '240px' })
    io.observe(el)
    const vis = () => setVisible(document.visibilityState === 'visible')
    vis()
    document.addEventListener('visibilitychange', vis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', vis)
    }
  }, [])

  const active = near && visible
  useEffect(() => {
    if (active) client.start()
    else client.pause()
  }, [active, client])
  useEffect(() => () => client.destroy(), [client])

  if (state.status === 'off') return null

  const place = state.where.city || (state.where.country ? countryName(state.where.country) : '')
  const hello = place ? `Hello from ${place}` : 'Hello'
  const others = state.live.filter((p) => p.id !== state.you?.id)
  const names = [...new Set(others.map((p) => p.city || countryName(p.country)).filter(Boolean))].slice(0, 6)
  const here = state.status === 'live' ? state.n : 0
  const recent = state.past.length

  return (
    <section ref={root} className={`presence-card ${className}`} aria-label="Visitors">
      <h2 className="presence-card__hello">{hello}</h2>
      <GlobeView
        you={state.you}
        live={state.live}
        past={state.past}
        active={active}
        faceTo={state.you ? { lat: state.you.lat, lon: state.you.lon } : state.status === 'live' ? { lat: 34, lon: -118.5 } : null}
        reducedMotion={reduced}
      />
      <p className="presence-card__count" aria-live="polite">
        {here > 0 ? `${here} here now` : ''}
        {here > 0 && recent > 0 ? ' · ' : ''}
        {recent > 0 ? `${recent} visited recently` : ''}
      </p>
      {names.length ? <p className="sr-only">{`Here now: ${names.join(', ')}`}</p> : null}
      <EmojiPicker
        value={emoji}
        onChange={(id) => {
          setEmoji(id)
          client.setEmoji(id)
        }}
      />
    </section>
  )
}
