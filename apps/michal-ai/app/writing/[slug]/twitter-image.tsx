import Image from './opengraph-image'

export { generateStaticParams } from './opengraph-image'
export const dynamic = 'force-static'
export const dynamicParams = false
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Article by Michał Bodzianowski'

export default Image
