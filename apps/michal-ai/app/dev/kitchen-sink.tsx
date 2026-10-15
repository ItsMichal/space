import { useLoaderData } from 'react-router'
import type { Root } from 'hast'
import { hastToReact } from '@/lib/content/to-react'
import KitchenSink from '../kitchen-sink/page.dev'

export async function loader() {
  const { markdownToHast } = await import('@/lib/content/render')
  const { imagesFor } = await import('@/lib/rr/content.server')
  const { SOURCE } = await import('../kitchen-sink/page.dev')
  const hast = await markdownToHast(SOURCE)
  return { hast, images: imagesFor(hast) }
}

export const meta = () => [{ title: 'Kitchen sink' }, { name: 'robots', content: 'noindex, nofollow' }]

export default function Route() {
  const { hast } = useLoaderData<typeof loader>()
  return <KitchenSink body={hastToReact(hast as Root)} />
}
