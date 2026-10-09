import type { FieldColors, RGB } from './field'

let scratch: CanvasRenderingContext2D | null = null

/** Resolve any CSS color string (hex, rgb(), color-mix(), named) to 0..1 RGB. */
export function parseColor(css: string, fallback: RGB): RGB {
  if (!css) return fallback
  scratch ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!scratch) return fallback
  scratch.clearRect(0, 0, 1, 1)
  scratch.fillStyle = '#000'
  scratch.fillStyle = css
  scratch.fillRect(0, 0, 1, 1)
  const d = scratch.getImageData(0, 0, 1, 1).data
  return [d[0] / 255, d[1] / 255, d[2] / 255]
}

function cssVar(el: Element, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim()
}

export function readFieldColors(el: Element): FieldColors {
  return {
    dot: parseColor(cssVar(el, '--dot'), [0.77, 0.76, 0.73]),
    ink: parseColor(cssVar(el, '--ink-faint'), [0.55, 0.54, 0.52]),
    accent: parseColor(cssVar(el, '--accent'), [0.78, 0.25, 0.11]),
  }
}

/** CSS color strings for presence-1..6 (index 0 unused). */
export function readPresenceColors(el: Element): string[] {
  const fallback = ['', '#e0502a', '#2e57e6', '#0e8f7e', '#b07a00', '#7748db', '#d6437f']
  return fallback.map((fb, i) => (i === 0 ? '' : cssVar(el, `--presence-${i}`) || fb))
}
