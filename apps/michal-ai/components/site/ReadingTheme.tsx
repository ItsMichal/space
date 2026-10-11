'use client'

import { useLayoutEffect } from 'react'

/**
 * Opts the page into Basalt (dark) when the visitor prefers it. The landing page and index pages never render this
 * and stay Birch (light). The inline script sets the attribute during the first parse, before anything paints;
 * the layout effect keeps it correct across client-side navigations (set on enter, removed on leave).
 */
export function ReadingTheme() {
  useLayoutEffect(() => {
    const el = document.documentElement
    el.setAttribute('data-reading', '')
    return () => el.removeAttribute('data-reading')
  }, [])
  return <script dangerouslySetInnerHTML={{ __html: "document.documentElement.setAttribute('data-reading','')" }} />
}
