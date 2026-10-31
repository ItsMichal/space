export interface GlyphGrid {
  w: number
  h: number
  pal: [number, number][]
  c: string
  l: string
}
export const ROWS_AROUND: number
export function drawGlyphs(canvas: HTMLCanvasElement, grid: GlyphGrid, opts?: { dark?: boolean; ground?: string; font?: string; maxFont?: number }): void
