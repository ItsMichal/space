'use client'

import { useEffect } from 'react'

/*
 * Entrance effects, each a port of a named piece of internet craft rather than a stock fade:
 *
 * - [data-scramble] headings decode once as they enter: Justin Windle's (soulwire) "Text Scramble Effect"
 *   (codepen.io/soulwire/pen/mEMPrK). Same queue: every character gets a random start and end frame, flickers through
 *   random glyphs between them (28% chance to change each frame) and lands on its own letter. The glyph set is braille,
 *   the globe's own alphabet, instead of the original's punctuation.
 * - .ix__thumb pictures resolve through an ordered (Bayer 4x4) dither: the threshold dissolve from Surma's "Ditherpunk"
 *   (surma.dev/things/ditherpunk) and Lucas Pope's Return of the Obra Dinn devlog. A paper-coloured canvas of 4px cells
 *   covers the picture; the threshold sweeps 0 to 1 and each cell clears when its matrix value falls under it.
 *
 * Once per element, on first view. No hover or click behaviour. Reduced motion, or no IntersectionObserver: nothing runs
 * and everything is simply there (the server HTML is the finished state; nothing starts hidden).
 */

const GLYPHS = '⠁⠂⠄⠆⠇⠋⠍⠏⠗⠛⠟⠯⠷⠿⡇⡏⡟⡿⣇⣏⣟⣧⣷⣿'
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
const CELL = 4
const DITHER_MS = 640

function scramble(el: HTMLElement) {
  const text = el.textContent ?? ''
  if (!text.trim()) return
  el.setAttribute('aria-label', text)
  const queue = [...text].map((to) => {
    const start = Math.floor(Math.random() * 24)
    return { to, start, end: start + Math.floor(Math.random() * 24), ch: '' }
  })
  let frame = 0
  const tick = () => {
    let done = 0
    let html = ''
    for (const q of queue) {
      if (frame >= q.end || q.to === ' ') {
        done++
        html += escape(q.to)
      } else if (frame >= q.start) {
        if (!q.ch || Math.random() < 0.28) q.ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        html += `<span class="fx-dud" aria-hidden="true">${q.ch}</span>`
      } else html += escape(q.to)
    }
    el.innerHTML = html
    if (done === queue.length) {
      el.textContent = text
      el.removeAttribute('aria-label')
      return
    }
    frame++
    requestAnimationFrame(tick)
  }
  tick()
}

const escape = (c: string) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c)

/** Covers the picture with paper-coloured cells now; the returned function dissolves them. */
function ditherCover(box: HTMLElement, paper: string): (() => void) | null {
  const r = box.getBoundingClientRect()
  const w = Math.ceil(r.width / CELL)
  const h = Math.ceil(r.height / CELL)
  if (!w || !h) return null
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  cv.className = 'fx-dither'
  cv.setAttribute('aria-hidden', 'true')
  const ctx = cv.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, w, h)
  box.appendChild(cv)
  return () => {
    const t0 = performance.now()
    const draw = (now: number) => {
      const t = Math.min(1, (now - t0) / DITHER_MS)
      ctx.clearRect(0, 0, w, h)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (BAYER[(y & 3) * 4 + (x & 3)] >= t) ctx.fillRect(x, y, 1, 1)
        }
      }
      if (t < 1) requestAnimationFrame(draw)
      else cv.remove()
    }
    requestAnimationFrame(draw)
  }
}

export function ArtisanFx() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim() || '#f6f3eb'
    const play = new Map<Element, () => void>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          io.unobserve(e.target)
          play.get(e.target)?.()
          play.delete(e.target)
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    )
    // only what is still below the fold: anything already on screen at load is left alone
    const below = (el: Element) => el.getBoundingClientRect().top > innerHeight
    document.querySelectorAll<HTMLElement>('[data-scramble], .ix__thumb').forEach((el) => {
      if (!below(el)) return
      const go = el.hasAttribute('data-scramble') ? () => scramble(el) : ditherCover(el, paper)
      if (!go) return
      play.set(el, go)
      io.observe(el)
    })
    return () => {
      io.disconnect()
      document.querySelectorAll('.fx-dither').forEach((n) => n.remove())
    }
  }, [])
  return null
}
