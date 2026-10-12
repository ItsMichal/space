import './globals.css'
import './styles/craft.css'
import './styles/type.css'
import './styles/card.css'
import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, Newsreader } from 'next/font/google'
import React, { StrictMode } from 'react'
import { NavBar } from '@/components/site/NavBar'
import { Footer } from '@/components/site/Footer'
import { PageEnd } from '@/components/site/PageEnd'
import { PaperGrid } from '@/components/site/PaperGrid'
import { ShaderCanvasProvider } from '@/components/shader-image'
import { Backdrop } from '@/components/backdrop/Backdrop'
import { display } from './fonts/display'
import { DEFAULT_SHARE_IMAGE, siteMetadata } from '@/lib/seo'
import { getMenuPreviews } from '@/lib/menu'
import { profile } from '@/content/profile'

const serif = Newsreader({
  subsets: ['latin', 'latin-ext'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-newsreader',
})

const mono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-plex-mono',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light',
  themeColor: '#f4f1e8',
}

const DESCRIPTION = profile.description
const TITLE = `${profile.name} · ${profile.titleTagline}`

export const metadata: Metadata = {
  ...siteMetadata,
  title: { default: TITLE, template: `%s · ${profile.name}` },
  description: DESCRIPTION,
  robots: { index: true, follow: true },
  // Google wants a crawlable square icon in a multiple of 48px; the file-based favicon.ico/icon.svg stay as they are.
  icons: { icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
  openGraph: {
    ...siteMetadata.openGraph,
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: DEFAULT_SHARE_IMAGE }],
  },
  twitter: { ...siteMetadata.twitter, images: [DEFAULT_SHARE_IMAGE] },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <StrictMode>
      <html
        lang="en"
        className={`${display.variable} ${serif.variable} ${mono.variable}`}
      >
        <body className="flex min-h-screen flex-col font-sans text-ink">
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <NavBar previews={getMenuPreviews()} />
          <main id="main" className="relative flex-1">
            <PaperGrid />
            <Backdrop paths={['/shaders']} />
            <ShaderCanvasProvider>{children}</ShaderCanvasProvider>
          </main>
          <PageEnd />
          <Footer />
        </body>
      </html>
    </StrictMode>
  )
}
