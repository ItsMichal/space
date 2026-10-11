// Shared renderer for generated Open Graph images (next/og). Paper background, ink title, sans kind line.
// Only ever executed at build time: the routes that use it are statically generated.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import type { Post } from '@/lib/content/types'
import { SECTION } from '@/lib/seo'

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

// Bundled brand fonts (OFL). Without them Satori fetches fallback fonts for glyphs
// like "→" at build time, which fails. Plex Mono also covers arrows for the sans.
const fontDir = join(process.cwd(), 'lib/og-fonts')
let fonts: { name: string; data: Buffer; weight: 400 | 600; style: 'normal' }[] | undefined
// Read lazily so merely importing this module never touches the filesystem (Workers have none).
function loadFonts() {
  fonts ??= [
    { name: 'Schibsted Grotesk', data: readFileSync(join(fontDir, 'SchibstedGrotesk-SemiBold.ttf')), weight: 600, style: 'normal' },
    { name: 'IBM Plex Mono', data: readFileSync(join(fontDir, 'IBMPlexMono-Regular.ttf')), weight: 400, style: 'normal' },
  ]
  return fonts
}

const PAPER = '#f4f1e8'
const INK = '#18211b'
const MUTED = '#525c4f'

export function renderPostOg(post: Post) {
  const len = post.title.length
  const fontSize = len > 70 ? 56 : len > 48 ? 68 : len > 28 ? 80 : 96
  const kindLabel = `${post.parent ? (post.series ?? 'Project') : SECTION[post.kind].kindLabel}  ·  ${post.date.slice(0, 4)}`
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: PAPER,
          fontFamily: 'Schibsted Grotesk',
          color: INK,
          padding: '72px 80px',
        }}
      >
        <div style={{ display: 'flex', fontFamily: 'Schibsted Grotesk', fontSize: 28, color: MUTED }}>
          {kindLabel}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize, lineHeight: 1.05, fontWeight: 600, letterSpacing: -2 }}>
            {post.title}
          </div>
          {post.tags.length ? (
            <div style={{ display: 'flex', fontFamily: 'Schibsted Grotesk', fontSize: 26, color: MUTED, marginTop: 32 }}>
              {post.tags.slice(0, 5).join('  ·  ')}
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: `2px solid ${INK}`,
            paddingTop: 24,
            fontFamily: 'Schibsted Grotesk',
            fontSize: 26,
          }}
        >
          <div style={{ display: 'flex' }}>Michał Bodzianowski</div>
          <div style={{ display: 'flex', color: MUTED }}>michal.ai</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: loadFonts() }
  )
}
