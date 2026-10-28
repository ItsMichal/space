'use client'

import { useEffect, useRef } from 'react'

/**
 * The home page's covers as one halftone field behind the index (components/work/Showcase.tsx, `.ix--bg` entries with a
 * `data-cover` image). The entry nearest the middle of the screen (or, with a mouse, the one under the pointer) shows its
 * cover as ink dots beside its text: dot size follows the picture's darkness, and the field dissolves into the page through
 * a noisy round falloff, so there is no box. When the active entry changes, the old cover's dots give way cell by cell to
 * the new one's. One fixed WebGL canvas, drawn only while something moves; no WebGL means plain text. Decorative.
 */

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`

const FRAG = `precision mediump float;
uniform vec2 uRes;        // canvas px
uniform float uCell;      // cell size, canvas px
uniform vec3 uInk;
uniform float uStrength;
uniform float uMix;       // 0: layer A only, 1: layer B only (per-cell dissolve)
uniform float uNarrow;    // 1 on phones: soften toward the text on the left
uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform vec4 uRectA;      // field centre xy, half size zw (canvas px, y down)
uniform vec4 uRectB;
uniform float uOnA;
uniform float uOnB;
uniform float uSeed;

float hash(vec2 v){return fract(sin(dot(v,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 v){vec2 i=floor(v),f=fract(v);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}

// darkness of one layer at a cell centre, times its soft round envelope
float layer(sampler2D t, vec4 r, vec2 c, float on){
  if(on<=0.) return 0.;
  vec2 q=(c-r.xy)/r.zw;                     // -1..1 across the field
  float n=noise(c/(uCell*5.)+uSeed)-.5;
  float e=1.-smoothstep(.35,1.,length(q)+n*.45);
  if(e<=0.) return 0.;
  vec2 uv=q*.5+.5;
  vec3 s=texture2D(t,uv).rgb;
  float d=1.-dot(s,vec3(.299,.587,.114));
  d=smoothstep(.12,.88,d);
  return d*e*on;
}

void main(){
  vec2 px=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);
  vec2 cell=floor(px/uCell);
  vec2 c=(cell+.5)*uCell;
  float h=hash(cell+uSeed);
  float a=layer(uTexA,uRectA,c,uOnA);
  float b=layer(uTexB,uRectB,c,uOnB);
  float d=h<uMix?b:a;
  if(uNarrow>0.) d*=mix(.35,1.,smoothstep(.15,.85,c.x/uRes.x));
  if(d<=.02) discard;
  float rad=uCell*.5*sqrt(d);
  float dist=length(px-c);
  float al=smoothstep(rad+.8,rad-.8,dist)*uStrength;
  gl_FragColor=vec4(uInk*al,al);
}`

type Layer = { el: HTMLElement; tex: WebGLTexture; aspect: number }

const parseHex = (hex: string): [number, number, number] => {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i)
  if (!m) return [0.08, 0.1, 0.08]
  const n = parseInt(m[1], 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export function CoverField() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const entries = Array.from(document.querySelectorAll<HTMLElement>('[data-cover]'))
    if (!entries.length) return
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false })
    if (!gl) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches

    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    const U = (n: string) => gl.getUniformLocation(prog, n)
    const u = {
      res: U('uRes'), cell: U('uCell'), ink: U('uInk'), strength: U('uStrength'), mix: U('uMix'), narrow: U('uNarrow'),
      texA: U('uTexA'), texB: U('uTexB'), rectA: U('uRectA'), rectB: U('uRectB'), onA: U('uOnA'), onB: U('uOnB'), seed: U('uSeed'),
    }
    gl.uniform1i(u.texA, 0)
    gl.uniform1i(u.texB, 1)
    gl.uniform1f(u.seed, Math.random() * 50)
    gl.uniform3fv(u.ink, parseHex(getComputedStyle(document.documentElement).getPropertyValue('--ink')))
    const blank = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, blank)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]))

    // Covers load on demand (small variants), once each.
    const cache = new Map<HTMLElement, Promise<Layer | null>>()
    const load = (el: HTMLElement) => {
      let p = cache.get(el)
      if (!p) {
        p = new Promise<Layer | null>((resolve) => {
          const img = new Image()
          img.decoding = 'async'
          img.onload = () => {
            const tex = gl.createTexture()!
            gl.bindTexture(gl.TEXTURE_2D, tex)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
            resolve({ el, tex, aspect: img.naturalHeight / Math.max(1, img.naturalWidth) })
          }
          img.onerror = () => resolve(null)
          img.src = el.dataset.cover!
        })
        cache.set(el, p)
      }
      return p
    }

    let w = 0, h = 0, dpr = 1
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(u.res, canvas.width, canvas.height)
      gl.uniform1f(u.cell, Math.round((w < 840 ? 6 : 7) * dpr))
      gl.uniform1f(u.narrow, w < 840 ? 1 : 0)
      wake()
    }

    // The field sits beside the entry's text: right of centre on wide screens, under the right half on phones.
    const rectFor = (l: Layer): [number, number, number, number] => {
      const r = l.el.getBoundingClientRect()
      const narrow = w < 840
      const half = narrow ? w * 0.5 : Math.min(320, w * 0.24)
      const aspect = Math.min(1.1, Math.max(0.5, l.aspect))
      const cx = narrow ? w * 0.7 : Math.min(r.right + half * 0.35, w - half * 0.8)
      const cy = r.top + r.height / 2
      return [cx * dpr, cy * dpr, half * dpr, half * aspect * dpr * (narrow ? 0.9 : 1)]
    }

    let a: Layer | null = null // outgoing
    let b: Layer | null = null // current
    let mix = 1 // 0..1 from a to b
    let onB = 0 // current layer's presence (fades the whole field in and out)
    let want: HTMLElement | null = null
    let hover: HTMLElement | null = null
    let raf = 0
    let last = 0

    const pick = (): HTMLElement | null => {
      if (hover) return hover
      // stays out of the hero: nothing until the first section has scrolled into the upper third
      const first = entries[0]?.closest('section')
      if (first && first.getBoundingClientRect().top > h * 0.33) return null
      const mid = h * 0.45
      let best: HTMLElement | null = null
      let bestD = h * 0.42
      for (const el of entries) {
        const r = el.getBoundingClientRect()
        const d = Math.abs(r.top + r.height / 2 - mid)
        if (d < bestD) {
          bestD = d
          best = el
        }
      }
      return best
    }

    const setTarget = (el: HTMLElement | null) => {
      if (el === want) return
      want = el
      if (!el) return wake()
      load(el).then((l) => {
        if (!l || want !== el) return
        if (b?.el === el) return wake()
        a = onB > 0.05 ? b : null
        b = l
        mix = a ? 0 : 1
        if (!a) onB = reduced ? 1 : Math.min(onB, 0.001)
        wake()
      })
    }

    const draw = (now: number) => {
      raf = 0
      const dt = Math.min(64, now - (last || now)) / 1000
      last = now
      let moving = false
      const ease = reduced ? 1 : 1 - Math.exp(-dt * 4)
      if (mix < 1) {
        mix = reduced ? 1 : Math.min(1, mix + dt / 0.7)
        moving = true
        if (mix >= 1) a = null
      }
      const target = want && b && want === b.el ? 1 : 0
      if (Math.abs(onB - target) > 0.002) {
        onB += (target - onB) * ease
        moving = true
      } else onB = target
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      if (b && onB > 0.002) {
        gl.uniform1f(u.strength, w < 840 ? 0.2 : 0.3)
        gl.uniform1f(u.mix, a ? mix : 1)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, a ? a.tex : blank)
        gl.uniform4fv(u.rectA, a ? rectFor(a) : [0, 0, 1, 1])
        gl.uniform1f(u.onA, a ? 1 : 0)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, b.tex)
        gl.uniform4fv(u.rectB, rectFor(b))
        gl.uniform1f(u.onB, onB)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
      if (moving) wake()
      else last = 0
    }
    function wake() {
      if (!raf) raf = requestAnimationFrame(draw)
    }

    const onScroll = () => {
      setTarget(pick())
      wake()
    }
    const enter = (e: Event) => {
      hover = e.currentTarget as HTMLElement
      onScroll()
    }
    const leave = () => {
      hover = null
      onScroll()
    }
    if (finePointer)
      for (const el of entries) {
        el.addEventListener('pointerenter', enter)
        el.addEventListener('pointerleave', leave)
      }
    resize()
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', resize)
      for (const el of entries) {
        el.removeEventListener('pointerenter', enter)
        el.removeEventListener('pointerleave', leave)
      }
      // the context is not lost on purpose: a remount (StrictMode, route revisit) asks the same canvas for it again
      gl.deleteProgram(prog)
    }
  }, [])

  return <canvas ref={ref} className="cover-field" aria-hidden />
}
