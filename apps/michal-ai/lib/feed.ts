// RSS 2.0 builder shared by the site feed and per-project log feeds.
import type { Post } from '@/lib/content/types'
import { SITE_URL, absoluteUrl, postPath } from '@/lib/seo'
import { feedIdPath } from '@/lib/slug-history'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const mime = (p: string) => (p.endsWith('.png') ? 'png' : p.endsWith('.jpg') || p.endsWith('.jpeg') ? 'jpeg' : 'webp')

export const newestFirst = (posts: Post[]) =>
  [...posts].sort((a, b) => (b.updated ?? b.date).localeCompare(a.updated ?? a.date))

export function rssResponse(opts: { title: string; link: string; self: string; description: string; posts: Post[] }) {
  const posts = newestFirst(opts.posts)
  const lastBuild = posts[0] ? new Date(posts[0].updated ?? posts[0].date) : new Date(0)
  const items = posts
    .map((p) => {
      const url = absoluteUrl(postPath(p))
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="${feedIdPath(postPath(p)) === postPath(p)}">${absoluteUrl(feedIdPath(postPath(p)))}</guid>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <description>${esc(p.description)}</description>
${p.tags.map((t) => `      <category>${esc(t)}</category>`).join('\n')}${p.cover ? `\n      <enclosure url="${esc(absoluteUrl(p.cover))}" type="image/${mime(p.cover)}" length="0" />` : ''}
    </item>`
    })
    .join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(opts.title)}</title>
    <link>${opts.link}</link>
    <description>${esc(opts.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>
    <atom:link href="${opts.self}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } })
}

export { SITE_URL }
