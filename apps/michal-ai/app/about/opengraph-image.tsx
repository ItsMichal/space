import { OG_CONTENT_TYPE, OG_SIZE, renderAboutOg } from '@/lib/og'

export const dynamic = 'force-static'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'About Michał Bodzianowski, software engineer'

export default function Image() {
  return renderAboutOg()
}
