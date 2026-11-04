import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildMeta } from '@/lib/rr/head'
import { mp4Size, shareVideoFor } from '@/lib/rr/content.server'

// A tkhd box (version 0) for a 1280x720 track: 84 bytes of payload after the type, width and height as 16.16 fixed point
function tkhd(width: number, height: number) {
  const b = Buffer.alloc(8 + 84)
  b.writeUInt32BE(b.length, 0)
  b.write('tkhd', 4)
  b.writeUInt32BE(width << 16, 8 + 76)
  b.writeUInt32BE(height << 16, 8 + 80)
  return b
}

const share = { og: '/x/opengraph-image', twitter: '/x/twitter-image', ogHash: 'a', twitterHash: 'b', alt: 'alt' }
const tags = (d: Record<string, unknown>[]) => Object.fromEntries(d.filter((t) => 'content' in t).map((t) => [String(t.property ?? t.name), t.content]))

describe('share video', () => {
  it('reads the frame size from the video track, skipping an audio track with none', () => {
    expect(mp4Size(Buffer.concat([tkhd(0, 0), tkhd(1280, 720)]))).toEqual({ width: 1280, height: 720 })
    expect(mp4Size(Buffer.from('no boxes here'))).toBeNull()
  })

  it('takes the first mp4 a post plays, and only a safe /media/ path', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'share-video-'))
    fs.mkdirSync(path.join(root, 'media/post'), { recursive: true })
    fs.writeFileSync(path.join(root, 'media/post/clip.mp4'), tkhd(1280, 720))
    expect(shareVideoFor('::video{src="/media/post/clip.webm"}\n::video{src="/media/post/clip.mp4" title="t"}', root)).toEqual({ src: '/media/post/clip.mp4', width: 1280, height: 720 })
    expect(shareVideoFor('::video{src="/media/post/missing.mp4"}', root)).toBeUndefined()
    expect(shareVideoFor('::video{src="/media/../clip.mp4"}', root)).toBeUndefined()
    expect(shareVideoFor('no video here', root)).toBeUndefined()
    fs.rmSync(root, { recursive: true })
  })

  it('adds og:video and an X player card, keeping the image card as the fallback', () => {
    const page = { openGraph: { title: 't' }, twitter: { card: 'summary_large_image', title: 't' } }
    const t = tags(buildMeta({}, page, {}, { ...share, video: { src: '/media/post/clip.mp4', width: 1280, height: 720 } }))
    expect(t).toMatchObject({
      'og:video': 'https://michal.ai/media/post/clip.mp4',
      'og:video:type': 'video/mp4',
      'og:video:width': '1280',
      'og:image': 'https://michal.ai/x/opengraph-image?a',
      'twitter:card': 'player',
      'twitter:player': 'https://michal.ai/player?v=%2Fmedia%2Fpost%2Fclip.mp4',
      'twitter:player:stream': 'https://michal.ai/media/post/clip.mp4',
      'twitter:image': 'https://michal.ai/x/twitter-image?b',
    })
    const plain = tags(buildMeta({}, page, {}, share))
    expect(plain['twitter:card']).toBe('summary_large_image')
    expect(plain['og:video']).toBeUndefined()
  })
})
