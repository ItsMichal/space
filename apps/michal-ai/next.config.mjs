import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import { buildRedirects } from './lib/redirects.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // @space/* workspace packages ship TypeScript source; Next compiles them with the app.
  transpilePackages: ['@space/motion', '@space/crosslinks'],
  // The writing tool lives in files named page.dev.tsx / route.dev.ts / layout.dev.tsx. Those extensions are only
  // registered under `next dev`, so `next build` (and therefore the Cloudflare worker) never sees /write or /api/write.
  pageExtensions:
    process.env.NODE_ENV === 'development'
      ? ['tsx', 'ts', 'jsx', 'js', 'dev.tsx', 'dev.ts']
      : ['tsx', 'ts', 'jsx', 'js'],
  // Old URLs -> current ones, one hop, 308. Single source: content/redirects.json (see lib/redirects.mjs).
  async redirects() {
    return buildRedirects()
  },
}

if (process.env.NODE_ENV === 'development') {
  initOpenNextCloudflareForDev()
}

export default nextConfig
