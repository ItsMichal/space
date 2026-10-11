import './globals.css'
import './styles/tendrils.css'
import './styles/craft.css'
import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, Newsreader, Schibsted_Grotesk } from 'next/font/google'
import React, { StrictMode } from 'react'
import { NavBar } from '@/components/site/NavBar'
import { ScrollReveal } from '@/components/site/ScrollReveal'
import { Footer } from '@/components/site/Footer'
import { ShaderCanvasProvider } from '@/components/shader-image'
import { Backdrop } from '@/components/backdrop/Backdrop'
import { display } from './fonts/display'
import { siteMetadata } from '@/lib/seo'
import { profile } from '@/content/profile'

const sans = Schibsted_Grotesk({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-schibsted',
})

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
const TITLE = `${profile.name} — ${profile.titleTagline}`

export const metadata: Metadata = {
  ...siteMetadata,
  title: { default: TITLE, template: `%s — ${profile.name}` },
  description: DESCRIPTION,
  robots: { index: true, follow: true },
  openGraph: {
    ...siteMetadata.openGraph,
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/michal.png' }],
  },
  twitter: { ...siteMetadata.twitter, images: ['/michal.png'] },
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
        className={`${display.variable} ${sans.variable} ${serif.variable} ${mono.variable}`}
      >
        <body className="flex min-h-screen flex-col font-sans text-ink">
          {/* Irregular ink edge for the press stain on buttons: turbulence eats the boundary of the stain. */}
          <svg width="0" height="0" aria-hidden focusable="false" style={{ position: 'absolute' }}>
            <filter id="ink-edge" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="46" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </svg>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <NavBar />
          <ScrollReveal />
          <main id="main" className="relative flex-1">
            <Backdrop paths={['/', '/shaders']} />
            <ShaderCanvasProvider>{children}</ShaderCanvasProvider>
          </main>
          <Footer />
        </body>
      </html>
    </StrictMode>
  )
}
