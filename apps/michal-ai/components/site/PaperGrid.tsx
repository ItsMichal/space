'use client'

import { usePathname } from 'next/navigation'
import './paper-grid.css'

/**
 * Graph-paper backdrop for the home page (see paper-grid.css). Decorative. It is mounted in the root layout, outside the page
 * transition wrapper: that wrapper carries a transform, which would turn `position: fixed` into "fixed to the wrapper" and
 * make the grid scroll with the page instead of staying put under the glass.
 */
export function PaperGrid() {
  return usePathname() === '/' ? <div className="paper-grid" aria-hidden /> : null
}
