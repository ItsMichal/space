// Replacement for `ImageResponse` from next/og: the same engine (satori for layout, resvg for rasterising), run in Node at build time.
// lib/og.tsx builds the card as JSX and hands it here; scripts/share-cards.ts calls `.png()` and writes the files.
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import type { ReactElement } from 'react'

type Font = { name: string; data: Buffer; weight?: number; style?: 'normal' | 'italic' }
type Options = { width: number; height: number; fonts: Font[] }

export class ImageResponse {
  constructor(
    private readonly element: ReactElement,
    private readonly options: Options
  ) {}

  async png(): Promise<Buffer> {
    const { width, height, fonts } = this.options
    const svg = await satori(this.element, { width, height, fonts: fonts as never })
    return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng())
  }
}
