import './globals.css'
import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, Newsreader, Schibsted_Grotesk } from 'next/font/google'
import React, { StrictMode } from 'react'
import LidarBackground from '@/components/lidar/LidarBackground'
import { NavBar } from '@/components/site/NavBar'
import { Footer } from '@/components/site/Footer'
import { siteMetadata } from '@/lib/seo'

const sans = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-schibsted',
})

const serif = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-newsreader',
})

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-plex-mono',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f1e8' },
    { media: '(prefers-color-scheme: dark)', color: '#121612' },
  ],
}

const DESCRIPTION =
  "Hello, I'm Michal. I'm a Creative Developer with experience in AI, XR, and Web, specializing in taking projects from 0 to 1."

export const metadata: Metadata = {
  ...siteMetadata,
  title: { default: 'Michal Bodzianowski — Creative Developer', template: '%s — Michal Bodzianowski' },
  description: DESCRIPTION,
  robots: { index: true, follow: true },
  openGraph: {
    ...siteMetadata.openGraph,
    title: 'Michal Bodzianowski — Creative Developer',
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
        className={`${sans.variable} ${serif.variable} ${mono.variable}`}
      >
        <body className="flex min-h-screen flex-col font-sans text-ink">
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <LidarBackground />
          <NavBar />
          <main id="main" className="relative flex-1">
            {children}
          </main>
          <Footer />
        </body>
      </html>
    </StrictMode>
  )
}
