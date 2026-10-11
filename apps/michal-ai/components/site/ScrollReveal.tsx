'use client'

import { useEffect } from 'react'

/**
 * Fallback for browsers without CSS scroll-driven animations (`animation-timeline: view()`): fades `.reveal`
 * elements in once, as they enter the viewport. In supporting browsers this does nothing; the CSS owns the motion.
 */
export function ScrollReveal() {
  useEffect(() => {
    if (CSS.supports('animation-timeline: view()')) return
    const root = document.documentElement
    root.classList.add('js-reveal')
    const seen = new WeakSet<Element>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute('data-in', '')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px' }
    )
    const scan = () =>
      document.querySelectorAll('.reveal:not([data-in])').forEach((el) => {
        if (seen.has(el)) return
        seen.add(el)
        io.observe(el)
      })
    scan()
    // Client-side navigations mount new content.
    const mo = new MutationObserver(scan)
    mo.observe(document.body, { childList: true, subtree: true })
    return () => {
      mo.disconnect()
      io.disconnect()
      root.classList.remove('js-reveal')
    }
  }, [])
  return null
}
