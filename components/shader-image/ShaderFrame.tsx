'use client'

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { ShaderTuning } from './config'
import { maskUrl } from './mask'
import type { ItemHandle } from './renderer'
import { useShaderCanvas } from './ShaderCanvasProvider'

/**
 * Wraps a server-rendered <Picture>. `display: contents`, so it adds no box and cannot shift layout. The real <img>
 * stays in the DOM. Without JS/WebGL it wears the CSS organic mask (globals.css `.shader-frame img`); once the shared
 * canvas has drawn it (`data-gl`), the <img> fades out and the GL frame sits in its exact box.
 */
export function ShaderFrame({ seed, children, variant, intensity, speed, progress }: { seed: number; children: ReactNode } & ShaderTuning) {
  const ref = useRef<HTMLDivElement>(null)
  const canvas = useShaderCanvas()
  const handle = useRef<ItemHandle | null>(null)
  const latest = useRef({ seed, variant, intensity, speed, progress })
  latest.current = { seed, variant, intensity, speed, progress }

  useEffect(() => {
    if (!canvas || !ref.current) return
    handle.current = canvas.register(ref.current, latest.current)
    return () => {
      handle.current?.destroy()
      handle.current = null
    }
  }, [canvas])

  useEffect(() => {
    handle.current?.update({ seed, variant, intensity, speed, progress })
  }, [seed, variant, intensity, speed, progress])

  return (
    <div ref={ref} className="shader-frame" style={{ '--shader-mask': maskUrl(seed) } as CSSProperties}>
      {children}
    </div>
  )
}
