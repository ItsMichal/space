import type { MetaFunction } from 'react-router'
import NotFound from '../not-found'

export async function loader() {
  const { headFor, shareFor } = await import('@/lib/rr/content.server')
  const { metadata } = await import('../not-found')
  return { head: headFor(metadata, { share: shareFor('/', 'Michał Bodzianowski: creative developer. AI, web and systems.') }) }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => data?.head ?? []

export default NotFound
