import type { MetadataRoute } from '@/lib/meta-types'
import { profile } from '@/content/profile'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: profile.name,
    short_name: 'michal',
    start_url: '/',
    display: 'browser',
    background_color: '#f4f1e8',
    theme_color: '#f4f1e8',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
