'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createSpring, isSettled } from '@/lib/motion/spring'
import { BACKDROP_FRAG, BACKDROP_VERT } from './shaders'
import { getBackdrop, onBackdropChange } from './store'

/** The owner's own photographs, processed by scripts/botanical-own.mjs (washed, warm, soft alpha). Mirrored cherry blossom
 *  in the top-right corner, hydrangea haze mid-page, a small washed daylily at the page end. asp = h/w. */
const LAYERS = [
  { id: 'cherry-bloom', asp: 1494 / 1400, op: 0.8 },
  { id: 'hydrangea', asp: 1050 / 1400, op: 0.6 },
  { id: 'daylily-wash', asp: 1232 / 1400, op: 0.5 },
] as const
const srcOf = (id: string, small: boolean, ext: 'webp' | 'avif' = 'webp') => `/botanical/own/${id}-${small ? 700 : 1400}.${ext}`

const PAR = 0.82
const SCALE = 0.55 // render resolution in canvas px per CSS px (content is soft; the page grain stays crisp)
// Tight text blocks (measured with Range, so a full-width <p> only claims the width of its actual lines).
const QUIET_SELECTOR = 'main :is(h1,h2,h3,p,li,.work-feat__cta), footer :is(p,a)'

type Props = { paths?: string[] }

/**
 * A fixed, full-viewport WebGL2 layer behind the page: out-of-focus real flower photographs with slow wind sway,
 * a faint sky and sun wash, all multiplied into the paper. Text blocks are measured every frame and carve calm
 * "quiet zones". Without WebGL (or before it is ready) a CSS fallback shows the same composition as blurred, masked
 * images. Under prefers-reduced-motion it is a still frame (no sway, no drift lag).
 */
export function Backdrop({ paths = ['/'] }: Props) {
  const pathname = usePathname()
  const active = paths.includes(pathname)
  const [fallback, setFallback] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const q = new URLSearchParams(location.search).get('backdrop')
    if (q === 'off') return
    if (q === 'css') {
      setFallback(true)
      return
    }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' })
    if (!gl) {
      setFallback(true)
      return
    }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    let prog: WebGLProgram
    try {
      prog = gl.createProgram()!
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, BACKDROP_VERT))
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, BACKDROP_FRAG))
      gl.linkProgram(prog)
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link')
    } catch (e) {
      console.warn('[backdrop] disabled:', e)
      setFallback(true)
      return
    }
    gl.useProgram(prog)
    const U = (n: string) => gl.getUniformLocation(prog, n)
    const u = {
      view: U('uView'), res: U('uRes'), time: U('uTime'), scroll: U('uScroll'), par: U('uPar'), set: U('uSet'),
      t: [U('uT0'), U('uT1'), U('uT2')], a: [U('uA0'), U('uA1'), U('uA2')], asp: U('uAsp'), op: U('uOp'), fade: U('uFade'),
      q: U('uQ[0]'), qn: U('uQN'), debug: U('uDebug'), feather: U('uFeather'), quiet: U('uQuiet'),
    }

    // Textures load after first paint and decode off the main thread (createImageBitmap); each layer fades in only once
    // it is on the GPU, so until then (and with JS disabled) the page is plain warm paper.
    const tex: (WebGLTexture | null)[] = [null, null, null]
    const readyAt: number[] = [0, 0, 0]
    let ready = 0
    let alive = true
    const small = window.innerWidth < 700
    const load = () => {
      LAYERS.forEach((L, i) => {
        fetch(srcOf(L.id, small))
          .then((r) => r.blob())
          .then((blob) => createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }))
          .then((bmp) => {
            if (!alive) return bmp.close()
            const t = gl.createTexture()!
            gl.bindTexture(gl.TEXTURE_2D, t)
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp)
            bmp.close()
            gl.generateMipmap(gl.TEXTURE_2D)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            tex[i] = t
            readyAt[i] = performance.now()
            ready++
            if (ready === 1) document.documentElement.setAttribute('data-backdrop-gl', '')
            kick()
          })
          .catch(() => {})
      })
    }
    const idle = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    if (idle) idle(load, { timeout: 1500 })
    else setTimeout(load, 300)

    // Anchors: [x fraction, viewport y at anchor, anchor scroll]. Recomputed on resize and when the page grows.
    let anchors: [number, number, number, number][] = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
    const layout = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const docH = document.documentElement.scrollHeight
      const small = vw < 700
      const about = document.getElementById('about')
      const brk = about?.getBoundingClientRect().top
      const brkDoc = brk != null ? brk + window.scrollY : docH * 0.6
      anchors = [
        // hero: cherry blossom enters from the top-right corner, bleeding off both edges
        small ? [vw * 0.97, vh * 0.1, 0, vw * 0.8] : [vw * 0.8, vh * 0.34, 0, Math.min(vw * 0.56, 820)],
        // mid page: hydrangea haze at the far right, level with the about section
        small
          ? [vw * 0.96, vh * 0.4, Math.max(0, brkDoc - vh * 0.4), vw * 1.25]
          : [vw * 0.9, vh * 0.52, Math.max(0, brkDoc - vh * 0.5), Math.min(vw * 0.5, 720)],
        // page end: a small, washed daylily as the only warm accent
        small ? [vw * 0.9, vh * 0.8, Math.max(0, docH - vh), vw * 0.9] : [vw * 0.86, vh * 0.78, Math.max(0, docH - vh), Math.min(vw * 0.34, 480)],
      ]
    }

    const scrollSpring = createSpring(window.scrollY, { response: reduced ? 0.01 : 0.4, damping: 1 })
    let raf = 0
    let last = 0
    let lastDraw = 0
    const t0 = performance.now()
    const quiet = new Float32Array(32 * 4)
    const range = document.createRange()

    const draw = (now: number) => {
      raf = 0
      const dt = Math.min((now - last) / 1000, 1 / 15)
      last = now
      const S = getBackdrop()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const bw = Math.max(2, Math.round(vw * SCALE * Math.min(dpr, 1.5)))
      const bh = Math.max(2, Math.round(vh * SCALE * Math.min(dpr, 1.5)))
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw
        canvas.height = bh
      }
      canvas.style.opacity = S.enabled ? '1' : '0'
      scrollSpring.to(window.scrollY)
      const st = scrollSpring.step(dt)

      // quiet zones from live text rects, only those near the viewport
      let n = 0
      const els = document.querySelectorAll(QUIET_SELECTOR)
      for (let i = 0; i < els.length && n < 32; i++) {
        const box = els[i].getBoundingClientRect()
        if (box.bottom < -80 || box.top > vh + 80 || box.width < 4) continue
        // Union of the element's actual text line boxes: tight even when the element itself is full width.
        let x0 = Infinity
        let y0 = Infinity
        let x1 = -Infinity
        let y1 = -Infinity
        const walker = document.createTreeWalker(els[i], NodeFilter.SHOW_TEXT)
        for (let tn = walker.nextNode(); tn; tn = walker.nextNode()) {
          if (!tn.textContent?.trim()) continue
          range.selectNodeContents(tn)
          const rs = range.getClientRects()
          for (let k = 0; k < rs.length; k++) {
            x0 = Math.min(x0, rs[k].left)
            y0 = Math.min(y0, rs[k].top)
            x1 = Math.max(x1, rs[k].right)
            y1 = Math.max(y1, rs[k].bottom)
          }
        }
        if (x1 <= x0) continue
        quiet[n * 4] = x0 - 8
        quiet[n * 4 + 1] = y0 - 6
        quiet[n * 4 + 2] = x1 + 8
        quiet[n * 4 + 3] = y1 + 6
        n++
      }

      gl.viewport(0, 0, bw, bh)
      gl.uniform2f(u.view, vw, vh)
      gl.uniform2f(u.res, bw, bh)
      gl.uniform1f(u.time, reduced ? 3 : (now - t0) / 1000)
      gl.uniform1f(u.scroll, st.value)
      gl.uniform1f(u.par, reduced ? 1 : PAR)
      gl.uniform4f(u.set, S.intensity * (vw < 700 ? 1.35 : 1), S.blur, S.coverage, reduced ? 0 : S.sway)
      gl.uniform3f(u.asp, LAYERS[0].asp, LAYERS[1].asp, LAYERS[2].asp)
      gl.uniform3f(u.op, LAYERS[0].op, LAYERS[1].op, LAYERS[2].op)
      let fading = false
      const fade = LAYERS.map((_, i) => {
        if (!tex[i]) return 0
        const f = reduced ? 1 : Math.min(1, (now - readyAt[i]) / 1600)
        if (f < 1) fading = true
        return f * f * (3 - 2 * f)
      })
      gl.uniform3f(u.fade, fade[0], fade[1], fade[2])
      gl.uniform1f(u.quiet, vw < 700 ? 0.985 : 0.9)
      gl.uniform1f(u.debug, q === 'raw' ? 2 : S.debugZones ? 1 : 0)
      gl.uniform1f(u.feather, vw < 700 ? 84 : 200)
      gl.uniform1i(u.qn, n)
      gl.uniform4fv(u.q, quiet)
      for (let i = 0; i < 3; i++) {
        const a = anchors[i]
        gl.uniform4f(u.a[i], a[0], a[1], a[2], a[3])
        gl.activeTexture(gl.TEXTURE0 + i)
        // A missing texture draws nothing: bind a 1x1 white fallback by skipping via zero-width layer.
        gl.bindTexture(gl.TEXTURE_2D, tex[i] ?? whiteTex())
        gl.uniform1i(u.t[i], i)
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      // Ambient sway runs at ~30fps; scroll and settling springs run every frame.
      lastDraw = now
      const moving = !isSettled(st)
      if (moving || fading) request()
      else if (!reduced && S.enabled && S.sway > 0 && ready > 0) requestSlow()
    }

    let white: WebGLTexture | null = null
    const whiteTex = () => {
      if (!white) {
        white = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, white)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]))
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      }
      return white
    }
    const request = () => {
      if (!raf && !document.hidden) {
        last = last || performance.now()
        raf = requestAnimationFrame(draw)
      }
    }
    const requestSlow = () => {
      if (raf || document.hidden) return
      raf = requestAnimationFrame((now) => {
        raf = 0
        if (now - lastDraw < 33) requestSlow()
        else draw(now)
      })
    }
    const kick = () => {
      last = performance.now()
      request()
    }
    const onScroll = () => kick()
    const onResize = () => {
      layout()
      kick()
    }
    const onVis = () => {
      if (!document.hidden) kick()
    }
    layout()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    document.addEventListener('visibilitychange', onVis)
    const off = onBackdropChange(kick)
    const ro = new ResizeObserver(onResize)
    ro.observe(document.body)
    kick()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
      off()
      ro.disconnect()
      document.documentElement.removeAttribute('data-backdrop-gl')
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [active])

  if (!active) return null
  return (
    <>
      {/* No-WebGL fallback: the same composition as three static, already-soft plates. Rendered only after detection fails. */}
      {fallback ? (
        <div className="backdrop-css" aria-hidden>
          {LAYERS.map((L, i) => (
            <i key={L.id} className={`backdrop-css__${'abc'[i]}`} style={{ backgroundImage: `image-set(url(${srcOf(L.id, false, 'avif')}) type('image/avif'), url(${srcOf(L.id, false)}) type('image/webp'))` }} />
          ))}
        </div>
      ) : null}
      <canvas ref={canvasRef} className="backdrop-canvas" aria-hidden />
    </>
  )
}
