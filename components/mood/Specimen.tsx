import type { CSSProperties } from 'react'

// Real, public-domain botanical plates (see public/botanical/CREDITS.md), cut out onto transparency.
const plates = {
  lupinus: { alt: 'Lupine, hand-coloured engraving, 1827', sizes: [[520, 749], [1000, 1440]] },
  dryas: { alt: 'Mountain avens, hand-coloured engraving, 1761', sizes: [[560, 520], [1100, 1022]] },
  silene: { alt: 'Moss campion, hand-coloured engraving, 1761', sizes: [[480, 413], [847, 729]] },
  papaver: { alt: 'Arctic poppy, hand-coloured engraving, 1761', sizes: [[420, 820], [665, 1299]] },
  eriophorum: { alt: 'Cotton grass, hand-coloured engraving, 1813', sizes: [[420, 782], [780, 1452]] },
} as const

export type PlateId = keyof typeof plates

type Props = {
  id: PlateId
  /** CSS width of the specimen at its layout size, e.g. "min(46vw, 520px)" (drives `sizes`). */
  width: string
  className?: string
  style?: CSSProperties
  priority?: boolean
  /** Decorative by default: the art carries no information. */
  decorative?: boolean
}

export function Specimen({ id, width, className, style, priority, decorative = true }: Props) {
  const p = plates[id]
  const set = (ext: 'avif' | 'webp') => p.sizes.map(([w]) => `/botanical/${id}-${id === 'papaver' && w === 665 ? 760 : w}.${ext} ${w}w`).join(', ')
  const [w0, h0] = p.sizes[p.sizes.length - 1]
  return (
    <picture>
      <source type="image/avif" srcSet={set('avif')} sizes={width} />
      <source type="image/webp" srcSet={set('webp')} sizes={width} />
      <img
        src={`/botanical/${id}-${p.sizes[0][0]}.webp`}
        alt={decorative ? '' : p.alt}
        width={w0}
        height={h0}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        className={className}
        style={{ width, height: 'auto', ...style }}
      />
    </picture>
  )
}
