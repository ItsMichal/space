'use client'

import { useEffect, useRef } from 'react'
import { positionEcef } from '@/lib/starlink/orbit.mjs'
import { loadLand, type Ring } from './globe/data'
import { loadStarlinkWithIds, type Identities, type Packed } from './globe/starlink'
import { balloon, BRAILLE_BIT, calloutLines, dither, GLYPHS, landDot, SAT, SAT_FRONT, SAT_LINKED, SAT_MARKED, satFacts, seaDot, strokeGlyph, TERMINAL, greeting, WAVE_SITE_LL, waveFade, wavePose } from './ascii/field'
import { drawHeroMarks } from './heroMarks'
import { siteConfig } from '@/site.config'
import './presence.css'
import './ascii/ascii.css'

/*
 * Character-cell hero: the Earth and the Starlink constellation drawn as glyphs on one 2D canvas, one rAF loop.
 *
 * - Earth: a fixed screen grid of monospace cells over an orthographic sphere. Each cell knows its surface normal (so its
 *   lambert term, which picks the glyph from LAND_RAMP) and the latitude and base longitude under it; per frame only the spin
 *   is added and the land mask (Natural Earth, the globe's own land.bin) is looked up. The Earth is drawn into an offscreen
 *   layer and only redrawn when the spin crosses a mask column or the text clearing changes; frames blit it.
 * - Satellites: the real constellation (globe/starlink.ts, the same elements and propagation as the WebGL globe), every n-th
 *   satellite as a glyph, at an exaggerated shell height. Positions are refreshed round-robin, a slice per frame.
 * - A ground terminal links to the nearest satellites overhead with glyph strands (Verlet, pinned at both ends) that swing
 *   when the terminal moves or the pointer sweeps through them, then settle straight. It follows a hovering mouse or pen, and
 *   moves where a finger taps the globe; a counter shows how many satellites are above 25 degrees of elevation there.
 * - Every 6 to 10 s one visible satellite gets a callout (name, NORAD number, launch, height, speed, inclination). A tap or click
 *   near a satellite pins its callout.
 * - A small figure stands on Los Angeles and waves while it is on the visible face, in finer type than the globe and in front of
 *   it. He keeps to the globe's land: he moves with each step its land is redrawn at, his feet on its braille dot grid, and his
 *   arm swings on the same beat. He leans out with the globe's curve, his shadow stays on the ground while he shifts against the
 *   pointer, and hovered (or tapped) he says hello in turn in English, Polish and Japanese, in a cowsay balloon with X and LinkedIn under it to tap
 *   (opened from the window's pointer handler, since the hero text lies over this layer). He steps aside (fades) when the
 *   terminal, its counter or a callout comes over him, and callouts are placed off him.
 * Decorative: aria-hidden, the canvas takes no pointer events (window listeners, passive, never preventDefault), and cells behind
 * the hero text are thinned so the text keeps its contrast. Paused offscreen and in hidden tabs; one static frame under reduced
 * motion.
 */

const SCALE = 1.3 // canvas edge / globe box edge
const SPHERE = 0.9 // globe radius / half the box
const TILT = (18 * Math.PI) / 180
const START_LON = -100
const SPIN_DEG_S = 1.2
const MASK_W = 720
const MASK_H = 360
const SHELL: [number, number] = [1.16, 1.3] // drawn orbit radius (globe radii) for true radius 1.045 to 1.095
const LIGHT = (() => {
  const v = [-0.55, 0.6, 0.58]
  const n = Math.hypot(v[0], v[1], v[2])
  return v.map((x) => x / n)
})()
const MIN_ELEV = Math.sin((25 * Math.PI) / 180)
const STRAND_POINTS = 14
const STRAND_ITER = 3
const FRAME_MS = 1000 / 32
const CALLOUT_MS = 5200
/** CSS px at the top of the viewport kept clear for the fixed nav bar. */
const NAV_CLEAR = 72
const POS_SLICE = 1600 // satellites re-propagated per frame
const REST = { u: 0.12, v: -0.34 }
/** Under the figure's greeting, where to find him. */
const CONTACT = [
  { label: 'X', href: siteConfig.x },
  { label: 'LinkedIn', href: siteConfig.linkedin },
]
const WAVE_SITE = (() => {
  const la = (WAVE_SITE_LL.lat * Math.PI) / 180
  const lo = (WAVE_SITE_LL.lon * Math.PI) / 180
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
})()

interface Box {
  on: boolean
  l: number
  t: number
  r: number
  b: number
}
const overlaps = (a: Box, b: Box) => a.on && b.on && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b

interface Strand {
  sat: number
  px: Float32Array
  py: Float32Array
  ox: Float32Array
  oy: Float32Array
  born: number
  alpha: number
  dying: boolean
}

/** `a` moved a fraction `t` towards `b`, as an rgb() string; any CSS colour the canvas understands. */
function mix(a: string, b: string, t: number): string {
  const rgb = (c: string) => {
    const g = document.createElement('canvas').getContext('2d')!
    g.fillStyle = c
    const v = String(g.fillStyle)
    if (v.startsWith('#')) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16))
    return (v.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']).slice(0, 3).map(Number)
  }
  const x = rgb(a)
  const y = rgb(b)
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`
}

export function HeroAscii({ className = '' }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = wrap.current
    const cv = canvas.current
    const ctx = cv?.getContext('2d')
    if (!el || !cv || !ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const slot = el.closest('[data-hero-slot]') as HTMLElement | null

    // ---- layout ----
    let box = 0
    let W = 0
    let dpr = 1
    let cw = 8
    let ch = 13
    let cols = 0
    let rows = 0
    let R = 0
    let A = 0.34
    let font = ''
    // Earth cells (indices into the canvas grid) and what is fixed about each of their eight braille sub-dots: lambert term,
    // latitude row (-1 off the disc) and base longitude. Cell shade is the mean of its sub-dots on the disc.
    let eIdx = new Int32Array(0)
    let eShade = new Float32Array(0)
    let eLimb = new Uint8Array(0)
    let sShade = new Float32Array(0)
    let sLat = new Int32Array(0)
    let sLon = new Float32Array(0)
    let dimT = new Float32Array(0)
    let dimC = new Float32Array(0)
    let dimSettled = true

    // ---- colours and glyph atlases ----
    let ink = '#18211b'
    let accent = '#3d6a35'
    let halo = '#f4f1e8'
    let haloAlpha = 0.85
    const atlas = { ink: null as HTMLCanvasElement | null, accent: null as HTMLCanvasElement | null, land: null as HTMLCanvasElement | null, sea: null as HTMLCanvasElement | null }
    const slotOf = new Map<string, number>(GLYPHS.map((g, i) => [g, i]))
    const earth = document.createElement('canvas')
    const ectx = earth.getContext('2d')!

    // ---- data ----
    let mask: Uint8Array | null = null
    let sat: Packed | null = null
    let ids: Identities | null = null
    let ecef = new Float32Array(0)
    let posCursor = 0
    let stride = 8
    let overhead = 0

    // ---- motion state ----
    let lonC = START_LON
    let lastLonCol = NaN
    // the spin the Earth layer was last drawn at, which the figure stands on
    let earthLon = START_LON
    let raf = 0
    let last = 0
    let lastDraw = 0
    let active = false
    const term = { u: REST.u, v: REST.v, tu: REST.u, tv: REST.v, lastSet: -1e9, userSet: false }
    const ptr = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: 0, inside: false, hover: false, down: null as null | { x: number; y: number; t: number; id: number } }
    const strands: Strand[] = []
    let candidates: number[] = []
    let candStamp = 0
    const callout = { sat: -1, t0: 0, pinned: false, next: 0, lines: [] as string[], dir: 1, up: true }
    let pinFirst = false
    // the waving figure's cells, the counter's and the callout label's last boxes (canvas px), to keep them apart
    const fig: Box = { on: false, l: 0, t: 0, r: 0, b: 0 }
    const termBox: Box = { on: false, l: 0, t: 0, r: 0, b: 0 }
    const labelBox: Box = { on: false, l: 0, t: 0, r: 0, b: 0 }
    let figA = 1
    // the figure's greeting: shown while hovered or for a while after a tap, a new one each time
    const hi = { on: false, until: 0, turn: Math.floor(Math.random() * 3), text: '', a: 0, spot: null as [number, number, number] | null }
    // the bubble's last box and its links' (canvas px), for hovering and tapping them
    const hiBox: Box = { on: false, l: 0, t: 0, r: 0, b: 0 }
    const hiLinks = CONTACT.map((c) => ({ ...c, l: 0, t: 0, r: 0, b: 0 }))
    let hiHover = -1
    // the pointer's parallax on the figure, eased, px
    const par = { x: 0, y: 0 }
    // per-frame projection of the drawn satellites (screen x, y, visible flag), reused by hit tests and the callout picker
    let sx = new Float32Array(0)
    let sy = new Float32Array(0)
    let sv = new Uint8Array(0)
    const stats = { frames: 0, totalMs: 0, maxMs: 0, earthDraws: 0, sats: 0, cells: 0, strands: 0 }

    // The halo behind callout text: the paper, stronger under dark ink than under light ink (dark theme).
    const pickHalo = (cs: CSSStyleDeclaration) => {
      const paper = cs.getPropertyValue('--paper').trim()
      const rgb = (ink.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number)
      const lightInk = rgb.length === 3 && rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 128
      haloAlpha = lightInk ? 0.45 : 0.85
      return paper || halo
    }
    const readColours = () => {
      const cs = getComputedStyle(el)
      ink = cs.color || ink
      accent = cs.getPropertyValue('--accent').trim() || accent
      halo = pickHalo(cs)
      const a = parseFloat(cs.getPropertyValue('--hero-globe-opacity'))
      if (Number.isFinite(a)) A = a
      const mono = getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() || 'ui-monospace, monospace'
      font = mono
    }

    const buildAtlas = (colour: string) => {
      const c = document.createElement('canvas')
      const gw = Math.ceil(cw * dpr)
      const gh = Math.ceil(ch * dpr)
      c.width = gw * GLYPHS.length
      c.height = gh
      const g = c.getContext('2d')!
      g.fillStyle = colour
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.font = `${ch * 0.86 * dpr}px ${font}`
      GLYPHS.forEach((ch_, i) => g.fillText(ch_, i * gw + gw / 2, gh / 2 + dpr * 0.5))
      return c
    }
    // all 256 braille patterns, drawn as dots on the cell's 2 x 4 sub-grid (not from a font, so they line up on every platform)
    const buildBraille = (colour: string) => {
      const c = document.createElement('canvas')
      const gw = Math.ceil(cw * dpr)
      const gh = Math.ceil(ch * dpr)
      c.width = gw * 256
      c.height = gh
      const g = c.getContext('2d')!
      g.fillStyle = colour
      const rad = Math.min(cw / 2, ch / 4) * 0.4 * dpr
      for (let bits = 1; bits < 256; bits++) {
        g.beginPath()
        for (let k = 0; k < 8; k++) {
          if (!(bits & BRAILLE_BIT[k])) continue
          const x = bits * gw + (((k & 1) + 0.5) * cw * dpr) / 2
          const y = (((k >> 1) + 0.5) * ch * dpr) / 4
          g.moveTo(x + rad, y)
          g.arc(x, y, rad, 0, Math.PI * 2)
        }
        g.fill()
      }
      return c
    }
    const buildAtlases = () => {
      atlas.ink = buildAtlas(ink)
      atlas.accent = buildAtlas(accent)
      // a slight colouring: land in the accent green, the sea in ink leaning a little blue
      atlas.land = buildBraille(accent)
      atlas.sea = buildBraille(mix(ink, '#2f6aa0', 0.35))
    }
    const braille = (c: CanvasRenderingContext2D, a: HTMLCanvasElement, bits: number, x: number, y: number) => {
      const gw = Math.ceil(cw * dpr)
      const gh = Math.ceil(ch * dpr)
      c.drawImage(a, bits * gw, 0, gw, gh, Math.round((x - cw / 2) * dpr), Math.round((y - ch / 2) * dpr), gw, gh)
    }
    const glyph = (c: CanvasRenderingContext2D, a: HTMLCanvasElement, g: string, x: number, y: number) => {
      const i = slotOf.get(g) ?? 0
      const gw = Math.ceil(cw * dpr)
      const gh = Math.ceil(ch * dpr)
      c.drawImage(a, i * gw, 0, gw, gh, Math.round((x - cw / 2) * dpr), Math.round((y - ch / 2) * dpr), gw, gh)
    }

    const layout = () => {
      box = el.clientWidth
      if (!box) return false
      W = box * SCALE
      dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3, 2000 / W))
      ch = Math.max(9, Math.min(13, Math.round(box / 64)))
      cw = ch * 0.62
      cols = Math.ceil(W / cw)
      rows = Math.ceil(W / ch)
      R = (box / 2) * SPHERE
      cv.width = earth.width = Math.round(W * dpr)
      cv.height = earth.height = Math.round(W * dpr)
      stride = box < 520 ? 12 : 7
      readColours()
      buildAtlases()
      // earth cells, sampled at their eight sub-dots
      const idx: number[] = []
      const shade: number[] = []
      const limb: number[] = []
      const subShade: number[] = []
      const subLat: number[] = []
      const subLon: number[] = []
      const ct = Math.cos(TILT)
      const st = Math.sin(TILT)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cu = ((c + 0.5) * cw - W / 2) / R
          const cv_ = -(((r + 0.5) * ch - W / 2) / R)
          if (cu * cu + cv_ * cv_ >= 1.06) continue
          let on = 0
          let sum = 0
          const base = subLat.length
          for (let k = 0; k < 8; k++) {
            const u = ((c + ((k & 1) + 0.5) / 2) * cw - W / 2) / R
            const v = -(((r + ((k >> 1) + 0.5) / 4) * ch - W / 2) / R)
            const q = u * u + v * v
            if (q >= 1) {
              subShade.push(0)
              subLat.push(-1)
              subLon.push(0)
              continue
            }
            const z = Math.sqrt(1 - q)
            const d = Math.max(0, u * LIGHT[0] + v * LIGHT[1] + z * LIGHT[2])
            const Y = v * ct + z * st
            const Z = -v * st + z * ct
            subShade.push(d)
            subLat.push(Math.min(MASK_H - 1, Math.max(0, Math.floor((90 - (Math.asin(Y) * 180) / Math.PI) * (MASK_H / 180)))))
            subLon.push((Math.atan2(u, Z) * 180) / Math.PI)
            on++
            sum += d
          }
          if (!on) {
            subShade.length = subLat.length = subLon.length = base
            continue
          }
          idx.push(r * cols + c)
          shade.push(sum / on)
          limb.push(cu * cu + cv_ * cv_ > 0.93 ? 1 : 0)
        }
      }
      eIdx = Int32Array.from(idx)
      eShade = Float32Array.from(shade)
      eLimb = Uint8Array.from(limb)
      sShade = Float32Array.from(subShade)
      sLat = Int32Array.from(subLat)
      sLon = Float32Array.from(subLon)
      dimT = new Float32Array(cols * rows).fill(1)
      dimC = new Float32Array(cols * rows).fill(1)
      stats.cells = eIdx.length
      measureText(true)
      lastLonCol = NaN
      return true
    }

    // ---- text clearing: cells near the hero's glyphs fade, so the text stays readable over the field ----
    // Every glyph is drawn at its real position into a small offscreen canvas (S px per cell) with a blurred halo, and each
    // cell fades by the coverage there, so the clearing follows the letter shapes. Line boxes would clear whole rectangles.
    const measureText = (instant = false) => {
      if (!cols) return
      const cr = cv.getBoundingClientRect()
      const k = W / (cr.width || 1) // CSS px -> canvas units
      const S = 3
      const mc = document.createElement('canvas')
      mc.width = cols * S
      mc.height = rows * S
      const g = mc.getContext('2d', { willReadFrequently: true })
      if (!g) return
      g.setTransform(S / cw, 0, 0, S / ch, 0, 0) // draw in canvas units
      g.fillStyle = '#fff'
      g.shadowColor = '#fff'
      g.shadowBlur = ((14 * k) / cw) * S // halo of about 14 CSS px, in mask px (shadows ignore the transform)
      g.textBaseline = 'alphabetic'
      const range = document.createRange()
      const add = (root: Element | null) => {
        if (!root) return
        const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        for (let t = walk.nextNode(); t; t = walk.nextNode()) {
          const text = t.textContent
          const parent = t.parentElement
          if (!text?.trim() || !parent) continue
          const cs = getComputedStyle(parent)
          const fs = parseFloat(cs.fontSize) * k
          g.font = `${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`
          const fm = g.measureText('M')
          const asc = fm.fontBoundingBoxAscent ?? fs * 0.8
          const desc = fm.fontBoundingBoxDescent ?? fs * 0.2
          for (let i = 0; i < text.length; i++) {
            if (!text[i].trim()) continue
            range.setStart(t, i)
            range.setEnd(t, i + 1)
            const r = range.getBoundingClientRect()
            if (r.width < 1 || r.height < 1) continue
            // the glyph's baseline: the content box is centred in the line box
            const top = (r.top - cr.top) * k + ((r.bottom - r.top) * k - asc - desc) / 2
            const x = (r.left - cr.left) * k
            g.fillText(text[i], x, top + asc)
            g.fillText(text[i], x, top + asc) // twice: a denser, rounder halo
          }
        }
      }
      document.querySelectorAll<HTMLElement>('[data-hero-text]').forEach((t) => {
        const live = t.querySelector<HTMLElement>('[data-hook]')
        if (live) {
          add(live.querySelector('.hook__stem'))
          add(live.querySelector('.hook__item[data-current] .hook__link'))
        } else add(t)
      })
      add(document.getElementById('work-h'))
      drawHeroMarks(g, cr.left, cr.top, k, () => measureText())
      const px = g.getImageData(0, 0, mc.width, mc.height).data
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let sum = 0
          for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) sum += px[((r * S + y) * mc.width + c * S + x) * 4 + 3]
          const cov = Math.min(1, (sum / (S * S * 255)) * 2)
          dimT[r * cols + c] = 1 - 0.9 * cov * cov * (3 - 2 * cov)
        }
      }
      if (instant) dimC.set(dimT)
      dimSettled = false
    }
    // satellites sit on the character grid, like the Earth's cells
    const snapX = (x: number) => (Math.floor(x / cw) + 0.5) * cw
    const snapY = (y: number) => (Math.floor(y / ch) + 0.5) * ch
    const dimAt = (x: number, y: number) => {
      const c = Math.floor(x / cw)
      const r = Math.floor(y / ch)
      return c < 0 || r < 0 || c >= cols || r >= rows ? 1 : dimC[r * cols + c]
    }
    // the settled map, for placing callouts where the text will be rather than where it is fading from
    const dimTargetAt = (x: number, y: number) => {
      const c = Math.floor(x / cw)
      const r = Math.floor(y / ch)
      return c < 0 || r < 0 || c >= cols || r >= rows ? 1 : dimT[r * cols + c]
    }

    // ---- Earth layer ----
    const drawEarth = () => {
      stats.earthDraws++
      earthLon = lonC
      ectx.setTransform(1, 0, 0, 1, 0, 0)
      ectx.clearRect(0, 0, earth.width, earth.height)
      const la = atlas.land
      const sa = atlas.sea
      if (!la || !sa) return
      const n = eIdx.length
      for (let i = 0; i < n; i++) {
        const gi = eIdx[i]
        const c = gi % cols
        const r = (gi / cols) | 0
        const dim = dimC[gi]
        if (dim < 0.05) continue
        let land = 0
        let sea = 0
        for (let k = 0; k < 8; k++) {
          const j = i * 8 + k
          const lat = sLat[j]
          if (lat < 0) continue
          let lon = sLon[j] + lonC + 180
          lon = ((lon % 360) + 360) % 360
          const d = sShade[j]
          const t = dither(c * 2 + (k & 1), r * 4 + (k >> 1))
          if (mask && mask[lat * MASK_W + ((lon * 2) | 0)]) {
            if (landDot(d, t)) land |= BRAILLE_BIT[k]
          } else if (seaDot(d, t, !!eLimb[i])) sea |= BRAILLE_BIT[k]
        }
        const x = (c + 0.5) * cw
        const y = (r + 0.5) * ch
        const d = eShade[i]
        if (land) {
          ectx.globalAlpha = Math.min(1, A * (1.2 + 0.8 * d) * dim)
          braille(ectx, la, land, x, y)
        }
        if (sea) {
          ectx.globalAlpha = Math.min(1, A * (eLimb[i] ? 0.8 : 0.5 + 0.4 * d) * dim)
          braille(ectx, sa, sea, x, y)
        }
      }
      ectx.globalAlpha = 1
    }

    // ---- projection: earth-fixed unit vector -> view (u right, v up, z towards the viewer) ----
    const toView = (x: number, y: number, z: number, out: Float32Array | number[], lon = lonC) => {
      const lam = (lon * Math.PI) / 180
      const cl = Math.cos(lam)
      const sl = Math.sin(lam)
      // rotate about the pole so lonC faces the viewer: X east, Z towards the viewer, Y north
      const X = -x * sl + y * cl
      const Z = x * cl + y * sl
      const Y = z
      const ct = Math.cos(TILT)
      const st = Math.sin(TILT)
      out[0] = X
      out[1] = Y * ct - Z * st
      out[2] = Y * st + Z * ct
    }
    // view (u, v) on the sphere -> earth-fixed unit vector
    const fromView = (u: number, v: number) => {
      const z = Math.sqrt(Math.max(0, 1 - u * u - v * v))
      const ct = Math.cos(TILT)
      const st = Math.sin(TILT)
      const Y = v * ct + z * st
      const Z = -v * st + z * ct
      const X = u
      const lam = (lonC * Math.PI) / 180
      const cl = Math.cos(lam)
      const sl = Math.sin(lam)
      return [Z * cl - X * sl, Z * sl + X * cl, Y]
    }
    const shellR = (r: number) => SHELL[0] + (SHELL[1] - SHELL[0]) * Math.max(0, Math.min(1, (r - 1.045) / 0.05))

    const refreshPositions = (all: boolean) => {
      if (!sat) return
      const n = sat.count
      const tSec = Date.now() / 1000
      const m = all ? n : Math.min(n, POS_SLICE)
      for (let k = 0; k < m; k++) {
        const i = posCursor
        const p = positionEcef(sat.data, i, sat.refEpoch, tSec)
        ecef[i * 3] = p[0]
        ecef[i * 3 + 1] = p[1]
        ecef[i * 3 + 2] = p[2]
        posCursor = (posCursor + 1) % n
      }
    }

    const countOverhead = (g: number[]) => {
      if (!sat) return 0
      let n = 0
      for (let i = 0; i < sat.count; i++) {
        const dx = ecef[i * 3] - g[0]
        const dy = ecef[i * 3 + 1] - g[1]
        const dz = ecef[i * 3 + 2] - g[2]
        const e = (dx * g[0] + dy * g[1] + dz * g[2]) / Math.hypot(dx, dy, dz)
        if (e > MIN_ELEV) n++
      }
      return n
    }

    const pickCandidates = (g: number[]) => {
      if (!sat) return []
      const best: [number, number][] = []
      for (let i = 0; i < sat.count; i += stride) {
        const dx = ecef[i * 3] - g[0]
        const dy = ecef[i * 3 + 1] - g[1]
        const dz = ecef[i * 3 + 2] - g[2]
        const e = (dx * g[0] + dy * g[1] + dz * g[2]) / Math.hypot(dx, dy, dz)
        if (e > MIN_ELEV) best.push([e, i])
      }
      best.sort((a, b) => b[0] - a[0])
      return best.slice(0, box < 520 ? 2 : 3).map((b) => b[1])
    }

    const newStrand = (s: number, x0: number, y0: number, x1: number, y1: number, now: number): Strand => {
      const px = new Float32Array(STRAND_POINTS)
      const py = new Float32Array(STRAND_POINTS)
      for (let k = 0; k < STRAND_POINTS; k++) {
        const t = k / (STRAND_POINTS - 1)
        px[k] = x0 + (x1 - x0) * t
        py[k] = y0 + (y1 - y0) * t
      }
      return { sat: s, px, py, ox: px.slice(), oy: py.slice(), born: now, alpha: 0, dying: false }
    }

    const stepStrand = (s: Strand, x0: number, y0: number, x1: number, y1: number, dt: number) => {
      const n = STRAND_POINTS
      const { px, py, ox, oy } = s
      const pr = 90
      const sweep = performance.now() - ptr.t < 120
      for (let k = 1; k < n - 1; k++) {
        const vx = (px[k] - ox[k]) * 0.9
        const vy = (py[k] - oy[k]) * 0.9
        ox[k] = px[k]
        oy[k] = py[k]
        px[k] += vx
        py[k] += vy
        // the pointer drags the strand along as it sweeps through
        if (sweep) {
          const dx = px[k] - ptr.x
          const dy = py[k] - ptr.y
          const f = Math.exp(-(dx * dx + dy * dy) / (pr * pr))
          if (f > 0.01) {
            px[k] += ptr.vx * dt * 0.5 * f
            py[k] += ptr.vy * dt * 0.5 * f
          }
        }
        // a gentle pull back to the straight line
        const t = k / (n - 1)
        px[k] += (x0 + (x1 - x0) * t - px[k]) * 0.035
        py[k] += (y0 + (y1 - y0) * t - py[k]) * 0.035
      }
      px[0] = x0
      py[0] = y0
      px[n - 1] = x1
      py[n - 1] = y1
      const rest = Math.hypot(x1 - x0, y1 - y0) / (n - 1)
      for (let it = 0; it < STRAND_ITER; it++) {
        for (let k = 0; k < n - 1; k++) {
          const dx = px[k + 1] - px[k]
          const dy = py[k + 1] - py[k]
          const d = Math.hypot(dx, dy) || 1e-6
          const f = (d - rest) / d / 2
          const a0 = k === 0 ? 0 : 1
          const a1 = k + 1 === n - 1 ? 0 : 1
          const w = a0 + a1 || 1
          px[k] += (dx * f * 2 * a0) / w
          py[k] += (dy * f * 2 * a0) / w
          px[k + 1] -= (dx * f * 2 * a1) / w
          py[k + 1] -= (dy * f * 2 * a1) / w
        }
      }
    }

    const drawStrand = (s: Strand, grow: number) => {
      const a = atlas.accent
      if (!a) return
      const n = STRAND_POINTS
      let total = 0
      for (let k = 0; k < n - 1; k++) total += Math.hypot(s.px[k + 1] - s.px[k], s.py[k + 1] - s.py[k])
      const step = cw * 1.25
      const limit = total * grow
      let acc = step * 0.9
      let walked = 0
      for (let k = 0; k < n - 1 && walked < limit; k++) {
        const dx = s.px[k + 1] - s.px[k]
        const dy = s.py[k + 1] - s.py[k]
        const L = Math.hypot(dx, dy)
        const g = strokeGlyph(dx, dy)
        while (acc <= L && walked + acc < limit) {
          const x = s.px[k] + (dx * acc) / L
          const y = s.py[k] + (dy * acc) / L
          const end = Math.min(1, (total - walked - acc) / (step * 1.2))
          ctx.globalAlpha = Math.min(1, A * 2.1 * s.alpha * dimAt(x, y) * Math.max(0, end))
          glyph(ctx, a, g, x, y)
          acc += step
        }
        acc -= L
        walked += L
      }
    }

    // ---- what part of the canvas is on screen (in canvas px), for placing callouts ----
    const visibleRect = () => {
      const cr = cv.getBoundingClientRect()
      const k = W / (cr.width || 1)
      const sr = slot?.getBoundingClientRect()
      const L = Math.max(cr.left, sr?.left ?? 0, 0)
      // keep clear of the fixed nav bar at the top of the viewport
      const T = Math.max(cr.top, sr?.top ?? -1e9, NAV_CLEAR)
      const Rr = Math.min(cr.right, sr?.right ?? 1e9, window.innerWidth)
      const work = document.getElementById('work-h')?.getBoundingClientRect()
      const B = Math.min(cr.bottom, sr?.bottom ?? 1e9, window.innerHeight, work ? work.bottom + 8 : 1e9)
      return { l: (L - cr.left) * k, t: (T - cr.top) * k, r: (Rr - cr.left) * k, b: (B - cr.top) * k }
    }

    // Label geometry for a satellite at (x, y): which way the leader goes, where the text sits, and how much of it would cover
    // the hero text or leave the visible part of the hero (lower is better).
    const labelSize = (lines: string[]) => {
      const fs = Math.max(11, Math.min(12.5, ch))
      ctx.font = `${fs * dpr}px ${font}`
      let tw = 0
      for (const l of lines) tw = Math.max(tw, ctx.measureText(l).width / dpr)
      return { fs, lh: fs * 1.35, tw }
    }
    const place = (x: number, y: number, dir: number, up: boolean, tw: number, th: number, lh: number, vr: ReturnType<typeof visibleRect>) => {
      const ey = y + (up ? -26 : 26)
      const hx = x + dir * 44
      let lx = dir > 0 ? hx + 6 : hx - 6 - tw
      lx = Math.max(vr.l + 10, Math.min(vr.r - 10 - tw, lx))
      let ly = up ? ey - th + lh * 0.5 : ey - lh * 0.5
      ly = Math.max(vr.t + lh, Math.min(vr.b - th, ly))
      // the leader ends level with the nearest line of the label, at its edge
      const ey2 = up ? ly + th - lh : ly
      // after clamping the label may sit on the other side of the satellite: the leader goes to whichever edge faces it
      let side = lx + tw / 2 < x ? -1 : 1
      let hx2 = side > 0 ? lx - 6 : lx + tw + 6
      let ex2 = x + side * Math.min(Math.abs(ey2 - y), 40)
      let ey3 = ey2
      if ((side > 0 && ex2 > hx2) || (side < 0 && ex2 < hx2)) ex2 = hx2
      const top = ly - lh / 2
      const bottom = ly + th - lh / 2
      const over = x > lx - 10 && x < lx + tw + 10
      if (over) {
        // straight above or below the label: a short vertical hairline to its nearest edge
        side = 0
        ey3 = y < top ? top - 3 : bottom + 3
        ex2 = x
        hx2 = x
      }
      let cover = 0
      let samples = 0
      // keep off the ground terminal and its counter too
      const tx = W / 2 + term.u * R
      const ty = W / 2 - term.v * R
      for (let yy = ly - lh / 2; yy <= ly + th; yy += ch) {
        for (let xx = lx; xx <= lx + tw; xx += cw) {
          const onFig = fig.on && xx > fig.l - cw && xx < fig.r + cw && yy > fig.t - ch && yy < fig.b + ch
          cover += onFig || (Math.abs(xx - tx) < 120 && yy > ty - 2 * ch && yy < ty + 3 * ch) ? 1 : 1 - dimTargetAt(xx, yy)
          samples++
        }
      }
      // a label over its own satellite is no use
      // ... and one hugging it leaves no room for a leader
      const hidesSat = over ? (y > top - 8 && y < bottom + 8 ? 1 : y > top - 18 && y < bottom + 18 ? 0.05 : 0) : 0
      return { side, ex: ex2, ey: ey3, hx: hx2, lx, ly, score: (samples ? cover / samples : 1) + hidesSat }
    }
    const bestPlace = (x: number, y: number, tw: number, th: number, lh: number) => {
      const vr = visibleRect()
      let best: { dir: number; up: boolean; score: number } = { dir: 1, up: true, score: 9 }
      for (const dir of [1, -1]) {
        for (const up of [true, false]) {
          const p = place(x, y, dir, up, tw, th, lh, vr)
          if (p.score < best.score - 1e-3) best = { dir, up, score: p.score }
        }
      }
      return best
    }

    const compact = () => window.innerWidth < 480
    const pickCallout = (now: number) => {
      if (!sat) return
      measureText() // late web fonts or a new phrase may have moved the text
      const vr = visibleRect()
      const m = compact() ? 28 : 48
      const pool: number[] = []
      for (let j = 0; j < sv.length; j++) {
        if (sv[j] !== 2) continue
        const x = sx[j]
        const y = sy[j]
        if (x < vr.l + m || x > vr.r - m || y < vr.t + m || y > vr.b - m) continue
        if (dimTargetAt(x, y) < 0.95) continue
        pool.push(j)
      }
      // a satellite whose label fits in open space, tried in random order (in pool order under reduced motion)
      for (let k = 0; k < Math.min(32, pool.length); k++) {
        const pi = reduced ? k : k + ((Math.random() * (pool.length - k)) | 0)
        const j = pool[pi]
        pool[pi] = pool[k]
        pool[k] = j
        const lines = calloutLines(satFacts(sat.data, ids, j * stride), compact())
        const { lh, tw } = labelSize(lines)
        const b = bestPlace(sx[j], sy[j], tw, lh * lines.length, lh)
        if (b.score < 0.04) {
          setCallout(j * stride, now, pinFirst)
          pinFirst = false
          return
        }
      }
      callout.next = now + 1500
    }
    const setCallout = (i: number, now: number, pinned: boolean) => {
      if (!sat) return
      callout.sat = i
      callout.t0 = now
      callout.pinned = pinned
      callout.lines = calloutLines(satFacts(sat.data, ids, i), compact())
      callout.next = now + 6000 + Math.random() * 4000
      const j = i / stride
      const { lh, tw } = labelSize(callout.lines)
      const b = bestPlace(sx[j], sy[j], tw, lh * callout.lines.length, lh)
      callout.dir = b.dir
      callout.up = b.up
    }

    const drawCallout = (now: number) => {
      labelBox.on = false
      if (callout.sat < 0 || !sat) return
      const j = callout.sat / stride
      if (sv[j] === 0) {
        if (!callout.pinned) callout.sat = -1
        return
      }
      const age = now - callout.t0
      let a = 1
      if (!callout.pinned && !reduced) {
        a = Math.min(1, age / 350) * Math.min(1, Math.max(0, (CALLOUT_MS - age) / 700))
        if (age > CALLOUT_MS) {
          callout.sat = -1
          return
        }
      }
      const x = sx[j]
      const y = sy[j]
      const vr = visibleRect()
      const { fs, lh, tw } = labelSize(callout.lines)
      const th = lh * callout.lines.length
      const { dir, up } = callout
      const { side, ex, ey, hx, lx, ly } = place(x, y, dir, up, tw, th, lh, vr)
      Object.assign(labelBox, { on: true, l: Math.min(lx, x) - 4, t: Math.min(ly - lh / 2, y) - 4, r: Math.max(lx + tw, x) + 4, b: Math.max(ly + th - lh / 2, y) + 4 })
      // highlighted satellite
      ctx.globalAlpha = a
      glyph(ctx, atlas.ink!, SAT_MARKED, snapX(x), snapY(y))
      // leader: a hairline out to the label
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.strokeStyle = ink
      ctx.lineWidth = 1
      ctx.globalAlpha = a * 0.7
      ctx.beginPath()
      ctx.moveTo(x + side * 5, y + (ey < y ? -6 : 6))
      ctx.lineTo(ex, ey)
      ctx.lineTo(hx, ey)
      ctx.stroke()
      ctx.font = `${fs}px ${font}`
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      callout.lines.forEach((l, i) => {
        const yy = ly + i * lh
        ctx.globalAlpha = a * haloAlpha
        ctx.strokeStyle = halo
        ctx.lineWidth = 3.5
        ctx.strokeText(l, lx, yy)
        ctx.globalAlpha = a * (i === 0 ? 0.95 : 0.72)
        ctx.fillStyle = ink
        ctx.fillText(l, lx, yy)
      })
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = 1
    }

    // ---- the figure waving from Los Angeles: feet on the site, standing up off the globe in front of it ----
    const w3 = new Float32Array(3)
    const greet = (now: number, ms: number) => {
      if (!hi.on || now > hi.until) {
        hi.turn++
        hi.text = greeting(hi.turn, new Date().getHours())
        hi.spot = null
      }
      hi.on = true
      hi.until = Math.max(hi.until, now + ms)
    }
    const onFigure = (x: number, y: number, pad: number) => fig.on && figA > 0.5 && x > fig.l - pad && x < fig.r + pad && y > fig.t - pad && y < fig.b + pad
    const onBubble = (x: number, y: number) => hiBox.on && x > hiBox.l && x < hiBox.r && y > hiBox.t && y < hiBox.b
    const linkAt = (x: number, y: number, pad: number) =>
      onBubble(x, y) ? hiLinks.findIndex((c) => x > c.l - pad && x < c.r + pad && y > c.t - pad && y < c.b + pad) : -1
    const drawWave = (now: number, dt: number) => {
      toView(WAVE_SITE[0], WAVE_SITE[1], WAVE_SITE[2], w3, earthLon)
      const face = waveFade(w3[2])
      fig.on = face > 0
      hiBox.on = false
      if (!fig.on) {
        hi.on = false
        return
      }
      // finer type than the globe's cells
      const fs = ch * 0.88
      const fw = fs * 0.6
      const lh = fs * 0.92
      const pose = wavePose(Math.floor(earthLon * 2), reduced)
      const fh = pose.length * lh
      // feet on the nearest of the land's braille dots, which sit on a half-cell by quarter-cell grid
      const fx = (Math.floor((W / 2 + w3[0] * R) / (cw / 2)) + 0.5) * (cw / 2)
      const fy = (Math.floor((W / 2 - w3[1] * R) / (ch / 4)) + 0.5) * (ch / 4)
      // he stands up off the surface: upright on screen, leaning out with the globe's curve toward the limb
      let ux = w3[0] * 0.55
      let uy = -1 + w3[1] * 0.25
      const ul = Math.hypot(ux, uy)
      ux /= ul
      uy /= ul
      // and in front of it: against a hovering pointer he shifts a little, his shadow on the ground does not
      const k = reduced ? 1 : Math.min(1, dt * 6)
      const tx = ptr.inside && ptr.hover ? -((ptr.x - W / 2) / (W / 2)) * 3.5 : 0
      const ty = ptr.inside && ptr.hover ? -((ptr.y - W / 2) / (W / 2)) * 2.5 : 0
      par.x += (Math.max(-3.5, Math.min(3.5, tx)) - par.x) * k
      par.y += (Math.max(-2.5, Math.min(2.5, ty)) - par.y) * k
      const ox = fx + par.x
      const oy = fy + par.y * 0.4
      const hx = ox + ux * fh
      const hy = oy + uy * fh
      Object.assign(fig, { l: Math.min(ox, hx) - 2.2 * fw, t: hy - lh * 0.2, r: Math.max(ox, hx) + 2.2 * fw, b: oy + lh * 0.3 })
      const clear = !overlaps(fig, termBox) && !overlaps(fig, labelBox)
      figA = reduced ? (clear ? 1 : 0) : Math.max(0, Math.min(1, figA + (clear ? dt * 3 : -dt * 6)))
      const d = dimAt(fx, fy)
      const a = Math.min(1, A * 2.4 * face * figA * d)
      if (a < 0.02) {
        hi.on = false
        return
      }
      // hovered by a mouse or pen, he says hello while it stays; a tap says it for a while (onUp)
      const over = ptr.inside && ptr.hover && (onFigure(ptr.x, ptr.y, 6) || onBubble(ptr.x, ptr.y))
      if (over) greet(now, 900)
      if (hi.on && now > hi.until) hi.on = false
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // his shadow, a short smudge on the ground behind his feet
      ctx.globalAlpha = a * 0.35
      ctx.fillStyle = ink
      ctx.beginPath()
      ctx.ellipse(fx + fw * 0.3, fy + 1, fw * 1.6, Math.max(1, lh * 0.16), 0, 0, Math.PI * 2)
      ctx.fill()
      // the globe cleared from behind him, then the figure, sheared so his up is (ux, uy)
      ctx.setTransform(dpr, 0, -ux * dpr, -uy * dpr, ox * dpr, oy * dpr)
      ctx.globalCompositeOperation = 'destination-out'
      ctx.globalAlpha = face * figA * d * 0.9
      ctx.beginPath()
      ctx.roundRect(-1.9 * fw, -fh - lh * 0.1, 3.8 * fw, fh + lh * 0.1, fw * 0.6)
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = a
      ctx.fillStyle = ink
      ctx.font = `600 ${fs}px ${font}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (let i = 0; i < pose.length; i++)
        for (let c = 0; c < pose[i].length; c++) if (pose[i][c] !== ' ') ctx.fillText(pose[i][c], (c - 2) * fw, -fh + (i + 0.5) * lh)
      ctx.textAlign = 'start'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // the greeting, then the links, in a cowsay balloon over his head, its trail stepping down to him
      hi.a = reduced ? (hi.on ? 1 : 0) : Math.max(0, Math.min(1, hi.a + (hi.on ? dt * 8 : -dt * 5)))
      if (hi.a > 0.01 && hi.text) {
        const rows = balloon([hi.text, hiLinks.map((c) => c.label).join(' · ')])
        const n = rows[0].length
        // a character to a cell, the cells a whole number of the land's braille dots (half a column by a quarter row), so it sits on
        // the globe's own grid: the globe's cells on a wide screen, a little larger where they would be too small to read
        const bs = Math.max(11, ch * 0.86)
        const bcw = (cw / 2) * Math.ceil((bs * 0.6) / (cw / 2))
        const bch = (ch / 4) * Math.ceil((bs * 1.12) / (ch / 4))
        const dotX = (x: number) => Math.round(x / (cw / 2)) * (cw / 2)
        const dotY = (y: number) => Math.round(y / (ch / 4)) * (ch / 4)
        const vr = visibleRect()
        // on screen, off a satellite's callout and the terminal, and as far from the hero text as it can be
        const clearAt = (x0: number, y0: number, w: number, h: number) => {
          const box = { on: true, l: x0, t: y0, r: x0 + w, b: y0 + h }
          let m = x0 > vr.l + 6 && x0 + w < vr.r - 6 && y0 > vr.t + 4 && y0 + h < vr.b - 4 && !overlaps(box, labelBox) && !overlaps(box, termBox) ? 1 : 0
          for (let yy = y0 - ch / 2; yy <= y0 + h + ch / 2 && m > 0; yy += ch / 2)
            for (let xx = x0 - cw / 2; xx <= x0 + w + cw / 2; xx += cw / 2) m = Math.min(m, dimTargetAt(xx, yy))
          return m
        }
        // the trail is `steps` cells of \ down and right from column `col` under the balloon to just above his head, or of / down
        // and left (dir -1); where the balloon then sits
        const place = (steps: number, dir: number, col: number) => {
          const end = col + dir * (steps - 1)
          return [dotX(hx - dir * bcw * 0.4 - (end + 0.5) * bcw), dotY(hy - bch * 0.5 - (rows.length + steps - 0.5) * bch)]
        }
        const score = (steps: number, dir: number, col: number) => {
          const [x0, y0] = place(steps, dir, col)
          return clearAt(x0, y0, n * bcw, rows.length * bch)
        }
        // kept while it stays clear, so it never hops as the globe turns; else the shortest clear trail, nearest cowsay's own
        if (!hi.spot || score(hi.spot[0], hi.spot[1], hi.spot[2]) < 0.8) {
          let best: [number, number, number] = [2, 1, Math.min(8, n - 3)]
          let top = -1
          for (let steps = 2; steps <= 6 && top <= 0.8; steps++)
            for (const dir of [1, -1])
              for (let col = 2; col < n - 2; col++) {
                const m = score(steps, dir, col) - (steps - 2) * 0.03 - Math.abs(col - (dir > 0 ? 8 : n - 9)) * 0.004
                if (m > top) {
                  top = m
                  best = [steps, dir, col]
                }
              }
          hi.spot = best
        }
        const [steps, dir, col] = hi.spot
        const [bx, by0] = place(steps, dir, col)
        const by = by0 - (1 - hi.a) * 3
        // fainter where it has to sit by the hero text (which reads over it), never so faint its links do not
        const fade = face * figA * hi.a * Math.max(0.75, score(steps, dir, col))
        const cell = (r: number, c: number, g: string) => ctx.fillText(g, bx + (c + 0.5) * bcw, by + (r + 0.5) * bch)
        // on plain paper, as ASCII art is, so the globe's dots do not run through the words
        ctx.globalAlpha = fade
        ctx.fillStyle = halo
        ctx.fillRect(bx, by + bch * 0.3, n * bcw, (rows.length - 0.5) * bch)
        for (let i = 0; i < steps; i++) ctx.fillRect(bx + (col + dir * i) * bcw, by + (rows.length + i) * bch, bcw, bch)
        ctx.font = `${bs}px ${font}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = ink
        for (let r = 0; r < rows.length; r++) for (let c = 0; c < n; c++) if (rows[r][c] !== ' ') cell(r, c, rows[r][c])
        for (let i = 0; i < steps; i++) cell(rows.length + i, col + dir * i, dir > 0 ? '\\' : '/')
        Object.assign(hiBox, { on: hi.a > 0.5, l: bx, t: by, r: bx + n * bcw, b: by + rows.length * bch })
        // the links, in the accent and underlined while hovered, on the balloon's last line
        let c0 = 2
        for (let i = 0; i < hiLinks.length; i++) {
          const c = hiLinks[i]
          const len = [...c.label].length
          const x = bx + c0 * bcw
          const y = by + 2.5 * bch
          Object.assign(c, { l: x - 2, t: y - bch * 0.6, r: x + len * bcw + 2, b: y + bch * 0.6 })
          ctx.fillStyle = halo
          ctx.fillRect(x, y - bch * 0.5, len * bcw, bch)
          ctx.fillStyle = accent
          for (let k = 0; k < len; k++) cell(2, c0 + k, c.label[k])
          if (i === hiHover) ctx.fillRect(x, y + bs * 0.55, len * bcw, 1)
          c0 += len + 3
        }
        ctx.textAlign = 'start'
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = 1
    }

    // ---- frame ----
    const v3 = new Float32Array(3)
    const frame = (now: number) => {
      const t0 = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!reduced) lonC -= SPIN_DEG_S * dt
      // dim easing
      if (!dimSettled) {
        let moving = false
        for (let i = 0; i < dimC.length; i++) {
          const d = dimT[i] - dimC[i]
          if (Math.abs(d) > 0.01) {
            dimC[i] += d * (reduced ? 1 : 0.2)
            moving = true
          } else dimC[i] = dimT[i]
        }
        dimSettled = !moving
        lastLonCol = NaN
      }
      const lonCol = Math.floor(lonC * 2)
      if (lonCol !== lastLonCol) {
        lastLonCol = lonCol
        drawEarth()
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = 1
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.drawImage(earth, 0, 0)

      // terminal: eases to its target; a mouse that has left lets it drift home
      if (!term.userSet && now - term.lastSet > 1600) {
        term.tu = REST.u
        term.tv = REST.v
      }
      const ease = reduced ? 1 : 1 - Math.exp(-dt * 9)
      term.u += (term.tu - term.u) * ease
      term.v += (term.tv - term.v) * ease
      const tx = W / 2 + term.u * R
      const ty = W / 2 - term.v * R
      const g = fromView(term.u, term.v)

      if (sat) {
        if (!reduced) refreshPositions(false)
        const n = sat.count
        const cnt = Math.ceil(n / stride)
        if (sx.length !== cnt) {
          sx = new Float32Array(cnt)
          sy = new Float32Array(cnt)
          sv = new Uint8Array(cnt)
        }
        const linked = new Set(strands.filter((s) => !s.dying).map((s) => s.sat))
        let drawn = 0
        const a = atlas.ink!
        for (let j = 0, i = 0; i < n; i += stride, j++) {
          const x = ecef[i * 3]
          const y = ecef[i * 3 + 1]
          const z = ecef[i * 3 + 2]
          const r = Math.hypot(x, y, z)
          toView(x / r, y / r, z / r, v3)
          const s = shellR(r)
          const px = W / 2 + v3[0] * s * R
          const py = W / 2 - v3[1] * s * R
          sx[j] = px
          sy[j] = py
          const behind = v3[2] < 0
          if (behind && Math.hypot(v3[0], v3[1]) * s < 1.02) {
            sv[j] = 0
            continue
          }
          sv[j] = behind ? 1 : 2
          const al = A * (behind ? 0.9 : 1.9) * dimAt(px, py)
          if (al < 0.02) continue
          ctx.globalAlpha = Math.min(1, al)
          const g = linked.has(i) ? SAT_LINKED : behind ? SAT : SAT_FRONT
          glyph(ctx, linked.has(i) ? atlas.accent! : a, g, snapX(px), snapY(py))
          drawn++
        }
        stats.sats = drawn

        // links from the terminal to the satellites overhead
        if (now - candStamp > 300 || reduced) {
          candStamp = now
          candidates = pickCandidates(g)
          overhead = countOverhead(g)
        }
        for (const s of strands) if (!candidates.includes(s.sat)) s.dying = true
        for (const c of candidates) {
          if (strands.some((s) => s.sat === c && !s.dying)) continue
          const j = c / stride
          strands.push(newStrand(c, tx, ty, sx[j], sy[j], now))
        }
        for (let k = strands.length - 1; k >= 0; k--) {
          const s = strands[k]
          s.alpha = reduced ? (s.dying ? 0 : 1) : Math.max(0, Math.min(1, s.alpha + (s.dying ? -dt * 4 : dt * 3)))
          if (s.dying && s.alpha <= 0) {
            strands.splice(k, 1)
            continue
          }
          const j = s.sat / stride
          if (!reduced) stepStrand(s, tx, ty, sx[j], sy[j], dt)
          else {
            const fresh = newStrand(s.sat, tx, ty, sx[j], sy[j], now)
            s.px = fresh.px
            s.py = fresh.py
          }
          drawStrand(s, reduced ? 1 : Math.min(1, (now - s.born) / 450))
        }
        stats.strands = strands.length

        // the terminal and its counter
        const td = dimAt(tx, ty)
        ctx.globalAlpha = Math.min(1, A * 2.4 * td)
        glyph(ctx, atlas.accent!, TERMINAL, tx, ty)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        const fs = Math.max(11, Math.min(12, ch))
        ctx.font = `${fs}px ${font}`
        ctx.textBaseline = 'middle'
        ctx.fillStyle = accent
        ctx.globalAlpha = Math.min(1, A * 2.2 * td)
        const label = `${overhead} overhead`
        const lw = ctx.measureText(label).width
        // right of the terminal unless that runs off the visible edge or into the hero text, then left; over text either
        // way, it fades with the text clearing
        const ly = ty + ch * 1.1
        const clear = (x0: number) => {
          let m = 1
          for (let x = x0; x <= x0 + lw; x += cw) m = Math.min(m, dimTargetAt(x, ly))
          return m
        }
        const right = tx + cw + lw > visibleRect().r - 6 ? 0 : clear(tx + cw)
        const left = clear(tx - cw - lw)
        const lx = right >= left ? tx + cw : tx - cw - lw
        ctx.globalAlpha *= Math.max(right, left)
        ctx.fillText(label, lx, ly)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        Object.assign(termBox, { on: true, l: Math.min(tx, lx) - cw, t: ty - ch, r: Math.max(tx, lx + lw) + cw, b: ly + ch * 0.7 })
      }

      drawWave(now, dt)

      if (sat) {
        // callouts
        if (callout.sat < 0 && (reduced || now > callout.next)) pickCallout(now)
        drawCallout(now)
      }
      ctx.globalAlpha = 1
      const ms = performance.now() - t0
      stats.frames++
      stats.totalMs += ms
      stats.maxMs = Math.max(stats.maxMs, ms)
    }

    const loop = (now: number) => {
      raf = 0
      if (now - lastDraw >= FRAME_MS - 2) {
        lastDraw = now
        frame(now)
      }
      if (active && !reduced) raf = requestAnimationFrame(loop)
    }
    const kick = () => {
      if (raf) return
      last = performance.now()
      raf = requestAnimationFrame(loop)
    }
    const redrawOnce = () => {
      if (!reduced) return kick()
      last = performance.now()
      frame(last)
    }

    // ---- pointer (mouse, pen and touch; never blocks scrolling or clicks) ----
    const toCanvas = (e: PointerEvent) => {
      const cr = cv.getBoundingClientRect()
      const k = W / (cr.width || 1)
      return [(e.clientX - cr.left) * k, (e.clientY - cr.top) * k]
    }
    const inSlot = (e: PointerEvent) => {
      const r = (slot ?? el).getBoundingClientRect()
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    }
    const setTerminal = (x: number, y: number, user: boolean) => {
      const u = (x - W / 2) / R
      const v = -(y - W / 2) / R
      const q = Math.hypot(u, v)
      if (q > 1) return false
      const k = q > 0.94 ? 0.94 / q : 1
      term.tu = u * k
      term.tv = v * k
      term.lastSet = performance.now()
      term.userSet = user
      return true
    }
    const onMove = (e: PointerEvent) => {
      if (!inSlot(e)) {
        ptr.inside = false
        return
      }
      const [x, y] = toCanvas(e)
      const now = performance.now()
      const dt = Math.max(8, now - ptr.t) / 1000
      if (ptr.inside) {
        ptr.vx = (x - ptr.x) / dt
        ptr.vy = (y - ptr.y) / dt
      }
      ptr.x = x
      ptr.y = y
      ptr.t = now
      ptr.inside = true
      const hovering = e.pointerType !== 'touch'
      ptr.hover = hovering
      // over the figure the terminal stays put, so it never covers him while he says hello
      const onFig = onFigure(x, y, 6) || onBubble(x, y)
      hiHover = hovering ? linkAt(x, y, 0) : -1
      if ((hovering || ptr.down) && !onFig) setTerminal(x, y, false)
      if (reduced) redrawOnce()
    }
    const onDown = (e: PointerEvent) => {
      if (!inSlot(e)) return
      const [x, y] = toCanvas(e)
      ptr.down = { x, y, t: performance.now(), id: e.pointerId }
    }
    const onUp = (e: PointerEvent) => {
      const d = ptr.down
      ptr.down = null
      if (!d || d.id !== e.pointerId || !inSlot(e)) return
      const target = e.target as Element | null
      if (target?.closest?.('a, button, input, textarea, select, label, [role="button"]')) return
      const [x, y] = toCanvas(e)
      if (Math.hypot(x - d.x, y - d.y) > 12 || performance.now() - d.t > 600) return
      // a tap on one of his links opens it; on the figure he says hello, long enough to reach them; near a satellite it pins its
      // callout; elsewhere on the globe it moves the terminal there
      const link = linkAt(x, y, e.pointerType === 'mouse' ? 0 : 6)
      if (link >= 0) {
        window.open(hiLinks[link].href, '_blank', 'noopener')
        return
      }
      if (onBubble(x, y)) return
      if (onFigure(x, y, 8)) {
        greet(performance.now(), 5000)
        redrawOnce()
        if (reduced) setTimeout(redrawOnce, 5100)
        return
      }
      const hit = (e.pointerType === 'mouse' ? 14 : 26) * (W / (cv.getBoundingClientRect().width || 1))
      let best = -1
      let bd = hit
      for (let j = 0; j < sv.length; j++) {
        if (sv[j] !== 2) continue
        const dd = Math.hypot(sx[j] - x, sy[j] - y)
        if (dd < bd) {
          bd = dd
          best = j
        }
      }
      const now = performance.now()
      if (best >= 0) setCallout(best * stride, now, true)
      else {
        if (callout.pinned) callout.sat = -1
        setTerminal(x, y, true)
      }
      redrawOnce()
    }
    const onLeave = () => {
      ptr.inside = false
    }
    const onCancel = () => {
      ptr.down = null
    }

    // ---- lifecycle ----
    let started = false
    const start = () => {
      if (started || !layout()) return
      started = true
      void loadLand().then((rings) => {
        mask = rasterize(rings)
        lastLonCol = NaN
        redrawOnce()
      }).catch(() => {})
      void loadStarlinkWithIds().then((r) => {
        if (!r) return
        const p = r.sat
        sat = p
        ids = r.ids
        ecef = new Float32Array(p.count * 3)
        refreshPositions(true)
        callout.next = performance.now() + 1800
        if (process.env.NODE_ENV !== 'production') {
          const q = new URLSearchParams(window.location.search).get('callout')
          if (q !== null) {
            // Dev only: ?callout=1 pins the first callout, for screenshots.
            callout.next = 0
            pinFirst = true
          }
        }
        redrawOnce()
      })
      void document.fonts?.load(`12px ${font}`).then(() => {
        buildAtlases()
        lastLonCol = NaN
        measureText()
        redrawOnce()
      })
      redrawOnce()
    }

    let near = false
    const update = () => {
      active = near && document.visibilityState === 'visible'
      if (active) {
        start()
        kick()
      } else if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    }
    const io = new IntersectionObserver(([e]) => {
      near = e.isIntersecting
      update()
    }, { rootMargin: '120px' })
    io.observe(el)
    document.addEventListener('visibilitychange', update)

    const ro = new ResizeObserver(() => {
      if (!started || el.clientWidth === box) return
      layout()
      redrawOnce()
    })
    ro.observe(el)

    const scheme = window.matchMedia('(prefers-color-scheme: dark)')
    const onScheme = () => {
      readColours()
      buildAtlases()
      lastLonCol = NaN
      redrawOnce()
    }
    scheme.addEventListener('change', onScheme)
    // The phrase on screen changes: clear around the new one.
    const list = document.querySelector('.hook__list')
    const mo = list ? new MutationObserver(() => {
      measureText()
      kick()
    }) : null
    mo?.observe(list!, { attributes: true, attributeFilter: ['data-current'], subtree: true })
    // the halo behind callout text follows the hero tint
    const tintMo = new MutationObserver(() => {
      halo = pickHalo(getComputedStyle(el))
    })
    tintMo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('pointercancel', onCancel, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    window.addEventListener('blur', onLeave)

    Object.defineProperty(window, '__asciiHero', {
      configurable: true,
      enumerable: false,
      value: () => ({ ...stats, avgMs: stats.frames ? +(stats.totalMs / stats.frames).toFixed(3) : 0, box, W, dpr, cols, rows, satellites: sat?.count ?? 0, refEpoch: sat?.refEpoch ?? 0, callout: callout.sat >= 0 ? callout.lines : [], wave: fig.on ? { ...fig, alpha: figA } : null, bubble: hiBox.on ? { ...hiBox, links: hiLinks.map((c) => ({ ...c })) } : null, pinned: callout.sat >= 0 && callout.pinned }),
    })

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      mo?.disconnect()
      tintMo.disconnect()
      scheme.removeEventListener('change', onScheme)
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('blur', onLeave)
    }
  }, [])

  return (
    <div ref={wrap} className={`hero-globe hero-globe--slot hero-ascii ${className}`} aria-hidden="true">
      <canvas ref={canvas} className="hero-ascii__canvas" />
    </div>
  )
}

/** Land rings -> an equirectangular mask, MASK_W x MASK_H, 1 for land. */
function rasterize(rings: Ring[]): Uint8Array {
  const c = document.createElement('canvas')
  c.width = MASK_W
  c.height = MASK_H
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.fillStyle = '#fff'
  g.beginPath()
  for (const r of rings) {
    // rings that cross the antimeridian jump by ~360 degrees; unwrap them and draw at three offsets so the jump is no
    // edge. A ring that wraps the whole globe (Antarctica) is closed through its pole.
    const pts: number[] = []
    let shift = 0
    for (let k = 0; k < r.length; k += 2) {
      if (k) {
        const d = r[k] - r[k - 2]
        if (d > 180) shift -= 360
        else if (d < -180) shift += 360
      }
      pts.push(r[k] + shift, r[k + 1])
    }
    if (shift) {
      const pole = r[1] < 0 ? -90 : 90
      pts.push(pts[pts.length - 2], pole, pts[0], pole)
    }
    for (const off of [-360, 0, 360]) {
      for (let k = 0; k < pts.length; k += 2) {
        const x = (pts[k] + off + 180) * (MASK_W / 360)
        const y = (90 - pts[k + 1]) * (MASK_H / 180)
        if (k === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.closePath()
    }
  }
  g.fill('evenodd')
  const px = g.getImageData(0, 0, MASK_W, MASK_H).data
  const out = new Uint8Array(MASK_W * MASK_H)
  for (let i = 0; i < out.length; i++) out[i] = px[i * 4] > 127 ? 1 : 0
  return out
}
