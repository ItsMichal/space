import { useLoaderData, type MetaFunction } from 'react-router'
import { registerImages } from '@/lib/media'
import Page from '../projects/page'

export async function loader() {
  const { headFor, imagesFor, shareFor, slimAll } = await import('@/lib/rr/content.server')
  const { getTopLevel } = await import('@/lib/content')
  const { listMetadata } = await import('@/lib/seo')
  // Same strings as app/projects/page.tsx (the Next page keeps them private, so they are read from its exported metadata).
  const { metadata } = await import('../projects/page')
  void listMetadata
  return {
    head: headFor(metadata, { share: shareFor('/projects', 'Projects by Michał Bodzianowski') }),
    images: imagesFor(slimAll(getTopLevel('project'))),
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => data?.head ?? []

export default function ProjectsRoute() {
  registerImages(useLoaderData<typeof loader>().images)
  return <Page />
}
