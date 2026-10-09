import 'react-notion-x/src/styles.css'
import 'prismjs/themes/prism-tomorrow.css'
import 'katex/dist/katex.min.css'
import './globals.css'
import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, Newsreader, Schibsted_Grotesk } from 'next/font/google'
import React, { StrictMode } from 'react'
import LidarBackground from '@/components/lidar/LidarBackground'
import { NavBar } from '@/components/site/NavBar'
import { Footer } from '@/components/site/Footer'

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
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f5f1' },
    { media: '(prefers-color-scheme: dark)', color: '#111113' },
  ],
}

export const metadata: Metadata = {
  title: 'michal "halmic" bodzianowski',
  description:
    `Hello, I'm Michal. I'm a Creative Developer with experience in AI, XR, and Web, specializing in taking projects from 0 to 1.`,
  robots: 'follow, index',
  alternates: undefined,
  twitter: {
    card: 'summary_large_image',
    site: '@itsmichal',
    creator: '@itsmichal',
    images: [
      {
        url: 'https://michal.us/michal.png',
      },
    ],
  },
  verification: undefined,
  appleWebApp: undefined,
  other: undefined,
  openGraph: {
    title: 'michal "halmic" bodzianowski',
    description:
      `Hello, I'm Michal. I'm a Creative Developer with experience in AI, XR, and Web, specializing in taking projects from 0 to 1.`,
    images: [
      {
        url: 'https://michal.us/michal.png',
      },
    ],
  },
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
        <body className="flex min-h-screen flex-col bg-paper font-sans text-ink">
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
