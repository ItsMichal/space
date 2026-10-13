'use client'

import { useEffect, useRef, useState } from 'react'
import { createBackdrop } from './backdrop/engine'
import './paper-grid.css'

/**
 * The page backdrop (see paper-grid.css and docs/backdrop.md): a fixed layer behind every page. A static CSS layer (baked
 * ink-wash image, 24px dots, grain) paints first and is the fallback; one WebGL canvas fades in over it when the shader is
 * running. Decorative. It is mounted in the root layout, outside the page transition wrapper: that wrapper carries a
 * transform, which would turn `position: fixed` into "fixed to the wrapper" and make the layer scroll with the page.
 * `?backdrop=off` shows the CSS layer only, for comparison.
 */
export function PaperGrid() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [fallback, setFallback] = useState(false)

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const q = new URLSearchParams(location.search).get('backdrop')
    if (q === 'off' || matchMedia('(prefers-reduced-transparency: reduce)').matches) {
      setFallback(true)
      return
    }
    return createBackdrop(el, { onFallback: setFallback })
  }, [])

  return (
    <div className="paper-grid" aria-hidden data-fallback={fallback ? '' : undefined}>
      <div className="paper-grid__css" />
      <canvas ref={canvas} className="paper-grid__gl" />
    </div>
  )
}
