import { getBlogPosts, getTopLevel } from '@/lib/content'
import { AUTHOR_NAME, SITE_NAME, SITE_URL, absoluteUrl, postPath } from '@/lib/seo'
import { feedIdPath } from '@/lib/slug-history'
import { siteConfig } from '@/site.config'

export const dynamic = 'force-static'

// JSON Feed 1.1: https://www.jsonfeed.org/version/1.1/
export function GET() {
  const posts = [...getBlogPosts(), ...getTopLevel('project')].sort((a, b) => (b.updated ?? b.date).localeCompare(a.updated ?? a.date))
  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: SITE_NAME,
    home_page_url: SITE_URL,
    feed_url: `${SITE_URL}/feed.json`,
    description: siteConfig.description,
    language: 'en-US',
    authors: [{ name: AUTHOR_NAME, url: SITE_URL }],
    items: posts.map((p) => ({
      id: absoluteUrl(feedIdPath(postPath(p))),
      url: absoluteUrl(postPath(p)),
      title: p.title,
      summary: p.description,
      date_published: new Date(p.date).toISOString(),
      date_modified: new Date(p.updated ?? p.date).toISOString(),
      tags: p.tags,
      ...(p.cover ? { image: absoluteUrl(p.cover) } : {}),
    })),
  }
  return new Response(JSON.stringify(feed, null, 2), { headers: { 'content-type': 'application/feed+json; charset=utf-8' } })
}
