'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { SegmentedControl } from './SegmentedControl'
import { PROJECT_FILTERS } from './segments'
import './segmented.css'
import './filter.css'

type Filter = (typeof PROJECT_FILTERS)[number]['value']

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const SETTLE = 'cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * Wraps the (server-rendered) project list with a filter. Every project stays in the HTML. With JS the segmented control
 * sets `data-filter`, and the list rearranges in two beats: what leaves fades, then what stays glides up into the gap
 * (FLIP, so each row travels from where it was) while newcomers rise in one after another. Interrupting restarts from
 * the current state. Without JS the options are plain anchors and `:target` does the filtering.
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
    els.forEach((el) => el.getAnimations().forEach((a) => a.cancel()))
    const prev = host.dataset.filter ?? 'all'
    if (reduced()) {
      host.dataset.filter = next
      return
    }
    const was = new Map(els.filter((el) => shows(el, prev)).map((el) => [el, el.getBoundingClientRect().top]))
    const leaving = els.filter((el) => was.has(el) && !shows(el, next))
    // 1. leavers fade and sink a touch
    await Promise.all(
      leaving.map(
        (el, i) =>
          el.animate([{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 6px' }], { duration: 240, delay: i * 25, easing: 'cubic-bezier(0.4,0,1,1)', fill: 'forwards' }).finished.catch(() => null)
      )
    )
    if (id !== run.current) return
    leaving.forEach((el) => el.getAnimations().forEach((a) => a.cancel()))
    host.dataset.filter = next
    // 2. survivors glide from their old place; newcomers rise in with a stagger
    let k = 0
    for (const el of items()) {
      if (!shows(el, next)) continue
      const top = el.getBoundingClientRect().top
      const from = was.get(el)
      if (from !== undefined) {
        const dy = from - top
        if (Math.abs(dy) > 1) el.animate([{ translate: `0 ${dy}px` }, { translate: '0 0' }], { duration: 900, easing: SETTLE })
      } else {
        el.animate([{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }], { duration: 800, delay: 120 + k++ * 70, easing: SETTLE, fill: 'backwards' })
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
      <div className="fw-bar">
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
