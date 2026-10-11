import type { CSSProperties } from 'react'

// Soft, licensed flower photographs prepared by scripts/botanical-soft.mjs (see public/botanical/CREDITS.md).
export const photos = {
  'cosmos-sky': 0.9259,
  'daisies-glow': 0.7246,
  'poppy-pale': 1.0234,
  'blossom-sky': 0.8318,
  'cottongrass-meadow': 1.6,
  'cottongrass-glow': 1.3035,
  'lupine-green': 1.0234,
  'avens-white': 1.2999,
  'cosmos-blush': 1.1854,
} as const
export type PhotoId = keyof typeof photos

type Props = { id: PhotoId; className?: string; style?: CSSProperties; sizes: string; priority?: boolean }

export function Photo({ id, className, style, sizes, priority }: Props) {
  const a = photos[id]
  const set = (ext: string) => `/botanical/photo/${id}-700.${ext} 700w, /botanical/photo/${id}-1400.${ext} 1400w`
  return (
    <picture>
      <source type="image/avif" srcSet={set('avif')} sizes={sizes} />
      <source type="image/webp" srcSet={set('webp')} sizes={sizes} />
      <img
        src={`/botanical/photo/${id}-700.webp`}
        srcSet={set('webp')}
        sizes={sizes}
        alt=""
        aria-hidden="true"
        width={1400}
        height={Math.round(1400 / a)}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        className={className}
        style={style}
      />
    </picture>
  )
}
