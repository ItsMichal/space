'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { SegmentedControl } from './SegmentedControl'
import { PROJECT_FILTERS } from './segments'
import './segmented.css'
import './filter.css'

type Filter = (typeof PROJECT_FILTERS)[number]['value']

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const SETTLE = 'cubic-bezier(0.22, 1, 0.36, 1)'

/** What an element looks like right now, mid-animation included (computed style reflects running animations). */
function visual(el: HTMLElement) {
  const cs = getComputedStyle(el)
  const t = cs.translate
  const y = !t || t === 'none' ? 0 : parseFloat(t.split(' ')[1] ?? '0') || 0
  return { o: parseFloat(cs.opacity) || 0, y, top: el.getBoundingClientRect().top }
}

/**
 * Wraps the (server-rendered) project list with a filter. Every project stays in the HTML. With JS the segmented control
 * sets `data-filter`, and the list rearranges in two beats: what leaves fades, then what stays glides up into the gap
 * (FLIP, so each row travels from where it was) while newcomers rise in one after another. Interrupting RETARGETS: every
 * animation is replaced by one that starts from the opacity and offset the element has at that instant (a single "from"
 * keyframe, so the end is the element's own resting value), never from the beginning. Without JS the options are plain
 * anchors and `:target` does the filtering.
 */
export function FilteredWork({ options, children }: { options: readonly Filter[]; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState<Filter>('all')
  const run = useRef(0)

  const items = () => Array.from(root.current?.querySelectorAll<HTMLElement>('[data-buckets]') ?? [])
  const shows = (el: HTMLElement, f: string) => f === 'all' || (el.dataset.buckets ?? '').split(' ').includes(f)

  const apply = useCallback(async (next: Filter) => {
    const host = root.current
    if (!host) return
    const id = ++run.current
    const els = items()
    const prev = host.dataset.filter ?? 'all'
    if (reduced()) {
      els.forEach((el) => el.getAnimations().forEach((a) => a.cancel()))
      host.dataset.filter = next
      return
    }
    // Beat 0: read where everything is right now, then replace whatever was running.
    const shown = els.filter((el) => shows(el, prev))
    const v0 = new Map(shown.map((el) => [el, visual(el)]))
    els.forEach((el) => el.getAnimations().forEach((a) => a.cancel()))
    const leaving = shown.filter((el) => !shows(el, next))
    // 1. leavers fade and sink a touch, from however visible they are; survivors settle whatever they were doing
    await Promise.all(
      shown.map((el, i) => {
        const v = v0.get(el)!
        if (leaving.includes(el))
          return el
            .animate([{ opacity: v.o, translate: `0 ${v.y}px` }, { opacity: 0, translate: '0 6px' }], { duration: 120 + 120 * v.o, delay: i * 20, easing: 'cubic-bezier(0.4,0,1,1)', fill: 'forwards' })
            .finished.catch(() => null)
        if (v.o < 0.99 || Math.abs(v.y) > 0.5) el.animate([{ opacity: v.o, translate: `0 ${v.y}px` }], { duration: 700, easing: SETTLE })
        return null
      })
    )
    if (id !== run.current) return
    // Beat 2: read again (survivors may be mid-settle), swap the layout, glide each from where it is now.
    const v1 = new Map(shown.map((el) => [el, visual(el)]))
    els.forEach((el) => el.getAnimations().forEach((a) => a.cancel()))
    host.dataset.filter = next
    let k = 0
    for (const el of els) {
      if (!shows(el, next)) continue
      const top = el.getBoundingClientRect().top
      const from = v1.get(el)
      if (from) {
        const dy = from.top - top
        if (Math.abs(dy) > 1 || from.o < 0.99) el.animate([{ opacity: from.o, translate: `0 ${dy}px` }], { duration: 900, easing: SETTLE })
      } else {
        el.animate([{ opacity: 0, translate: '0 14px' }], { duration: 800, delay: 120 + k++ * 70, easing: SETTLE, fill: 'backwards' })
      }
    }
  }, [])

  const change = (v: string) => {
    setValue(v as Filter)
    void apply(v as Filter)
  }

  // A shared link like /projects#f-web lands filtered.
  useEffect(() => {
    const m = location.hash.match(/^#f-(\w+)/)
    const f = m && options.find((o) => o === m[1])
    if (f && f !== 'all') {
      setValue(f)
      if (root.current) root.current.dataset.filter = f
    }
  }, [options])

  return (
    <div ref={root} className="fw" data-filter="all">
      {options.map((o) => (
        <span key={o} id={`f-${o}`} className="fw-mark" aria-hidden />
      ))}
      <div className="fw-bar surface">
        <SegmentedControl
          label="Filter projects"
          value={value}
          onChange={change}
          options={PROJECT_FILTERS.filter((f) => options.includes(f.value)).map((f) => ({ value: f.value, label: f.label, href: `#f-${f.value}` }))}
        />
      </div>
      {children}
    </div>
  )
}
