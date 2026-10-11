'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Fragment, useEffect, useReducer, useRef, useState } from 'react'
import { clickTarget, initialRotation, INTERVAL, ROLL_MS, rotationReducer, slotOf } from '@space/motion/rotation'

export type HookItem = { text: string; href: string }

type Props = { stem: string; items: HookItem[]; label?: string }

/**
 * "I've built <phrase>": a fixed stem and a slowly rolling phrase, where each phrase is a link to its project or post.
 *
 * Accessibility: the roller is a real list of links (`ul` in `role="group"`), all of them in the accessibility tree and
 * in the static HTML, with no live region. Only the phrase on screen is a tab stop and can be clicked (the others are
 * `tabindex=-1` and `pointer-events: none`), so keyboard users meet one link, screen-reader users can browse all of them,
 * and a click can never land on a phrase that is leaving. Chosen over a single link whose name changes because that
 * would hide six links from search and assistive tech, and would make the accessible name change under the user.
 *
 * Without JS the first phrase is simply a link. All timing/step logic lives in @space/motion/rotation.ts (unit tested).
 */
export function HeroHook({ stem, items, label = 'Recent work' }: Props) {
  const [s, dispatch] = useReducer(rotationReducer, items.length, (n) => initialRotation(n))
  const rootRef = useRef<HTMLDivElement>(null)
  const rollRef = useRef<HTMLDivElement>(null)
  const lastChange = useRef(0)
  const drag = useRef<{ x: number; y: number; id: number; moved: boolean; touch: boolean } | null>(null)
  const [dragPx, setDragPx] = useState<number | null>(null)

  // reduced motion, tab visibility, on-screen
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const onMq = () => dispatch({ type: 'reduced', value: mq.matches })
    onMq()
    mq.addEventListener('change', onMq)
    const onVis = () => dispatch(document.hidden ? { type: 'pause', reason: 'hidden' } : { type: 'resume', reason: 'hidden', now: performance.now() })
    document.addEventListener('visibilitychange', onVis)
    const io = new IntersectionObserver(([e]) => {
      dispatch(e.isIntersecting ? { type: 'resume', reason: 'offscreen', now: performance.now() } : { type: 'pause', reason: 'offscreen' })
    })
    if (rootRef.current) io.observe(rootRef.current)
    return () => {
      mq.removeEventListener('change', onMq)
      document.removeEventListener('visibilitychange', onVis)
      io.disconnect()
    }
  }, [])

  // automatic rotation
  useEffect(() => {
    const t = setInterval(() => {
      const now = performance.now()
      if (now - lastChange.current >= INTERVAL) dispatch({ type: 'tick', now })
    }, 400)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    lastChange.current = performance.now()
  }, [s.index])

  // end of a roll
  useEffect(() => {
    if (s.phase !== 'rolling') return
    const t = setTimeout(() => dispatch({ type: 'settled' }), ROLL_MS)
    return () => clearTimeout(t)
  }, [s.phase, s.index])

  const step = (dir: 1 | -1) => dispatch({ type: 'step', dir, now: performance.now() })

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      step(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      step(-1)
    }
  }

  // 1:1 drag along the roll axis (vertical drag for a pointer, horizontal swipe for touch), then a spring-like settle via CSS.
  const onPointerDown = (e: React.PointerEvent) => {
    if (items.length < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, touch: e.pointerType !== 'mouse' }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.id) return
    const delta = d.touch ? d.x - e.clientX : d.y - e.clientY
    if (!d.moved && Math.abs(delta) < 6) return
    if (!d.moved) {
      d.moved = true
      dispatch({ type: 'pause', reason: 'drag' })
      rollRef.current?.setPointerCapture?.(e.pointerId)
    }
    setDragPx(Math.max(-14, Math.min(14, -delta * 0.5)))
  }
  const endDrag = (e: React.PointerEvent, cancelled = false) => {
    const d = drag.current
    if (!d || e.pointerId !== d.id) return
    drag.current = null
    if (!d.moved) return
    const delta = d.touch ? d.x - e.clientX : d.y - e.clientY
    setDragPx(null)
    dispatch({ type: 'resume', reason: 'drag', now: performance.now() })
    if (!cancelled && Math.abs(delta) > 36) step(delta > 0 ? 1 : -1)
    // swallow the click that follows a drag
    const swallow = (ev: Event) => ev.preventDefault()
    window.addEventListener('click', swallow, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 60)
  }

  const current = clickTarget(s)

  // Keyboard stepping moves the focus ring with the phrase: only the phrase on screen is ever focused.
  useEffect(() => {
    const roll = rollRef.current
    if (!roll || !roll.contains(document.activeElement)) return
    roll.querySelector<HTMLAnchorElement>('a[tabindex="0"]')?.focus({ preventScroll: true })
  }, [current])

  return (
    <div ref={rootRef} className="hook" data-hook data-reduced={s.reduced ? '' : undefined}>
      <span className="hook__stem">{stem}</span>
      <div
        className="hook__roll"
        role="group"
        aria-label={label}
        ref={rollRef}
        data-dragging={dragPx !== null ? '' : undefined}
        style={dragPx !== null ? ({ ['--drag' as string]: `${dragPx}px` } as React.CSSProperties) : undefined}
        onMouseEnter={() => dispatch({ type: 'pause', reason: 'hover' })}
        onMouseLeave={() => dispatch({ type: 'resume', reason: 'hover', now: performance.now() })}
        onFocus={() => dispatch({ type: 'pause', reason: 'focus' })}
        onBlur={() => dispatch({ type: 'resume', reason: 'focus', now: performance.now() })}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={(e) => endDrag(e, true)}
      >
        <ul className="hook__list">
          {items.map((it, i) => (
            <li key={it.href} className="hook__item" data-slot={slotOf(s, i)} data-current={i === current ? '' : undefined}>
              <Link href={it.href} className="hook__link" tabIndex={i === current ? 0 : -1} data-hook-link>
                {it.text.split(' ').map((w, k) => (
                  <Fragment key={k}>
                    {k ? ' ' : null}
                    <span className="hook__w" style={{ ['--w' as string]: k } as React.CSSProperties}>
                      {w}
                    </span>
                  </Fragment>
                ))}
                <ArrowUpRight aria-hidden className="hook__arrow" size={'0.62em'} strokeWidth={1.4} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {s.reduced && items.length > 1 ? (
        <button type="button" className="hook__next" onClick={() => step(1)} aria-label="Show another project">
          Another
        </button>
      ) : null}
    </div>
  )
}
