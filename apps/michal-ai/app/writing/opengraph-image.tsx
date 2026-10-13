import { OG_CONTENT_TYPE, OG_SIZE, renderListOg } from '@/lib/og'

export const dynamic = 'force-static'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Writing by Michał Bodzianowski'

export default function Image() {
  return renderListOg('article', 'Essays and notes on building with AI, the web and systems.')
}
