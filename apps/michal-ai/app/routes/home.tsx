import { useLoaderData, type MetaFunction } from 'react-router'
import { registerImages } from '@/lib/media'
import Home from '../page'

export async function loader() {
  const { headFor, imagesFor, shareFor, slimAll } = await import('@/lib/rr/content.server')
  const { getBlogPosts, getTopLevel } = await import('@/lib/content')
  const { homeMetadata } = await import('@/lib/seo')
  const { profile } = await import('@/content/profile')
  return {
    head: headFor(homeMetadata(), { share: shareFor('/', 'Michał Bodzianowski: creative developer. AI, web and systems.') }),
    images: imagesFor(slimAll([...getTopLevel('project'), ...getBlogPosts().slice(0, 3)]), [profile.portrait.src]),
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => data?.head ?? []

export default function HomeRoute() {
  registerImages(useLoaderData<typeof loader>().images)
  return <Home />
}
