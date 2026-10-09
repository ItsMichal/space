'use client'

import { useEffect, type RefObject } from 'react'
import { displacementMapUrl } from './displacement'

export type LiquidGlassOptions = {
  /** Width of the refracting rim in px. Default min(radius, 24). */
  bezel?: number
  /** feDisplacementMap scale. Default var(--glass-refraction). */
  refraction?: number
  /** Frost in px. Default var(--glass-blur). */
  blur?: number
  /** Backdrop saturation. Default var(--glass-saturate). */
  saturate?: number
}

const SVGNS = 'http://www.w3.org/2000/svg'
let uid = 0

/**
 * Only Chromium applies url() filters inside backdrop-filter; Safari and Firefox keep the frost.
 * Edge, Opera, Brave, Samsung Internet and Android Chrome all report "Chrome/"; iOS browsers (CriOS) do not.
 */
export function supportsSvgBackdrop(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Chrome\//.test(navigator.userAgent)
}

function cssNumber(el: Element, name: string, fallback: number): number {
  const v = parseFloat(getComputedStyle(el).getPropertyValue(name))
  return Number.isFinite(v) ? v : fallback
}

/**
 * Attaches the refraction filter to `ref.current`. Regenerates the map when the
 * element resizes (debounced), caches maps by geometry, and removes the filter on
 * cleanup. No-op outside Chromium, or when the user asks for reduced transparency.
 */
export function useLiquidGlass(ref: RefObject<HTMLElement | null>, opts: LiquidGlassOptions = {}) {
  const { bezel, refraction, blur, saturate } = opts

  useEffect(() => {
    const el = ref.current
    if (!el || !supportsSvgBackdrop()) return
    if (window.matchMedia('(prefers-reduced-transparency: reduce)').matches) return

    const id = `lg-filter-${++uid}`
    const svg = document.createElementNS(SVGNS, 'svg')
    svg.setAttribute('width', '0')
    svg.setAttribute('height', '0')
    svg.setAttribute('aria-hidden', 'true')
    svg.style.position = 'absolute'
    svg.style.pointerEvents = 'none'
    document.body.appendChild(svg)

    let timer = 0
    let lastKey = ''

    const build = () => {
      const w = Math.round(el.offsetWidth)
      const h = Math.round(el.offsetHeight)
      if (w < 4 || h < 4) return
      const radius = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 28, h / 2, w / 2)
      const rim = bezel ?? Math.min(radius, 24)
      // The token is the scale at a 24px+ rim; scale down for smaller rims.
      const scale = refraction ?? cssNumber(el, '--glass-refraction', 36) * Math.min(1, rim / 24)
      const frost = blur ?? cssNumber(el, '--glass-blur', 10)
      const sat = saturate ?? cssNumber(el, '--glass-saturate', 1.6)

      const key = `${w}|${h}|${radius}|${rim}|${scale}|${frost}|${sat}`
      if (key === lastKey) return
      lastKey = key

      const url = displacementMapUrl(w, h, radius, rim)
      if (!url) return

      svg.innerHTML =
        `<filter id="${id}" x="0" y="0" width="${w}" height="${h}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
        `<feGaussianBlur in="SourceGraphic" stdDeviation="${frost / 4}" result="soft"/>` +
        `<feImage href="${url}" x="0" y="0" width="${w}" height="${h}" result="map"/>` +
        // chromatic dispersion: red bends a touch more than blue
        `<feDisplacementMap in="soft" in2="map" scale="${scale * 1.06}" xChannelSelector="R" yChannelSelector="G" result="dr"/>` +
        `<feColorMatrix in="dr" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>` +
        `<feDisplacementMap in="soft" in2="map" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="dg"/>` +
        `<feColorMatrix in="dg" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>` +
        `<feDisplacementMap in="soft" in2="map" scale="${scale * 0.94}" xChannelSelector="R" yChannelSelector="G" result="db"/>` +
        `<feColorMatrix in="db" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>` +
        `<feBlend in="r" in2="g" mode="screen" result="rg"/>` +
        `<feBlend in="rg" in2="b" mode="screen" result="rgb"/>` +
        `<feColorMatrix in="rgb" type="saturate" values="${sat}"/>` +
        `</filter>`
      // Do not also set -webkit-backdrop-filter: in Chromium it aliases this property.
      el.style.backdropFilter = `url(#${id})`
      el.classList.add('lg--refract')
    }

    const schedule = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(build, 120)
    }

    build()
    const ro = new ResizeObserver(schedule)
    ro.observe(el)

    return () => {
      window.clearTimeout(timer)
      ro.disconnect()
      svg.remove()
      el.style.backdropFilter = ''
      el.classList.remove('lg--refract')
    }
  }, [ref, bezel, refraction, blur, saturate])
}
