import { getBlogPosts, getTopLevel } from '@/lib/content'
import { rssResponse } from '@/lib/feed'
import { SITE_NAME, SITE_URL } from '@/lib/seo'
import { siteConfig } from '@/site.config'

export const dynamic = 'force-static'

// Blog posts and top-level projects. Progress logs and project sub-pieces have their own feeds
// (/projects/<slug>/feed.xml) so they don't flood this one.
export function GET() {
  return rssResponse({
    title: SITE_NAME,
    link: SITE_URL,
    self: `${SITE_URL}/feed.xml`,
    description: siteConfig.description,
    posts: [...getBlogPosts(), ...getTopLevel('project')],
  })
}
