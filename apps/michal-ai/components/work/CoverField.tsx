'use client'

import { useEffect, useRef } from 'react'

/**
 * The home page's covers as text-mode art behind the index (components/work/Showcase.tsx, `.ix--bg` entries with a
 * `data-cover` image). The entry nearest the middle of the screen (or, with a mouse, the one under the pointer) shows its
 * cover beside its text on the hero globe's character grid, the way terminal image viewers draw pictures: each cell is one
 * of the sixteen Unicode quadrant block characters (QUADRANTS, a 2 x 2 grid of "mixels" per character, glyphs from the
 * site's mono font), each mixel set by a 4 x 4 ordered dither of the picture's darkness under it, in one colour per cell
 * (the cover's colour there, pulled toward the page ink). Each cover is auto-levelled so light and dark covers both use the
 * full tonal range. The field dissolves into the page through a ragged round falloff in whole characters, so there is no
 * box; when the active entry changes, the old cover gives way cell by cell to the new one. One fixed WebGL canvas, drawn
 * only while something moves; no WebGL means plain text. Decorative.
 */

// Indexed by mixel bits: top left 1, top right 2, bottom left 4, bottom right 8.
const QUADRANTS = ' \u2598\u259D\u2580\u2596\u258C\u259E\u259B\u2597\u259A\u2590\u259C\u2584\u2599\u259F\u2588'

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`

const FRAG = `precision mediump float;
uniform vec2 uRes;        // canvas px
uniform vec2 uChar;       // character cell, canvas px
uniform vec3 uInk;
uniform float uStrength;
uniform float uMix;       // 0: layer A only, 1: layer B only (per-cell dissolve)
uniform float uNarrow;    // 1 on phones: soften toward the text on the left
uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform sampler2D uGlyph; // the 16 quadrant glyphs in a row, one cell each
uniform vec4 uRectA;      // field centre xy, half size zw (canvas px, y down)
uniform vec4 uRectB;
uniform vec2 uLvA;        // darkness levels (low, high) of each cover, from its histogram
uniform vec2 uLvB;
uniform float uOnA;
uniform float uOnB;
uniform float uSeed;

float hash(vec2 v){return fract(sin(dot(v,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 v){vec2 i=floor(v),f=fract(v);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
// 4 x 4 Bayer threshold in (0, 1) on the mixel grid (the same matrix as the hero's dither())
float b2(vec2 v){return mod(2.*v.x+3.*v.y,4.);}
float bayer(vec2 p){return (4.*b2(mod(p,2.))+b2(mod(floor(p*.5),2.))+.5)/16.;}
// mean colour of a cover over a box (half size h, uv) from four taps
vec3 box(sampler2D t, vec2 uv, vec2 h){
  return (texture2D(t,uv+vec2(-h.x,-h.y)*.5).rgb+texture2D(t,uv+vec2(h.x,-h.y)*.5).rgb
         +texture2D(t,uv+vec2(-h.x,h.y)*.5).rgb+texture2D(t,uv+vec2(h.x,h.y)*.5).rgb)*.25;
}
float level(vec3 s, vec2 lv){return clamp((1.-dot(s,vec3(.299,.587,.114))-lv.x)/max(.05,lv.y-lv.x),0.,1.);}

// one layer for a character cell: the cell's colour (rgb) and its glyph index (a, -1 when outside the field)
vec4 layer(sampler2D t, vec4 r, vec2 lv, vec2 cell, float on){
  if(on<=0.) return vec4(0.,0.,0.,-1.);
  vec2 cc=(cell+.5)*uChar;
  vec2 q=(cc-r.xy)/r.zw;                    // -1..1 across the field
  float n=noise(cc/(uChar.y*4.)+uSeed)-.5;
  float e=(1.-smoothstep(.62,1.,length(q)+n*.2))*on;
  if(e<=0.) return vec4(0.,0.,0.,-1.);
  vec2 uv=q*.5+.5;
  vec2 pc=uChar/(r.zw*2.);                  // one cell in uv
  vec2 m=pc*.25;                            // a mixel centre's offset from the cell centre
  vec2 g=cell*2.;
  float bits=0.;
  // each mixel averages its own quarter of the cell, so type turns to tone, not noise
  if(level(box(t,uv+vec2(-m.x,-m.y),pc*.25),lv)*e>bayer(g)) bits+=1.;
  if(level(box(t,uv+vec2( m.x,-m.y),pc*.25),lv)*e>bayer(g+vec2(1,0))) bits+=2.;
  if(level(box(t,uv+vec2(-m.x, m.y),pc*.25),lv)*e>bayer(g+vec2(0,1))) bits+=4.;
  if(level(box(t,uv+vec2( m.x, m.y),pc*.25),lv)*e>bayer(g+vec2(1,1))) bits+=8.;
  return vec4(box(t,uv,pc*.5),bits);
}

void main(){
  vec2 px=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);
  vec2 cell=floor(px/uChar);
  float h=hash(cell+uSeed);
  vec4 l=h<uMix?layer(uTexB,uRectB,uLvB,cell,uOnB):layer(uTexA,uRectA,uLvA,cell,uOnA);
  if(l.a<=0.) discard;
  if(uNarrow>0.&&hash(cell+uSeed+7.)>mix(.35,1.,smoothstep(.15,.85,(cell.x+.5)*uChar.x/uRes.x))) discard;
  vec2 f=fract(px/uChar);
  float al=texture2D(uGlyph,vec2((l.a+f.x)/16.,f.y)).a*uStrength;
  if(al<=0.) discard;
  vec3 ink=mix(uInk,l.rgb*.62,.75);         // the cover's own colour, pulled toward the page ink
  gl_FragColor=vec4(ink*al,al);
}`

type Layer = { el: HTMLElement; tex: WebGLTexture; aspect: number; lv: [number, number] }

// The 3rd and 97th percentile of a cover's darkness, from a 48 px copy: the range the halftone stretches to full.
const levels = (img: HTMLImageElement): [number, number] => {
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 48
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.drawImage(img, 0, 0, 48, 48)
    const px = g.getImageData(0, 0, 48, 48).data
    const d: number[] = []
    for (let i = 0; i < px.length; i += 4) d.push(1 - (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255)
    d.sort((x, y) => x - y)
    return [d[Math.floor(d.length * 0.03)], d[Math.floor(d.length * 0.97)]]
  } catch {
    return [0.12, 0.88]
  }
}

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
      res: U('uRes'), char: U('uChar'), ink: U('uInk'), strength: U('uStrength'), mix: U('uMix'), narrow: U('uNarrow'),
      texA: U('uTexA'), texB: U('uTexB'), rectA: U('uRectA'), rectB: U('uRectB'), onA: U('uOnA'), onB: U('uOnB'), seed: U('uSeed'),
      lvA: U('uLvA'), lvB: U('uLvB'), glyph: U('uGlyph'),
    }
    gl.uniform1i(u.texA, 0)
    gl.uniform1i(u.texB, 1)
    gl.uniform1i(u.glyph, 2)
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
            resolve({ el, tex, aspect: img.naturalHeight / Math.max(1, img.naturalWidth), lv: levels(img) })
          }
          img.onerror = () => resolve(null)
          img.src = el.dataset.cover!
        })
        cache.set(el, p)
      }
      return p
    }

    // The quadrant glyphs from the mono font, one cell each, scaled so the full block fills the cell as in a terminal.
    const mono = getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() || 'ui-monospace, monospace'
    const glyphs = gl.createTexture()!
    const buildGlyphs = (cw: number, ch: number) => {
      const c = document.createElement('canvas')
      c.width = cw * 16
      c.height = ch
      const g = c.getContext('2d')!
      g.font = `${ch}px ${mono}`
      const m = g.measureText(QUADRANTS[15])
      const gw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight
      const gh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
      g.fillStyle = '#000'
      for (let i = 1; i < 16; i++) {
        g.setTransform(cw / Math.max(1, gw), 0, 0, ch / Math.max(1, gh), i * cw, 0)
        g.fillText(QUADRANTS[i], m.actualBoundingBoxLeft, m.actualBoundingBoxAscent)
      }
      gl.activeTexture(gl.TEXTURE2)
      gl.bindTexture(gl.TEXTURE_2D, glyphs)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c)
      gl.activeTexture(gl.TEXTURE0)
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
      const ch = w < 840 ? 9 : 10 // the hero globe's character size, css px
      const cw = Math.round(ch * 0.62 * dpr)
      const chp = Math.round(ch * dpr)
      gl.uniform2f(u.char, cw, chp)
      buildGlyphs(cw, chp)
      gl.uniform1f(u.narrow, w < 840 ? 1 : 0)
      wake()
    }

    // The field sits beside the entry's text: in the open column to its right on wide screens, under the right half on phones.
    const range = document.createRange()
    const rectFor = (l: Layer): [number, number, number, number] => {
      const r = l.el.getBoundingClientRect()
      const narrow = w < 840
      // The row can span the whole content width, so measure where its text actually ends.
      range.selectNodeContents(l.el)
      const right = Math.min(r.right, range.getBoundingClientRect().right)
      const half = narrow ? w * 0.5 : Math.max(120, Math.min(340, (w - right - 40) / 2))
      const aspect = Math.min(1.1, Math.max(0.56, l.aspect))
      const cx = narrow ? w * 0.7 : right + 16 + half
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
        gl.uniform1f(u.strength, w < 840 ? 0.2 : 0.5)
        gl.uniform1f(u.mix, a ? mix : 1)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, a ? a.tex : blank)
        gl.uniform4fv(u.rectA, a ? rectFor(a) : [0, 0, 1, 1])
        gl.uniform2fv(u.lvA, a ? a.lv : [0, 1])
        gl.uniform2fv(u.lvB, b.lv)
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
