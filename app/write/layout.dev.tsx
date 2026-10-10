// Dev-only (see pageExtensions in next.config.mjs). The root layout still renders its site chrome underneath;
// `.ed-root` is a fixed, opaque, full-viewport layer that covers it. If the root layout moves to route groups,
// this can become a real root layout.
import './editor.css'
import type { Metadata } from 'next'
import { ReadingTheme } from '@/components/site/ReadingTheme'
import { IBM_Plex_Mono, Newsreader, Schibsted_Grotesk } from 'next/font/google'

const serif = Newsreader({ subsets: ['latin'], style: ['normal', 'italic'], axes: ['opsz'], variable: '--ed-serif', display: 'swap' })
const sans = Schibsted_Grotesk({ subsets: ['latin'], variable: '--ed-sans', display: 'swap' })
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--ed-mono', display: 'swap' })

export const metadata: Metadata = { title: 'Write', robots: 'noindex, nofollow' }

export default function WriteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`ed-root ${serif.variable} ${sans.variable} ${mono.variable}`}>
      <ReadingTheme />
      {children}
    </div>
  )
}
