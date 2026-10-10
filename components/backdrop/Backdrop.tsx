'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { createSpring, isSettled } from '@/lib/motion/spring'
import { BACKDROP_FRAG, BACKDROP_VERT } from './shaders'
import { getBackdrop, onBackdropChange } from './store'

/** Placeholder public-domain photographs (docs/shaders/CREDITS.md). Swap for the art-direction set when chosen. */
// crop = [u0, v0, du, dv] window into the photograph; key = how strongly grey/dark background is keyed out.
const LAYERS = [
  { src: '/backdrop/apple-blossom.webp', asp: 931 / 1280, crop: [0, 0, 1, 1], key: 0 },
  { src: '/backdrop/magnolia.webp', asp: (1922 * 0.52) / 1280, crop: [0, 0.48, 1, 0.52], key: 1 },
  { src: '/backdrop/marigold.webp', asp: 1097 / 1280, crop: [0, 0, 1, 1], key: 0.35 },
] as const

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
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const q = new URLSearchParams(location.search).get('backdrop')
    if (q === 'off' || q === 'css') return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' })
    if (!gl) return

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
      return
    }
    gl.useProgram(prog)
    const U = (n: string) => gl.getUniformLocation(prog, n)
    const u = {
      view: U('uView'), res: U('uRes'), time: U('uTime'), scroll: U('uScroll'), par: U('uPar'), set: U('uSet'),
      t: [U('uT0'), U('uT1'), U('uT2')], a: [U('uA0'), U('uA1'), U('uA2')], asp: U('uAsp'), asp2: U('uAsp2'),
      sky: U('uSky'), c: [U('uC0'), U('uC1'), U('uC2')], key: U('uKey'), q: U('uQ[0]'), qn: U('uQN'), debug: U('uDebug'), feather: U('uFeather'),
    }

    // Textures load lazily after first paint; the layer is simply absent until its texture is ready.
    const tex: (WebGLTexture | null)[] = [null, null, null]
    let ready = 0
    let alive = true
    const load = () => {
      LAYERS.forEach((L, i) => {
        const img = new Image()
        img.decoding = 'async'
        img.onload = () => {
          if (!alive) return
          const t = gl.createTexture()!
          gl.bindTexture(gl.TEXTURE_2D, t)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img)
          gl.generateMipmap(gl.TEXTURE_2D)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
          tex[i] = t
          ready++
          if (ready === 1) document.documentElement.setAttribute('data-backdrop-gl', '')
          kick()
        }
        img.src = L.src
      })
    }
    const idle = (window as unknown as { requestIdleCallback?: (f: () => void) => number }).requestIdleCallback
    if (idle) idle(load)
    else setTimeout(load, 300)

    const skyRaw = getComputedStyle(document.documentElement).getPropertyValue('--focus').trim()
    const sky = /^#([0-9a-f]{6})$/i.test(skyRaw) ? skyRaw : '#1d6b74'
    // Pale morning sky derived from the glacier-water token: mostly white, a hint of its hue.
    const sr = parseInt(sky.slice(1, 3), 16) / 255
    const sg = parseInt(sky.slice(3, 5), 16) / 255
    const sb = parseInt(sky.slice(5, 7), 16) / 255
    const skyTint: [number, number, number] = [0.7 + sr * 0.25, 0.86 + sg * 0.12, 0.95 + sb * 0.05]

    // Anchors: [x fraction, viewport y at anchor, anchor scroll]. Recomputed on resize and when the page grows.
    let anchors: [number, number, number, number][] = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
    const layout = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const docH = document.documentElement.scrollHeight
      const small = vw < 700
      const about = document.getElementById('about')
      const writing = document.getElementById('writing')
      const brk = (writing ?? about)?.getBoundingClientRect().top
      const brkDoc = brk != null ? brk + window.scrollY : docH * 0.6
      anchors = [
        // hero, far right edge, at the top of the page
        [vw * (small ? 0.86 : 0.8), vh * (small ? 0.3 : 0.38), 0, small ? vw * 1.5 : Math.min(vw * 0.82, 1000)],
        // a section break, far left
        [vw * (small ? 0.06 : 0.1), vh * 0.5, Math.max(0, brkDoc - vh * 0.5), small ? vw * 1.3 : Math.min(vw * 0.62, 620)],
        // the end of the page, bottom right
        [vw * (small ? 0.8 : 0.82), vh * 0.78, Math.max(0, docH - vh), small ? vw * 1.5 : Math.min(vw * 0.8, 900)],
      ]
    }

    const scrollSpring = createSpring(window.scrollY, { response: reduced ? 0.01 : 0.4, damping: 1 })
    let raf = 0
    let last = 0
    let lastDraw = 0
    let t0 = performance.now()
    let ro: ResizeObserver | null = null
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
      gl.uniform2f(u.asp, LAYERS[0].asp, LAYERS[1].asp)
      gl.uniform1f(u.asp2, LAYERS[2].asp)
      gl.uniform3f(u.sky, skyTint[0], skyTint[1], skyTint[2])
      gl.uniform3f(u.key, LAYERS[0].key, LAYERS[1].key, LAYERS[2].key)
      LAYERS.forEach((L, i) => gl.uniform4f(u.c[i], L.crop[0], L.crop[1], L.crop[2], L.crop[3]))
      gl.uniform1f(u.debug, q === 'raw' ? 2 : S.debugZones ? 1 : 0)
      gl.uniform1f(u.feather, vw < 700 ? 64 : 110)
      gl.uniform1i(u.qn, n)
      gl.uniform4fv(u.q, quiet)
      for (let i = 0; i < 3; i++) {
        const a = anchors[i]
        gl.uniform4f(u.a[i], a[0], a[1], a[2], a[3])
        gl.activeTexture(gl.TEXTURE0 + i)
        // A missing texture draws nothing: bind a 1x1 white fallback by skipping via zero-width layer.
        gl.bindTexture(gl.TEXTURE_2D, tex[i] ?? whiteTex())
        gl.uniform1i(u.t[i], i)
        if (!tex[i]) gl.uniform4f(u.a[i], -9999, -9999, 0, 1)
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      // Ambient sway runs at ~30fps; scroll and settling springs run every frame.
      lastDraw = now
      const moving = !isSettled(st)
      if (moving) request()
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
    ro = new ResizeObserver(onResize)
    ro.observe(document.body)
    kick()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
      off()
      ro?.disconnect()
      document.documentElement.removeAttribute('data-backdrop-gl')
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [active])

  if (!active) return null
  return (
    <>
      {/* CSS fallback: the same composition as blurred, masked photographs. Hidden once the GL layer has a texture. */}
      <div className="backdrop-css" aria-hidden>
        <i style={{ backgroundImage: 'url(/backdrop/apple-blossom.webp)' }} className="backdrop-css__a" />
        <i style={{ backgroundImage: 'url(/backdrop/magnolia.webp)' }} className="backdrop-css__b" />
        <i style={{ backgroundImage: 'url(/backdrop/marigold.webp)' }} className="backdrop-css__c" />
      </div>
      <canvas ref={canvasRef} className="backdrop-canvas" aria-hidden />
    </>
  )
}
