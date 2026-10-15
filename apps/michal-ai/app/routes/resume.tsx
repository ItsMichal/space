import { useLoaderData, type MetaFunction } from 'react-router'
import { registerImages } from '@/lib/media'
import Page from '../resume/page'

export async function loader() {
  const { headFor, shareFor } = await import('@/lib/rr/content.server')
  const { resumeMetadata } = await import('@/lib/seo')
  return { head: headFor(resumeMetadata(), { share: shareFor('/resume', 'Resume of Michał Bodzianowski, software engineer') }), images: {} }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => data?.head ?? []

export default function ResumeRoute() {
  registerImages(useLoaderData<typeof loader>().images)
  return <Page />
}
