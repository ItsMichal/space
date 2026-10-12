import { OG_CONTENT_TYPE, OG_SIZE, renderListOg } from '@/lib/og'

export const dynamic = 'force-static'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Projects by Michał Bodzianowski'

export default function Image() {
  return renderListOg('project', 'Selected work in AI, web and systems.')
}
