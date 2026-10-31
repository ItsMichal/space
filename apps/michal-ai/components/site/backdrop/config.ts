/**
 * Every tunable of the page backdrop in one place (documented in docs/backdrop.md). Colours are sRGB 0..1.
 * The soft layers are pale on purpose: `lumFloorLight` is a hard guarantee, not a hint (see shaders.ts).
 */
export type Pigment = readonly [number, number, number]

/** Process-colour pigments, desaturated toward pastel. Multiplied into the paper like ink on stock. */
export const PIGMENT = {
  cyan: [0.5, 0.8, 0.92], // accent only: cyan is what turns beige grey-green
  magenta: [0.95, 0.62, 0.74],
  peach: [1.0, 0.78, 0.62],
  yellow: [1.0, 0.92, 0.5],
} as const satisfies Record<string, Pigment>

export type BlobSpec = {
  pigment: keyof typeof PIGMENT
  /** Centre in units of U (U = max(viewport width, 700px)); y is the position on the vertical repeat. */
  x: number
  y: number
  /** Radius in U. 0.85 to 1.2 means a blob 1.7 to 2.4 viewport widths across: always wider than the screen. */
  r: number
  /** Peak ink coverage (0..1) at the blob centre, before the luminance floor. */
  amp: number
  /** Drift: orbit amplitude (U) and period (seconds) per axis. */
  ax: number
  ay: number
  px: number
  py: number
}

export const BACKDROP = {
  /** One inkless blob (amp 0): it only shapes where the glyphs gather. Any ink here read as a coloured sphere, so the god rays
   *  are the page's only light. Kept because the shader's blob array needs a length of at least one (NB). */
  blobs: [
    { pigment: 'magenta', x: 1.0, y: 0.75, r: 0.98, amp: 0, ax: 0.26, ay: 0.3, px: 330, py: 250 },
  ] satisfies BlobSpec[],
  /** Vertical repeat of the blob field, in U. The field tiles, so a long page never runs out of colour. */
  repeat: 2.6,
  /** Blobs are cut off below this fraction of their peak weight (smoothstep), so the paper shows between them. */
  blobCut: 0.6,
  /** Warmth constraint (light mode, sRGB 0..1): backdrop R is at least B + this, and G never exceeds R. The paper has R-B = 0.047. */
  warmMin: 0.03,
  /** Domain warp strength (U). Bends the round blobs into abstract shapes. */
  warp: 0.32,
  /** Hard floor on backdrop luma relative to the paper's luma (Rec.709 weights on the encoded sRGB values, which tracks perceived
   *  lightness), light mode. The same pixels in WCAG linear luminance are at least about 0.85 of the paper's. */
  lumFloorLight: 0.93,
  /** Dark mode: the brightest backdrop pixel may be at most this relative luminance (WCAG Y). Paper is about 0.008. */
  lumCeilDark: 0.022,
  /** Dark mode blob glow (added, dim). */
  darkGlow: 0.2,

  /** Gentle god rays, the page's only light: thin shafts lifting the paper toward a near-white highlight (paper.lightHi). */
  rays: {
    strength: 0.7, // how far the paper lifts toward the warm highlight inside a shaft (0..1)
    fringe: 0.05, // pale cyan/magenta ink fringe on the shaft edges
    originX: 1.08, // shaft origin as a fraction of viewport width / height (off screen, top right)
    originY: -0.22,
    darkStrength: 0.02,
  },

  glyphs: {
    cellPx: 12, // CSS px; the globe matrix is 6px, the old paper pitch 24px: 12 is the middle of the same family
    density: 0.034, // chance per cell, before the cluster/void modulation (0.2x in voids to 2x in clusters)
    alpha: 0.22, // hard cap on glyph opacity (the globe's dots peak at 0.28 to 0.42 of ink)
    constellationChance: 0.1, // per 14x14-cell block, further gated by density
    twinkle: 0.28, // opacity swing, opacity only
    shootingEvery: 80, // seconds between shooting stars
    shootingFor: 5, // seconds a shooting star takes to cross
    inkLight: [0.13, 0.13, 0.11], // same ink the globe uses
    inkDark: [0.92, 0.91, 0.85],
    /** Glyphs thin out behind the reading column: half width (CSS px, capped at half the viewport, so on phones it covers everything), feather, and the factor in the middle. */
    thinHalfWidth: 540,
    thinFeather: 140,
    thinFactor: 0.12,
  },

  /** Shader lensing of the backdrop under glass elements (`[data-glass-lens]`, `.tile`). */
  lens: {
    selector: '[data-glass-lens], .tile',
    max: 16,
    edgePx: 15, // CSS px band where the glass bends hardest
    bendPx: 11, // CSS px of displacement at the very edge
    magnify: 0.025, // slight magnification across the slab
    splitPx: 1.6, // CSS px of C/M channel split at the edge
    rimPx: 1.4, // specular rim width
    rimLight: 0.5, // rim strength, light mode
    rimDark: 0.16, // rim strength, dark mode (no milky veil)
  },

  grain: 0.012, // dither: a hair of per-pixel noise so the soft washes do not band
  /** Paper tooth (tooth.ts), peak-to-peak amplitude in 0..1 colour units; the texture has mean 0.5, so the paper keeps its colour. */
  tooth: { light: 0.075, dark: 0.06 },
  parallax: { blobs: 0.15, glyphs: 0.32, rays: 0.06, still: 0.2 }, // fraction of page scroll; `still` is the one rate used on iOS WebKit
  /** iOS WebKit: spare canvas height (CSS px, half above, half below) for the transform parallax. Keep in sync with paper-grid.css. */
  stillPad: 480,
  /** Ignore height-only size changes below this (CSS px) when the layer is not sized in lvh. */
  resizeIgnorePx: 96,

  paper: { light: [0xf4 / 255, 0xf1 / 255, 0xe8 / 255], lightHi: [1, 0.995, 0.975], dark: [0x12 / 255, 0x16 / 255, 0x12 / 255] },

  /** Frame pacing. Idle drift is slow, so it is redrawn rarely; scroll-driven redraws are capped so glass cards with
   *  backdrop-filter are not invalidated at 60Hz. */
  fps: { idle: 12, scroll: 30, touchIdle: 5 },
  lowResDivisor: 6, // soft layers at 1/6 of CSS resolution
  maxDpr: 1.5,
  fadeInMs: 1100,
  /** Static frame used for reduced motion and the baked fallback images (seconds). Outside any shooting star window. */
  staticTime: 37,
} as const
