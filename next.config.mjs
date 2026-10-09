import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The writing tool lives in files named page.dev.tsx / route.dev.ts / layout.dev.tsx. Those extensions are only
  // registered under `next dev`, so `next build` (and therefore the Cloudflare worker) never sees /write or /api/write.
  pageExtensions:
    process.env.NODE_ENV === 'development'
      ? ['tsx', 'ts', 'jsx', 'js', 'dev.tsx', 'dev.ts']
      : ['tsx', 'ts', 'jsx', 'js'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.unsplash.com' },
      { protocol: 'https', hostname: '**.notion.so' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
    ],
  },
}

if (process.env.NODE_ENV === 'development') {
  initOpenNextCloudflareForDev()
}

export default nextConfig
