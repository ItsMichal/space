// The handwriting player: an inline SVG built only from checked numbers (lib/ink/geometry.ts). Until it plays, and for good
// under prefers-reduced-motion or without JavaScript, it is the finished ink. When it plays, every stroke is revealed along its
// centerline by a mask in recorded order and pace (the outline is built around that same smoothed line and the mask is just
// wider than the outline, so no ink shows ahead of the pen), and comes into focus through its own small filter: a Gaussian blur and an
// RGB split (three channel copies offset sideways, multiplied for dark ink on paper, screened for light ink in dark mode) that
// both converge to zero. One animation frame loop sets attributes on the strokes that are moving; settled strokes drop their
// filter, so a long signature costs a couple of filters at a time. Filter regions are clipped to each stroke's box.
import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { BuiltInk } from '@/lib/ink/geometry'
import { frameAt, schedule, type InkColor, type InkSettings } from '@/lib/ink/timeline'

export type InkPlayerHandle = {
  /** Play from `from` ms (default 0). */
  play(from?: number): void
  pause(): void
  /** Show one moment (pauses). */
  seek(ms: number): void
  /** Length of the animation in ms. */
  total(): number
}

type Props = {
  ink: BuiltInk
  settings: InkSettings
  color?: InkColor
  alt: string
  /** inview: plays once when scrolled into view (the site). manual: the caller drives it (the editor's tuner). */
  mode?: 'inview' | 'manual'
  onTick?(ms: number, total: number, playing: boolean): void
  className?: string
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect
const LIGHT = ['1 0 0 0 0  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0', '0 0 0 0 1  0 1 0 0 0  0 0 0 0 1  0 0 0 1 0', '0 0 0 0 1  0 0 0 0 1  0 0 1 0 0  0 0 0 1 0']
const DARK = ['1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0']

/** Is the resolved ink color light (dark mode)? Then the channel copies add up (screen) instead of multiplying. */
function isBright(el: Element) {
  const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(getComputedStyle(el).color)
  if (!m) return false
  const [r, g, b] = m.slice(1, 4).map((v) => Number(v) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5
}

export const InkPlayer = forwardRef<InkPlayerHandle, Props>(function InkPlayer({ ink, settings, color = 'ink', alt, mode = 'inview', onTick, className }, ref) {
  const uid = `ink${useId().replace(/[^A-Za-z0-9]/g, '')}`
  const svg = useRef<SVGSVGElement>(null)
  const [armed, setArmed] = useState(mode === 'manual')
  const [bright, setBright] = useState(false)
  // viewBox units per screen px: blur and chroma are set in px.
  const [upp, setUpp] = useState(1)
  const plan = useMemo(() => schedule(ink, settings), [ink, settings])
  const els = useRef<{ g: SVGGElement | null; mask: SVGPathElement | null; blur: SVGFEGaussianBlurElement | null; r: SVGFEOffsetElement | null; b: SVGFEOffsetElement | null }[]>([])
  const loop = useRef({ raf: 0, t: 0, playing: false })
  const live = useRef({ plan, settings, upp, onTick })
  live.current = { plan, settings, upp, onTick }

  const measure = useCallback(() => {
    const el = svg.current
    if (!el) return 1
    const w = el.getBoundingClientRect().width
    const next = w > 0 ? ink.width / w : 1
    setUpp(next)
    setBright(isBright(el))
    return next
  }, [ink.width])

  const apply = useCallback(
    (t: number) => {
      const { plan, settings, upp } = live.current
      loop.current.t = t
      ink.strokes.forEach((s, i) => {
        const e = els.current[i]
        if (!e?.g) return
        const f = frameAt(ink, plan, settings, i, t)
        if (!f.visible) {
          e.g.setAttribute('visibility', 'hidden')
          return
        }
        e.g.removeAttribute('visibility')
        e.g.setAttribute('opacity', f.opacity.toFixed(3))
        e.mask?.setAttribute('stroke-dashoffset', ((s.length + 1) * (1 - f.reveal)).toFixed(2))
        if (f.settled || (f.blur < 0.05 && f.chroma < 0.05)) {
          e.g.removeAttribute('filter')
          return
        }
        e.blur?.setAttribute('stdDeviation', (f.blur * upp).toFixed(2))
        const c = f.chroma * upp
        e.r?.setAttribute('dx', (-c).toFixed(2))
        e.r?.setAttribute('dy', (-c * 0.3).toFixed(2))
        e.b?.setAttribute('dx', c.toFixed(2))
        e.b?.setAttribute('dy', (c * 0.3).toFixed(2))
        e.g.setAttribute('filter', `url(#${uid}f${i})`)
      })
    },
    [ink, uid]
  )

  const stop = () => {
    cancelAnimationFrame(loop.current.raf)
    loop.current.playing = false
  }

  const play = useCallback(
    (from = 0) => {
      stop()
      measure()
      loop.current.playing = true
      const t0 = performance.now() - from
      const step = () => {
        const { plan, onTick } = live.current
        const t = Math.min(plan.total, performance.now() - t0)
        apply(t)
        const done = t >= plan.total
        onTick?.(t, plan.total, !done)
        if (!done) loop.current.raf = requestAnimationFrame(step)
        else {
          loop.current.playing = false
          if (mode === 'inview') setArmed(false) // back to the plain finished ink: no masks or filters left in the page
        }
      }
      loop.current.raf = requestAnimationFrame(step)
    },
    [apply, measure, mode]
  )

  useImperativeHandle(
    ref,
    () => ({
      play,
      pause: () => {
        stop()
        live.current.onTick?.(loop.current.t, live.current.plan.total, false)
      },
      seek: (ms: number) => {
        stop()
        apply(Math.max(0, Math.min(live.current.plan.total, ms)))
        live.current.onTick?.(loop.current.t, live.current.plan.total, false)
      },
      total: () => live.current.plan.total,
    }),
    [play, apply]
  )

  // Site: arm (hide the strokes) before the first paint after hydration, then play once when a third of it is in view.
  useIsoLayoutEffect(() => {
    if (mode !== 'inview') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') return
    setArmed(true)
  }, [mode])

  useEffect(() => {
    if (!armed) return
    measure()
    if (mode !== 'inview') return
    const el = svg.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          play(0)
        }
      },
      { threshold: 0.3 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [armed, mode, measure, play])

  // Settings or geometry changed (the tuner): redraw the current moment.
  useEffect(() => {
    if (armed && !loop.current.playing) apply(loop.current.t)
  }, [armed, apply, plan, upp, bright])

  useEffect(() => () => cancelAnimationFrame(loop.current.raf), [])

  const matrices = bright ? DARK : LIGHT
  const blend = bright ? 'screen' : 'multiply'
  const reach = (settings.blur * 3 + settings.chroma * 1.5) * upp + 2

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${ink.width} ${ink.height}`}
      role="img"
      aria-label={alt}
      className={className}
      style={{ color: `var(--${color === 'accent' ? 'accent' : 'ink'})` }}
      fill="currentColor"
      preserveAspectRatio="xMidYMid meet"
    >
      {armed ? (
        <>
          <defs>
            {ink.strokes.map((s, i) => {
              const pad = s.maxWidth + reach
              const box = { x: s.box[0] - pad, y: s.box[1] - pad, width: s.box[2] - s.box[0] + pad * 2, height: s.box[3] - s.box[1] + pad * 2 }
              const set = (k: 'mask' | 'blur' | 'r' | 'b') => (el: SVGElement | null) => {
                const e = (els.current[i] ??= { g: null, mask: null, blur: null, r: null, b: null })
                ;(e as Record<string, unknown>)[k] = el
              }
              return (
                <g key={i}>
                  <mask id={`${uid}m${i}`} maskUnits="userSpaceOnUse" {...box}>
                    <path
                      ref={set('mask')}
                      d={s.center}
                      fill="none"
                      stroke="#fff"
                      strokeWidth={s.maxWidth + 2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={`${(s.length + 1).toFixed(2)} ${(s.length + 2).toFixed(2)}`}
                      strokeDashoffset={(s.length + 1).toFixed(2)}
                    />
                  </mask>
                  <filter id={`${uid}f${i}`} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB" {...box}>
                    <feGaussianBlur ref={set('blur')} in="SourceGraphic" stdDeviation="0" result="b" />
                    <feColorMatrix in="b" type="matrix" values={matrices[0]} result="r0" />
                    <feOffset ref={set('r')} in="r0" result="r" />
                    <feColorMatrix in="b" type="matrix" values={matrices[1]} result="g" />
                    <feColorMatrix in="b" type="matrix" values={matrices[2]} result="b0" />
                    <feOffset ref={set('b')} in="b0" result="bl" />
                    <feBlend in="r" in2="g" mode={blend} result="rg" />
                    <feBlend in="rg" in2="bl" mode={blend} />
                  </filter>
                </g>
              )
            })}
          </defs>
          {ink.strokes.map((s, i) => (
            <g
              key={i}
              ref={(el) => {
                ;(els.current[i] ??= { g: null, mask: null, blur: null, r: null, b: null }).g = el
              }}
              visibility="hidden"
            >
              <path d={s.outline} mask={`url(#${uid}m${i})`} />
            </g>
          ))}
        </>
      ) : (
        ink.strokes.map((s, i) => <path key={i} d={s.outline} />)
      )}
    </svg>
  )
})
