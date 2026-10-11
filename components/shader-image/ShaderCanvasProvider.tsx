'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_VARIANT, SHADER_VARIANTS, type ShaderVariant } from './config'
import { ShaderRenderer, type ItemHandle, type ItemOptions } from './renderer'

type Api = {
  register(frame: HTMLElement, opts: ItemOptions): ItemHandle | null
  /** Rolling cost of recent frames in ms (dev readout). */
  frameMs(): number
}

const Ctx = createContext<Api | null>(null)

/** The registry for `<ShaderImage>`; null outside the provider (images then keep the CSS-masked fallback). */
export const useShaderCanvas = () => useContext(Ctx)

/**
 * Mounted once (root layout). Owns the single fixed canvas and the single WebGL2 context. Nothing is created until
 * the first image registers, and nothing at all under prefers-reduced-motion, without WebGL2, or with `?shader=off`
 * (`?shader=stipple|scan|bleed` picks a variant for comparison).
 */
export function ShaderCanvasProvider({ children, defaultVariant = DEFAULT_VARIANT }: { children: ReactNode; defaultVariant?: ShaderVariant }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderer = useRef<ShaderRenderer | null>(null)
  const failed = useRef(false)
  const [api] = useState<Api>(() => ({
    register(frame, opts) {
      if (failed.current || typeof window === 'undefined') return null
      if (!renderer.current) {
        const q = new URLSearchParams(location.search).get('shader')
        if (q === 'off' || q === 'css') return null
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null
        try {
          const r = new ShaderRenderer(canvasRef.current!)
          r.onLost = () => {
            renderer.current = null
            failed.current = true
          }
          r.defaultVariant = q && (SHADER_VARIANTS as string[]).includes(q) ? (q as ShaderVariant) : defaultVariant
          renderer.current = r
        } catch {
          failed.current = true
          return null
        }
      }
      return renderer.current.add(frame, opts)
    },
    frameMs: () => renderer.current?.frameMs ?? 0,
  }))

  useEffect(
    () => () => {
      renderer.current?.dispose()
      renderer.current = null
    },
    []
  )

  return (
    <Ctx.Provider value={api}>
      {children}
      <canvas ref={canvasRef} className="shader-canvas" aria-hidden />
    </Ctx.Provider>
  )
}
