import { getAllPosts } from '@/lib/content'
import { SITE_NAME, SITE_URL, absoluteUrl, postPath } from '@/lib/seo'
import { siteConfig } from '@/site.config'

export const dynamic = 'force-static'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

export function GET() {
  const posts = getAllPosts().sort((a, b) => (b.updated ?? b.date).localeCompare(a.updated ?? a.date))
  const lastBuild = posts[0] ? new Date(posts[0].updated ?? posts[0].date) : new Date()
  const items = posts
    .map((p) => {
      const url = absoluteUrl(postPath(p))
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <description>${esc(p.description)}</description>
${p.tags.map((t) => `      <category>${esc(t)}</category>`).join('\n')}${p.cover ? `\n      <enclosure url="${esc(absoluteUrl(p.cover))}" type="image/${p.cover.endsWith('.png') ? 'png' : p.cover.endsWith('.jpg') ? 'jpeg' : 'webp'}" length="0" />` : ''}
    </item>`
    })
    .join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>${esc(siteConfig.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } })
}
