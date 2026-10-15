import { useLoaderData, type MetaFunction } from 'react-router'
import { registerImages } from '@/lib/media'
import Page from '../about/page'

export async function loader() {
  const { headFor, imagesFor, shareFor, slimAll } = await import('@/lib/rr/content.server')
  const { getAllPosts } = await import('@/lib/content')
  const { profile } = await import('@/content/profile')
  const { aboutMetadata } = await import('@/lib/seo')
  return {
    head: headFor(aboutMetadata(), { share: shareFor('/about', 'About Michał Bodzianowski, software engineer') }),
    images: imagesFor(slimAll(getAllPosts()), [profile.portrait.src]),
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => data?.head ?? []

export default function AboutRoute() {
  registerImages(useLoaderData<typeof loader>().images)
  return <Page />
}
