// The root layout's metadata and viewport (what app/layout.tsx exports for Next), without the Next font imports.
import type { Metadata, Viewport } from '@/lib/meta-types'
import { siteMetadata } from '@/lib/seo'
import { profile } from '@/content/profile'

export const rootViewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light',
  themeColor: '#f4f1e8',
}

const DESCRIPTION = profile.description
const TITLE = `${profile.name} · ${profile.titleTagline}`

export const rootMetadata: Metadata = {
  ...siteMetadata,
  title: { default: TITLE, template: `%s · ${profile.name}` },
  description: DESCRIPTION,
  robots: { index: true, follow: true },
  manifest: '/manifest.webmanifest',
  icons: { icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
  openGraph: { ...siteMetadata.openGraph, title: TITLE, description: DESCRIPTION },
  twitter: { ...siteMetadata.twitter, title: TITLE, description: DESCRIPTION },
}
