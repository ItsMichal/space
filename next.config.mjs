import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

/** @type {import('next').NextConfig} */
const nextConfig = {
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
