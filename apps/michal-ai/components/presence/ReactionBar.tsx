'use client'

import { useEffect, useRef, useState } from 'react'
import { stepSpring } from '@space/motion/spring'
import { REACTIONS } from '@/lib/presence/constants'
import { scheduleView } from '@/lib/presence/views'
import { toggle, useReactions } from './useReactions'
import './presence.css'

/** Interruptible pop: a spring on a CSS variable. A new press cancels and restarts from the current value. */
function pop(el: HTMLElement | null) {
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return
  const prev = (el as HTMLElement & { _raf?: number })._raf
  if (prev) cancelAnimationFrame(prev)
  const from = Number(el.style.getPropertyValue('--pop')) || 1
  let st = { value: Math.min(from, 0.9), velocity: 0, target: 1 }
  let last = performance.now()
  const cfg = { response: 0.22, damping: 1 }
  const tick = (now: number) => {
    st = stepSpring(st, cfg, Math.min(0.032, (now - last) / 1000))
    last = now
    el.style.setProperty('--pop', st.value.toFixed(3))
    if (Math.abs(st.value - 1) < 0.002 && Math.abs(st.velocity) < 0.02) {
      el.style.removeProperty('--pop')
      ;(el as HTMLElement & { _raf?: number })._raf = 0
    } else
      (el as HTMLElement & { _raf?: number })._raf = requestAnimationFrame(tick)
  }
  ;(el as HTMLElement & { _raf?: number })._raf = requestAnimationFrame(tick)
}

/** The five preset reactions at the end of an article. Hydrates when scrolled near; absent without JS. */
export function ReactionBar({ postId }: { postId: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setNear(true),
      { rootMargin: '400px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  // Count this visit after the page has been visible for a few seconds (not on prefetch, not for automation).
  useEffect(() => scheduleView(postId), [postId])
  const r = useReactions(postId, near)
  if (r.status === 'off') return null
  const ready = r.status === 'ready'
  const mine = r.mine.post ?? []
  return (
    <div
      ref={ref}
      className="reactionbar"
      style={{ opacity: ready ? 1 : 0, transition: 'opacity 300ms ease' }}
    >
      <div className="reactionbar__group" role="group" aria-label="Reactions">
        {ready
          ? REACTIONS.map((e) => {
              const n = r.post[e.id] ?? 0
              const on = mine.includes(e.id)
              return (
                <button
                  key={e.id}
                  type="button"
                  className="reactionbar__btn"
                  aria-pressed={on}
                  aria-label={`${e.label}, ${n}`}
                  onClick={(ev) => {
                    pop(
                      ev.currentTarget.querySelector<HTMLElement>(
                        '.reactionbar__glyph'
                      )
                    )
                    void toggle(postId, 'post', e.id)
                  }}
                >
                  <span className="reactionbar__glyph" aria-hidden>
                    {e.glyph}
                  </span>
                  <span className="reactionbar__n">{n > 0 ? n : ''}</span>
                </button>
              )
            })
          : null}
      </div>
      {ready && r.views !== null ? (
        <p className="reactionbar__views">
          {r.views.toLocaleString('en-US')} {r.views === 1 ? 'view' : 'views'}
        </p>
      ) : null}
    </div>
  )
}
