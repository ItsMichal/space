import { MetadataRoute } from '@/lib/meta-types'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/private/',
    },
    sitemap: 'https://michal.ai/sitemap.xml',
  }
}
