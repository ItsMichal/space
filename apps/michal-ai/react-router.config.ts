import type { Config } from '@react-router/dev/config'
import { readPostPaths } from './lib/redirects.mjs'

// Static site: every route is prerendered to HTML at build time and served as Workers static assets (worker/index.ts).
// The list of concrete paths comes straight from the post front matter (the same reader the redirects use).
// `react-router dev` renders on request (loaders run per request, so edited posts show on refresh and the dev-only routes may have
// loaders); every build is `ssr: false` and prerenders.
export default {
  ssr: process.env.NODE_ENV === 'development',
  async prerender() {
    const posts = readPostPaths()
    const withFeeds = [...new Set(posts.flatMap((p) => (p.parent ? [p.parent] : [])))]
    return [
      '/',
      '/projects',
      '/writing',
      '/about',
      '/resume',
      ...posts.map((p) => p.path),
      '/sitemap.xml',
      '/robots.txt',
      '/manifest.webmanifest',
      '/feed.xml',
      '/feed.json',
      ...withFeeds.map((slug) => `/projects/${slug}/feed.xml`),
      '/404',
    ]
  },
} satisfies Config
