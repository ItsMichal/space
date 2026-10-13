import { OG_CONTENT_TYPE, OG_SIZE, renderHomeOg } from '@/lib/og'

export const dynamic = 'force-static'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Michał Bodzianowski: creative developer. AI, web and systems.'

export default function Image() {
  return renderHomeOg()
}
