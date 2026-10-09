import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/content'

const SITE = 'https://michal.us'

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts()
  return [
    { url: SITE, lastModified: new Date() },
    { url: `${SITE}/projects`, lastModified: new Date() },
    { url: `${SITE}/writing`, lastModified: new Date() },
    ...posts.map((p) => ({
      url: `${SITE}/${p.kind === 'project' ? 'projects' : 'writing'}/${p.slug}`,
      lastModified: new Date(p.updated ?? p.date),
    })),
  ]
}
