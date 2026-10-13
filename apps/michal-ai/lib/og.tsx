// Shared renderer for generated Open Graph images (next/og). Only ever executed at build time: the routes that use
// it (app/**/opengraph-image.tsx) are force-static, so the cards ship as plain PNG assets and Workers never render them.
// Cards follow the site: warm paper, ink type, Newsreader for the home name, Schibsted Grotesk for titles.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from './og-render'
import type { Post, PostKind } from '@/lib/content/types'
import { SECTION } from '@/lib/seo'
import { profile } from '@/content/profile'

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

// Bundled brand fonts (OFL). Without them Satori fetches fallback fonts for glyphs
// like "→" at build time, which fails. Plex Mono also covers arrows for the sans.
const fontDir = join(process.cwd(), 'lib/og-fonts')
type OgFont = { name: string; data: Buffer; weight: 300 | 400 | 600; style: 'normal' | 'italic' }
let fonts: OgFont[] | undefined
// Read lazily so merely importing this module never touches the filesystem (Workers have none).
function loadFonts() {
  fonts ??= [
    { name: 'Schibsted Grotesk', data: readFileSync(join(fontDir, 'SchibstedGrotesk-SemiBold.ttf')), weight: 600, style: 'normal' },
    { name: 'IBM Plex Mono', data: readFileSync(join(fontDir, 'IBMPlexMono-Regular.ttf')), weight: 400, style: 'normal' },
    { name: 'Newsreader', data: readFileSync(join(fontDir, 'Newsreader-Light.ttf')), weight: 300, style: 'normal' },
    { name: 'Newsreader', data: readFileSync(join(fontDir, 'Newsreader-Italic.ttf')), weight: 400, style: 'italic' },
  ]
  return fonts
}

const PAPER = '#f4f1e8'
const PAPER_HOME = '#efe5cb'
const INK = '#18211b'
const MUTED = '#525c4f'

/** The post's cover crop (scripts/build-images.mjs writes public/media/_og/<slug>.jpg, 456x534) as a data URI.
 *  Satori cannot read WebP and the card must not embed a multi-MB original, hence the small JPEG. */
function coverDataUri(post: Post) {
  if (!post.cover) return undefined
  try {
    return `data:image/jpeg;base64,${readFileSync(join(process.cwd(), 'public/media/_og', `${post.slug}.jpg`)).toString('base64')}`
  } catch {
    throw new Error(`share card for "${post.slug}": public/media/_og/${post.slug}.jpg is missing (run npm run images)`)
  }
}

// The site mark ("M!"): path data read from public/logo.svg (the single source the nav, favicon and app icon were made from)
// and filled with ink. Read lazily like the fonts. Every card carries it at bottom left, same size and clear space.
let logoPaths: string[] | undefined
function OgMark({ height = 40 }: { height?: number }) {
  logoPaths ??= [...readFileSync(join(process.cwd(), 'public/logo.svg'), 'utf8').matchAll(/\sd="([^"]+)"/g)].map((m) => m[1])
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 349.92 235.02" width={(height * 349.92) / 235.02} height={height}>
      {logoPaths.map((d, i) => (
        <path key={i} d={d} fill={INK} />
      ))}
    </svg>
  )
}

/** Footer row of the post and list cards: mark and name on the left, the domain on the right. */
function Footer() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: `2px solid ${INK}`,
        paddingTop: 22,
        fontFamily: 'Schibsted Grotesk',
        fontSize: 26,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <OgMark />
        <div style={{ display: 'flex', marginLeft: 18 }}>{profile.name}</div>
      </div>
      <div style={{ display: 'flex', color: MUTED }}>michal.ai</div>
    </div>
  )
}

export const postKindLabel = (post: Post) =>
  `${post.parent ? (post.series ?? 'Project') : SECTION[post.kind].kindLabel}  ·  ${post.date.slice(0, 4)}`

export function renderPostOg(post: Post) {
  const cover = coverDataUri(post)
  const len = post.title.length
  // With a cover the text column is narrower (about 600 px), so the type steps down earlier.
  const fontSize = cover ? (len > 60 ? 46 : len > 40 ? 54 : len > 24 ? 64 : 76) : len > 70 ? 56 : len > 48 ? 68 : len > 28 ? 80 : 96
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: PAPER,
          fontFamily: 'Schibsted Grotesk',
          color: INK,
          padding: cover ? '64px 72px 64px 80px' : '72px 80px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', fontSize: 28, color: MUTED }}>{postKindLabel(post)}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize, lineHeight: 1.05, fontWeight: 600, letterSpacing: -2 }}>{post.title}</div>
            {post.tags.length ? (
              <div style={{ display: 'flex', fontSize: 26, color: MUTED, marginTop: 32 }}>{post.tags.slice(0, cover ? 3 : 5).join('  ·  ')}</div>
            ) : null}
          </div>
          <Footer />
        </div>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img src={cover} width={456} height={534} style={{ width: 456, height: 534, borderRadius: 28, marginLeft: 56, alignSelf: 'center', objectFit: 'cover' }} />
        ) : null}
      </div>
    ),
    { ...OG_SIZE, fonts: loadFonts() }
  )
}

/** The owner's photograph (the _og/about-portrait.jpg crop made by scripts/build-images.mjs) as a data URI. */
function portraitDataUri() {
  try {
    return `data:image/jpeg;base64,${readFileSync(join(process.cwd(), 'public/media/_og/about-portrait.jpg')).toString('base64')}`
  } catch {
    throw new Error('share card: public/media/_og/about-portrait.jpg is missing (run npm run images)')
  }
}

/**
 * The person card: the home page's card and the About page's. Name and role on warm paper, the owner's photograph as a rounded
 * panel on the right (the same panel as a post's cover), the mark at bottom left with the domain.
 * `label` is the small line at the top: "Portfolio" on the home card, "About" on the About card.
 */
async function renderPersonOg(label: string) {
  const photo = portraitDataUri()
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: PAPER_HOME,
          color: INK,
          padding: '64px 72px 64px 80px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, minWidth: 0, position: 'relative' }}>
          <div style={{ display: 'flex', fontFamily: 'Schibsted Grotesk', fontSize: 28, color: MUTED }}>{label}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Newsreader', fontWeight: 300, fontSize: 96, lineHeight: 1, letterSpacing: -3 }}>
              <div style={{ display: 'flex' }}>{profile.firstName}</div>
              <div style={{ display: 'flex' }}>{profile.lastName}</div>
            </div>
            <div style={{ display: 'flex', fontFamily: 'Newsreader', fontStyle: 'italic', fontSize: 38, color: MUTED, marginTop: 24 }}>{profile.role}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', fontFamily: 'Schibsted Grotesk', fontSize: 26, color: MUTED }}>
            <OgMark />
            <div style={{ display: 'flex', marginLeft: 18 }}>michal.ai</div>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={photo} width={456} height={534} style={{ width: 456, height: 534, borderRadius: 28, marginLeft: 40, alignSelf: 'center', objectFit: 'cover', position: 'relative' }} />
      </div>
    ),
    { ...OG_SIZE, fonts: loadFonts() }
  )
}

export const renderHomeOg = () => renderPersonOg('Portfolio')
export const renderAboutOg = () => renderPersonOg('About')
export const renderResumeOg = () => renderPersonOg('Resume')

export function renderListOg(kind: PostKind, blurb: string) {
  const label = SECTION[kind].label
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
        <div style={{ display: 'flex', fontSize: 28, color: MUTED }}>{profile.name}</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontFamily: 'Newsreader', fontWeight: 300, fontSize: 168, lineHeight: 1, letterSpacing: -5 }}>{label}</div>
          <div style={{ display: 'flex', fontFamily: 'Newsreader', fontStyle: 'italic', fontSize: 40, color: MUTED, marginTop: 24, maxWidth: 900 }}>{blurb}</div>
        </div>
        <Footer />
      </div>
    ),
    { ...OG_SIZE, fonts: loadFonts() }
  )
}
