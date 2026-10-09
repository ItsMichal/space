// Shared renderer for generated Open Graph images (next/og). Paper background, ink title, mono eyebrow.
// Only ever executed at build time: the routes that use it are statically generated.
import { ImageResponse } from 'next/og'
import type { Post } from '@/lib/content/types'
import { SECTION } from '@/lib/seo'

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

const PAPER = '#f6f5f1'
const INK = '#141416'
const MUTED = '#6b6a66'

export function renderPostOg(post: Post) {
  const len = post.title.length
  const fontSize = len > 70 ? 56 : len > 48 ? 68 : len > 28 ? 80 : 96
  const eyebrow = `${SECTION[post.kind].eyebrow.toUpperCase()}  /  ${post.date.slice(0, 4)}`
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
          color: INK,
          padding: '72px 80px',
        }}
      >
        <div style={{ display: 'flex', fontFamily: 'monospace', fontSize: 26, letterSpacing: 4, color: MUTED }}>
          {eyebrow}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize, lineHeight: 1.05, fontWeight: 700, letterSpacing: -2 }}>
            {post.title}
          </div>
          {post.tags.length ? (
            <div style={{ display: 'flex', fontFamily: 'monospace', fontSize: 26, color: MUTED, marginTop: 32 }}>
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
            fontFamily: 'monospace',
            fontSize: 26,
          }}
        >
          <div style={{ display: 'flex' }}>Michal Bodzianowski</div>
          <div style={{ display: 'flex', color: MUTED }}>michal.us</div>
        </div>
      </div>
    ),
    OG_SIZE
  )
}
