import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The writing tool lives in files named page.dev.tsx / route.dev.ts / layout.dev.tsx. Those extensions are only
  // registered under `next dev`, so `next build` (and therefore the Cloudflare worker) never sees /write or /api/write.
  pageExtensions:
    process.env.NODE_ENV === 'development'
      ? ['tsx', 'ts', 'jsx', 'js', 'dev.tsx', 'dev.ts']
      : ['tsx', 'ts', 'jsx', 'js'],
  async redirects() {
    return [
      // legacy slug from the old content/projects.ts list
      { source: '/projects/barcode-game', destination: '/projects/office-wizards-barcode-game', permanent: true },
    ]
  },
}

if (process.env.NODE_ENV === 'development') {
  initOpenNextCloudflareForDev()
}

export default nextConfig
