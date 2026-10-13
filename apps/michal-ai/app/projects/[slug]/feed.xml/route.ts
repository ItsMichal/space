import { getAllPosts, getChildren, getPost } from '@/lib/content'
import { rssResponse } from '@/lib/feed'
import { SITE_URL } from '@/lib/seo'

export const dynamic = 'force-static'
export const dynamicParams = false

// One feed per project that has children, e.g. /projects/project-mountaintop/feed.xml (the progress log).
export function generateStaticParams() {
  return [...new Set(getAllPosts().flatMap((p) => (p.parent ? [p.parent] : [])))].map((slug) => ({ slug }))
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const project = getPost(slug)
  if (!project) return new Response('Not found', { status: 404 })
  return rssResponse({
    title: `${project.title} · ${getChildren(slug).find((c) => c.series)?.series ?? 'updates'}`,
    link: `${SITE_URL}/projects/${slug}`,
    self: `${SITE_URL}/projects/${slug}/feed.xml`,
    description: project.description,
    posts: getChildren(slug),
  })
}
