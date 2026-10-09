import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

/** @type {import('next').NextConfig} */
const nextConfig = {
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
