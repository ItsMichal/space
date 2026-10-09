import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/content'
import { SITE_URL, postPath } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts()
  const latest = (kind?: string) =>
    posts
      .filter((p) => !kind || p.kind === kind)
      .map((p) => p.updated ?? p.date)
      .sort()
      .pop()
  const dateOf = (d?: string) => (d ? new Date(d) : undefined)
  return [
    { url: SITE_URL, lastModified: dateOf(latest()), changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/projects`, lastModified: dateOf(latest('project')), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/writing`, lastModified: dateOf(latest('article')), changeFrequency: 'monthly', priority: 0.8 },
    ...posts.map((p) => ({
      url: `${SITE_URL}${postPath(p)}`,
      lastModified: new Date(p.updated ?? p.date),
      changeFrequency: 'yearly' as const,
      priority: p.kind === 'project' ? 0.7 : 0.6,
    })),
  ]
}
