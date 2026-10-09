'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { slashController, type SlashState } from '@/lib/editor/slash'
import { uiBus } from '@/lib/editor/ui-bus'

/** Notion-style block picker, driven by the Suggestion plugin in lib/editor/slash.ts. */
export function SlashMenu() {
  const [state, setState] = useState<SlashState | null>(null)
  const [index, setIndex] = useState(0)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const indexRef = useRef(0)
  const stateRef = useRef<SlashState | null>(null)

  useEffect(
    () =>
      uiBus.on('slash', (s) => {
        stateRef.current = s as SlashState | null
        setState(s as SlashState | null)
      }),
    []
  )

  // Reset the highlight when the filtered list changes.
  const key = state?.items.map((i) => i.id).join(',')
  useEffect(() => {
    indexRef.current = 0
    setIndex(0)
  }, [key])

  useLayoutEffect(() => {
    const rect = state?.clientRect?.()
    if (!rect) return setPos(null)
    const height = ref.current?.offsetHeight ?? 320
    const below = rect.bottom + 8
    const top = below + height > window.innerHeight - 12 ? Math.max(12, rect.top - height - 8) : below
    setPos({ left: Math.min(rect.left, window.innerWidth - 300), top })
  }, [state, index])

  useEffect(() => {
    slashController.onKeyDown = (e) => {
      const s = stateRef.current
      if (!s || !s.items.length) return false
      const move = (n: number) => {
        indexRef.current = (indexRef.current + n + s.items.length) % s.items.length
        setIndex(indexRef.current)
        return true
      }
      if (e.key === 'ArrowDown') return move(1)
      if (e.key === 'ArrowUp') return move(-1)
      if (e.key === 'Enter' || e.key === 'Tab') {
        s.command(s.items[indexRef.current])
        return true
      }
      return false
    }
    return () => {
      slashController.onKeyDown = null
    }
  }, [])

  useEffect(() => {
    ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [index, state])

  if (!state) return null
  let lastGroup = ''
  return (
    <div
      ref={ref}
      className="ed-glass ed-slash"
      role="listbox"
      aria-label="Insert block"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {state.items.length === 0 ? <p className="ed-slash__empty">No blocks match</p> : null}
      {state.items.map((item, i) => {
        const header = item.group !== lastGroup ? item.group : null
        lastGroup = item.group
        const Icon = item.icon
        return (
          <div key={item.id}>
            {header ? <p className="ed-slash__group">{header}</p> : null}
            <button
              type="button"
              role="option"
              aria-selected={i === index}
              className="ed-slash__item"
              onMouseEnter={() => {
                indexRef.current = i
                setIndex(i)
              }}
              onClick={() => state.command(item)}
            >
              <span className="ed-slash__icon">
                <Icon size={18} strokeWidth={1.5} aria-hidden />
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
