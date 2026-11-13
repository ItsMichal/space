// A private page (docs/private-pages.md): prerendered at /p/<key>, served by the Worker only at /p/<token> of an open link. Same
// markdown and reading layout as a post, inside the site chrome, but never indexed, never shared as a card, no JSON-LD, no
// reactions. The loader finds the page by its key; the address bar shows the token, which the component never needs.
import { useMemo } from 'react'
import { useLoaderData, type LoaderFunctionArgs, type MetaFunction } from 'react-router'
import type { Root } from 'hast'
import { registerImages } from '@/lib/media'
import { hastToReact } from '@/lib/content/to-react'
import { ArticleLayout } from '@/components/site/ArticleLayout'
import { ReadingTheme } from '@/components/site/ReadingTheme'
import { usePageBeacon } from '@/lib/pages/beacon'

export async function loader({ params }: LoaderFunctionArgs) {
  const { readPages, PAGE_STUB_KEY } = await import('@/lib/pages/build.mjs')
  const { markdownToHast } = await import('@/lib/content/render')
  const { headFor, imagesFor } = await import('@/lib/rr/content.server')
  const { readingViewport } = await import('@/components/content/PostPage')
  const p = readPages().find((x) => x.key === params.key)
  const notFound = [{ title: 'Not found' }, { name: 'robots', content: 'noindex, nofollow' }]
  // The stub path (lib/pages/build.mjs) builds as an empty page; the Worker never serves it.
  if (!p && params.key === PAGE_STUB_KEY) return { title: 'Not found', description: '', date: '', readingMinutes: 1, hast: { type: 'root', children: [] } as Root, head: notFound, images: {} as ReturnType<typeof imagesFor> }
  if (!p) throw new Response('Not found', { status: 404 })
  const hast = await (await import('@/lib/captions/inline.server')).inlineCaptions(await (await import('@/lib/ink/inline.server')).inlineHandwriting(await markdownToHast(p.body)))
  const words = p.body.split(/\s+/).filter(Boolean).length
  // Only what the page needs: no description, canonical, Open Graph or Twitter tags, so an unfurler that gets this far learns nothing.
  const head = headFor(
    { title: p.page.title, description: undefined, robots: { index: false, follow: false }, openGraph: undefined, twitter: undefined, alternates: undefined, authors: undefined, keywords: undefined },
    { viewport: readingViewport }
  )
  return {
    title: p.page.title,
    description: p.page.description ?? '',
    date: p.page.date ?? '',
    readingMinutes: Math.max(1, Math.round(words / 220)),
    hast,
    head: [...head, { name: 'referrer', content: 'no-referrer' }],
    images: imagesFor([hast]),
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => data?.head ?? [{ title: 'Not found' }, { name: 'robots', content: 'noindex, nofollow' }]

export default function PrivatePageRoute() {
  const d = useLoaderData<typeof loader>()
  registerImages(d.images)
  usePageBeacon()
  const body = useMemo(() => hastToReact(d.hast as Root), [d.hast])
  return (
    <>
      <ReadingTheme />
      <ArticleLayout title={d.title} description={d.description} date={d.date} tags={[]} readingMinutes={d.readingMinutes} kind="article">
        {body}
      </ArticleLayout>
    </>
  )
}
