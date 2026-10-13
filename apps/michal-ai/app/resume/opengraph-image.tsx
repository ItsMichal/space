import { OG_CONTENT_TYPE, OG_SIZE, renderResumeOg } from '@/lib/og'

export const dynamic = 'force-static'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Resume of Michał Bodzianowski, software engineer'

export default function Image() {
  return renderResumeOg()
}
