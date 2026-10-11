import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache'

// The site is fully prerendered (posts are read from content/ at build time, and Workers have no
// filesystem), so serve the build's prerendered pages straight from Workers static assets.
// Without an incremental cache, OpenNext re-renders those routes at request time and they 404.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
})
