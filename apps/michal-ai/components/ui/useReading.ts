'use client'

import { useEffect, useState } from 'react'
import { readingProgress, sectionAt } from './status'
import { countWords, leftLabel, readLine, secondsLeft, type ReadBlock } from './readingTime'

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
  /** "8 min left", "under a minute" or "done"; null when the body has nothing to estimate from. */
  eta: string | null
}

// Leaf text blocks of an article body; a block that contains another one is skipped so words are counted once.
const BLOCKS = 'p, li, h2, h3, h4, h5, h6, pre, figcaption, dt, dd, th, td'

function measureBlocks(body: HTMLElement, base: number): ReadBlock[] {
  const out: ReadBlock[] = []
  body.querySelectorAll<HTMLElement>(`${BLOCKS}, img`).forEach((el) => {
    const r = el.getBoundingClientRect()
    if (el.tagName === 'IMG') {
      if (r.height > 0) out.push({ top: r.top + base, height: r.height, words: 0, images: 1 })
      return
    }
    if (el.querySelector(BLOCKS) || el.closest('pre') !== (el.tagName === 'PRE' ? el : null)) return
    const words = countWords(el.textContent ?? '')
    if (words > 0) out.push({ top: r.top + base, height: r.height, words, images: 0 })
  })
  return out
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
    let blocks: ReadBlock[] = []
    const anchor = Number(article.dataset.readingMinutes) || undefined
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
      blocks = measureBlocks(body, base)
    }
    const compute = () => {
      raf = 0
      const y = window.scrollY
      const progress = readingProgress(y, start, end, window.innerHeight)
      const next: Reading = {
        progress,
        section: sectionAt(tops, y),
        headings: hs.map((h) => ({ id: h.id, text: h.textContent?.replace(/#$/, '').trim() ?? '' })),
        scrolling,
        started: y > start + 40,
        eta: blocks.length ? leftLabel(progress >= 0.995 ? 0 : secondsLeft(blocks, readLine(y, window.innerHeight, progress), { anchorMinutes: anchor })) : null,
      }
      setState((prev) =>
        prev &&
        Math.abs(prev.progress - next.progress) < 0.002 &&
        prev.section === next.section &&
        prev.scrolling === next.scrolling &&
        prev.started === next.started &&
        prev.eta === next.eta &&
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
