'use client'

import { useEffect, useState } from 'react'
import { readingProgress, sectionAt } from './status'

export type Reading = {
  /** 0..1 through the article body. */
  progress: number
  /** Index of the heading the reader is under, -1 before the first. */
  section: number
  headings: { id: string; text: string }[]
  /** True while scrolling and for a moment after. */
  scrolling: boolean
  /** Scrolled past the title block, so the progress is meaningful. */
  started: boolean
}

/**
 * Reading progress and the current section for an article (`[data-post]` with a `.prose` body). Passive scroll
 * listener, one rAF per frame at most, never touches scrolling. Returns null on pages that are not articles.
 */
export function useReading(routeKey = '', restMs = 2200): Reading | null {
  const [state, setState] = useState<Reading | null>(null)

  useEffect(() => {
    const article = document.querySelector<HTMLElement>('[data-post]')
    const body = article?.querySelector<HTMLElement>('.prose')
    if (!article || !body) {
      setState(null)
      return
    }
    let tops: number[] = []
    let start = 0
    let end = 0
    let hs: HTMLElement[] = []
    let raf = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let scrolling = false

    const measure = () => {
      const base = window.scrollY
      hs = Array.from(body.querySelectorAll<HTMLElement>('h2'))
      if (!hs.length) hs = Array.from(body.querySelectorAll<HTMLElement>('h3'))
      tops = hs.map((h) => h.getBoundingClientRect().top + base - 140)
      const r = body.getBoundingClientRect()
      start = r.top + base - 220
      end = r.bottom + base
    }
    const compute = () => {
      raf = 0
      const y = window.scrollY
      const next: Reading = {
        progress: readingProgress(y, start, end, window.innerHeight),
        section: sectionAt(tops, y),
        headings: hs.map((h) => ({ id: h.id, text: h.textContent?.replace(/#$/, '').trim() ?? '' })),
        scrolling,
        started: y > start + 40,
      }
      setState((prev) =>
        prev &&
        Math.abs(prev.progress - next.progress) < 0.002 &&
        prev.section === next.section &&
        prev.scrolling === next.scrolling &&
        prev.started === next.started &&
        prev.headings.length === next.headings.length
          ? prev
          : next
      )
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(compute)
    }
    const onScroll = () => {
      scrolling = true
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        scrolling = false
        schedule()
      }, restMs)
      schedule()
    }
    const onResize = () => {
      measure()
      schedule()
    }
    measure()
    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    const ro = new ResizeObserver(onResize)
    ro.observe(body)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      ro.disconnect()
      cancelAnimationFrame(raf)
      if (timer) clearTimeout(timer)
    }
  }, [restMs, routeKey])

  return state
}
