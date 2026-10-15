import { useLoaderData, type MetaFunction } from 'react-router'
import { registerImages } from '@/lib/media'
import Page from '../writing/page'

export async function loader() {
  const { headFor, imagesFor, shareFor, slimAll } = await import('@/lib/rr/content.server')
  const { getAllPosts } = await import('@/lib/content')
  const { metadata } = await import('../writing/page')
  return {
    head: headFor(metadata, { share: shareFor('/writing', 'Writing by Michał Bodzianowski') }),
    images: imagesFor(slimAll(getAllPosts())),
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => data?.head ?? []

export default function WritingRoute() {
  registerImages(useLoaderData<typeof loader>().images)
  return <Page />
}
