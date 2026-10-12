import { LiteYouTube } from './LiteYouTube'
import { youtubeStatus } from '@/lib/embeds'

/** Renders nothing for a video the build-time check found private, deleted or embed-disabled (content/embed-status.json). */
export function YouTube({ id, title }: { id: string; title?: string }) {
  const known = youtubeStatus(id)
  if (known && !known.embeddable) return null
  return (
    <LiteYouTube
      id={id}
      title={title ?? known?.title ?? 'YouTube video'}
      thumbnail={known?.thumbnail ?? `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`}
    />
  )
}
